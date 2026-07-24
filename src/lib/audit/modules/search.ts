import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";

/** Cheerio-detectable markers that a search form exists somewhere on the page. */
const SEARCH_FORM_DETECT_SELECTOR = [
  'form[role="search"]',
  'input[type="search"]',
  "#searchform",
  ".search-form",
  'input[name="s"]',
].join(", ");

/** Candidate live locators for the actual fillable search input, in priority order. */
const SEARCH_INPUT_LOCATOR_CANDIDATES = [
  'input[name="s"]',
  'input[type="search"]',
  '.search-form input[type="text"]',
  '#searchform input[type="text"]',
  'form[role="search"] input',
];

const RESULTS_MARKER_SELECTOR = '.search-results, [class*="search-result"]';

/** URL indicates a search was actually performed (common WP query params or /search/ path). */
function urlIndicatesSearch(currentUrl: string): boolean {
  try {
    const parsed = new URL(currentUrl);
    if (/[?&](s|query|search)=/i.test(parsed.search)) return true;
    if (/\/search\//i.test(parsed.pathname)) return true;
    return false;
  } catch {
    return /[?&](s|query|search)=/i.test(currentUrl) || /\/search\//i.test(currentUrl);
  }
}

export const searchModule: AuditModule = {
  category: "search",
  label: "Search",
  run: async (ctx) => {
    const findings: Finding[] = [];
    const { $, url } = ctx;

    const hasSearchForm = $(SEARCH_FORM_DETECT_SELECTOR).length > 0;

    if (!hasSearchForm) {
      findings.push(
        makeFinding({
          category: "search",
          title: "No on-page search form detected",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description:
            "No search form (e.g. a role=\"search\" form, a search input, or a WordPress-style ?s= query field) was detected on this page, so on-page search could not be tested.",
          whyItMatters: "Not every page needs a visible search box, so this is informational rather than a defect.",
          recommendation: "If a site-wide search is expected on this page, add a search form; otherwise no action is needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
      return findings;
    }

    const originalUrl = ctx.page.url();

    try {
      let usedSelector: string | null = null;
      for (const selector of SEARCH_INPUT_LOCATOR_CANDIDATES) {
        const locator = ctx.page.locator(selector).first();
        const count = await locator.count().catch(() => 0);
        if (count > 0) {
          const visible = await locator.isVisible().catch(() => false);
          if (visible) {
            usedSelector = selector;
            break;
          }
        }
      }

      if (!usedSelector) {
        findings.push(
          makeFinding({
            category: "search",
            title: "Search form detected but could not be interacted with",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description:
              "A search form was detected in the page markup, but no visible, fillable search input could be located on the live page to test it.",
            whyItMatters: "If the search input is hidden or requires an extra interaction (e.g. clicking an icon first) to reveal it, this automated check cannot verify search works end-to-end.",
            recommendation: "Manually test the site search to confirm it returns results as expected.",
            estimatedFixTime: "10 minutes",
          }),
        );
        return findings;
      }

      const input = ctx.page.locator(usedSelector).first();
      await input.fill("test");

      let submitted = false;
      try {
        const submitButton = input
          .locator("xpath=ancestor::form[1]//button[@type='submit'] | ancestor::form[1]//input[@type='submit']")
          .first();
        const submitCount = await submitButton.count().catch(() => 0);
        if (submitCount > 0) {
          await submitButton.click();
          submitted = true;
        }
      } catch {
        submitted = false;
      }

      if (!submitted) {
        await input.press("Enter").catch(() => undefined);
      }

      await ctx.page
        .waitForURL(/[?&](?:s|query|search)=/i, { timeout: 8000 })
        .catch(() => null);
      await ctx.page.waitForTimeout(1500);

      const currentUrl = ctx.page.url();
      const urlChanged = currentUrl !== originalUrl;
      const urlLooksLikeSearch = urlIndicatesSearch(currentUrl);
      const resultsMarkerVisible = await ctx.page
        .locator(RESULTS_MARKER_SELECTOR)
        .first()
        .isVisible()
        .catch(() => false);

      if (urlLooksLikeSearch || resultsMarkerVisible) {
        findings.push(
          makeFinding({
            category: "search",
            title: "Search form submits and produces a results state",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: `Submitting a test query through the search form resulted in ${
              urlLooksLikeSearch ? `a URL indicating search results (${currentUrl})` : "a visible search-results-style container appearing on the page"
            }.`,
            whyItMatters: "A working search feature helps visitors quickly find content, which directly affects usability and engagement.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
            meta: { originalUrl, finalUrl: currentUrl, usedSelector },
          }),
        );
      } else if (urlChanged) {
        findings.push(
          makeFinding({
            category: "search",
            title: "Search submission could not be fully confirmed",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description: `Submitting the search form navigated the page to ${currentUrl}, but no recognized search-results indicator (query param like s=/query=/search=, or a .search-results style container) was found. This may still be a working, custom-styled results page — automated verification has limits here.`,
            whyItMatters: "Confirming search actually returns results (rather than erroring silently) is important, but a custom results page can look different from common conventions.",
            recommendation: "Manually verify that submitting a search query returns relevant results.",
            estimatedFixTime: "10 minutes",
            meta: { originalUrl, finalUrl: currentUrl, usedSelector },
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "search",
            title: "Search form did not appear to respond to submission",
            status: "fail",
            severity: "medium",
            pageUrl: url,
            description:
              "Submitting a test query through the search form produced no URL change and no visible search-results indicator after waiting several seconds. The search feature may not be functioning.",
            whyItMatters: "A non-functioning search box is a frustrating dead end for visitors trying to find content.",
            recommendation: "Manually test the search form and check the browser console/network tab for errors.",
            estimatedFixTime: "30 minutes",
            meta: { originalUrl, finalUrl: currentUrl, usedSelector },
          }),
        );
      }
    } catch (err) {
      findings.push(
        makeFinding({
          category: "search",
          title: "Search could not be fully verified",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: `An error occurred while attempting to test the on-page search form: ${err instanceof Error ? err.message : String(err)}`,
          whyItMatters: "Without a completed test, it's unknown whether site search works correctly for visitors.",
          recommendation: "Manually test the site search functionality.",
          estimatedFixTime: "10 minutes",
        }),
      );
    } finally {
      // Best-effort: leave the page back where the next module expects it if we navigated away.
      try {
        if (ctx.page.url() !== originalUrl) {
          await ctx.page.goto(originalUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
        }
      } catch {
        // ignore cleanup failures
      }
    }

    return findings;
  },
};
