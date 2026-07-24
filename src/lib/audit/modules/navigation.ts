import type { CheerioAPI } from "cheerio";
import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";

const MAX_LISTED_ITEMS = 10;

const HEADER_NAV_SELECTORS = [
  "header nav",
  "nav[role='navigation']",
  ".main-navigation",
  ".nav-menu",
  ".primary-menu",
  "#primary-menu",
  ".site-navigation",
  "#site-navigation",
  ".main-nav",
  "#main-nav",
].join(", ");

const FOOTER_NAV_SELECTORS = [
  "footer nav",
  "footer .menu",
  ".footer-menu",
  ".footer-navigation",
  ".footer-nav",
  ".footer-widget-area nav",
].join(", ");

/** Combined scope used for menu-link-quality checks (empty href / javascript:void, dropdown detection). */
const MENU_SCOPE_SELECTOR = [HEADER_NAV_SELECTORS, FOOTER_NAV_SELECTORS, "nav"].join(", ");

/** Scope used for the header/footer broken-link reachability check specifically. */
const HEADER_FOOTER_SCOPE_SELECTOR = [HEADER_NAV_SELECTORS, FOOTER_NAV_SELECTORS, "header a", "footer a"].join(", ");

const MAX_CHECKED_LINKS = 20;
const FETCH_TIMEOUT_MS = 8000;
const FETCH_BATCH_SIZE = 5;

interface LinkCheckResult {
  href: string;
  outcome: "reachable" | "broken" | "unknown";
  status?: number;
}

async function checkLinkReachable(href: string): Promise<LinkCheckResult> {
  try {
    const res = await fetch(href, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(href, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      return { href, status: getRes.status, outcome: getRes.status < 400 ? "reachable" : "broken" };
    }
    return { href, status: res.status, outcome: res.status < 400 ? "reachable" : "broken" };
  } catch {
    try {
      const getRes = await fetch(href, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      return { href, status: getRes.status, outcome: getRes.status < 400 ? "reachable" : "broken" };
    } catch {
      return { href, outcome: "unknown" };
    }
  }
}

const CTA_SELECTORS = [
  ".button",
  ".btn",
  "a.wp-block-button__link",
  "a[class*='cta']",
  "button[class*='cta']",
  "[class*='cta-button']",
].join(", ");

const DROPDOWN_SELECTORS = [".sub-menu", "[aria-haspopup]", ".dropdown-menu"].join(", ");

interface MenuLinkItem {
  text: string;
  href: string | null;
}

function capItems<T>(items: T[], cap = MAX_LISTED_ITEMS): { shown: T[]; remaining: number } {
  return { shown: items.slice(0, cap), remaining: Math.max(0, items.length - cap) };
}

/** Whether `#fragment` resolves to a real element via id or name attribute in the page's static HTML. */
function resolvesToRealAnchor($: CheerioAPI, fragment: string): boolean {
  const id = fragment.slice(1).trim();
  if (!id) return false;
  try {
    return $(`[id="${id}"]`).length > 0 || $(`[name="${id}"]`).length > 0;
  } catch {
    return false;
  }
}

export const navigationModule: AuditModule = {
  category: "navigation",
  label: "Navigation",
  run: async (ctx) => {
    const findings: Finding[] = [];
    const { $, url } = ctx;

    // 1. Header navigation present
    const headerNavCount = $(HEADER_NAV_SELECTORS).length;
    if (headerNavCount > 0) {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "Header navigation menu found",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Found ${headerNavCount} header navigation container${headerNavCount === 1 ? "" : "s"} on the page.`,
          whyItMatters: "A visible header navigation menu is the primary way visitors orient themselves and move between key pages of the site.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "No header navigation menu detected",
          status: "fail",
          severity: "high",
          pageUrl: url,
          description: "No header navigation menu (e.g. <header><nav>, .main-navigation, .nav-menu) could be found on the page.",
          whyItMatters: "Without a discoverable primary navigation menu, visitors have no reliable way to explore the rest of the site.",
          recommendation: "Add a clearly marked, semantic header navigation menu (ideally an actual <nav> element) with links to key pages.",
          estimatedFixTime: "1 hour",
        }),
      );
    }

    // 2. Footer navigation present
    const footerNavCount = $(FOOTER_NAV_SELECTORS).length;
    if (footerNavCount > 0) {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "Footer navigation menu found",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Found ${footerNavCount} footer navigation container${footerNavCount === 1 ? "" : "s"} on the page.`,
          whyItMatters: "A footer menu gives visitors a secondary, always-available way to reach important pages (policies, contact, sitemap, etc.).",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "No footer navigation menu detected",
          status: "fail",
          severity: "medium",
          pageUrl: url,
          description: "No footer navigation menu (e.g. <footer><nav>, .footer-menu, .footer-navigation) could be found on the page.",
          whyItMatters: "Footer menus are a common, expected pattern that helps visitors quickly find secondary pages like contact, privacy policy, or sitemap.",
          recommendation: "Add a footer navigation section with links to key secondary pages.",
          estimatedFixTime: "30 minutes",
        }),
      );
    }

    // 3. Call-to-action buttons (informational, not a hard requirement)
    const ctaEls = $(CTA_SELECTORS).toArray();
    const ctaItems: MenuLinkItem[] = ctaEls.map((el) => ({
      text: $(el).text().trim().replace(/\s+/g, " ").slice(0, 80) || "(no text)",
      href: $(el).attr("href") ?? null,
    }));
    if (ctaItems.length > 0) {
      const { shown, remaining } = capItems(ctaItems);
      findings.push(
        makeFinding({
          category: "navigation",
          title: "Call-to-action buttons detected",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Found ${ctaItems.length} call-to-action style button${ctaItems.length === 1 ? "" : "s"} on the page.${remaining > 0 ? ` Showing first ${MAX_LISTED_ITEMS}; ${remaining} more not shown.` : ""}`,
          whyItMatters: "Clear calls-to-action guide visitors toward key conversion actions (contact, purchase, sign up).",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { count: ctaItems.length, items: shown },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "No call-to-action buttons detected",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "No elements matching common call-to-action button patterns (.button, .btn, wp-block-button, *cta*) were found on this page.",
          whyItMatters: "A page without a clear call-to-action may miss opportunities to convert visitors, though not every page type requires one.",
          recommendation: "If this page is meant to drive a specific visitor action, consider adding a clear, styled call-to-action button.",
          estimatedFixTime: "20 minutes",
        }),
      );
    }

    // 4. Dropdown / submenu detection (informational either way)
    const dropdownEls = $(MENU_SCOPE_SELECTOR).find(DROPDOWN_SELECTORS).toArray();
    if (dropdownEls.length > 0) {
      const dropdownItems = dropdownEls.map((el) => ({
        text: $(el).text().trim().replace(/\s+/g, " ").slice(0, 80) || "(no text)",
        href: null,
      }));
      const { shown, remaining } = capItems(dropdownItems);
      findings.push(
        makeFinding({
          category: "navigation",
          title: "Dropdown / submenu navigation detected",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Found ${dropdownEls.length} dropdown/submenu element${dropdownEls.length === 1 ? "" : "s"} within the navigation.${remaining > 0 ? ` Showing first ${MAX_LISTED_ITEMS}; ${remaining} more not shown.` : ""} Manual testing of hover/keyboard/touch behavior is still recommended.`,
          whyItMatters: "Dropdown menus add navigational depth but need to be manually verified for keyboard and touch/mobile operability, which this automated scan cannot fully confirm.",
          recommendation: "Manually verify dropdown menus open/close correctly via mouse, keyboard, and touch.",
          estimatedFixTime: "20 minutes",
          meta: { count: dropdownEls.length, items: shown },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "No dropdown / submenu navigation detected",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "No nested dropdown/submenu elements were found within the site's navigation containers.",
          whyItMatters: "This is purely informational; a flat navigation structure is not inherently a problem.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 5 & 6. Menu link quality: empty/non-functional hrefs and javascript:void(0) hrefs
    const menuAnchors = $(MENU_SCOPE_SELECTOR).find("a").toArray();

    if (menuAnchors.length === 0) {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "No navigation menu links found to check",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "No <a> links were found inside any detected navigation container, so link-quality checks (empty hrefs, javascript:void links) could not be performed.",
          whyItMatters: "Without any menu links present, there is nothing for visitors to click in the navigation.",
          recommendation: "Ensure the navigation menu actually contains links.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      const emptyHrefItems: MenuLinkItem[] = [];
      const jsVoidItems: MenuLinkItem[] = [];

      for (const el of menuAnchors) {
        const $el = $(el);
        const rawHref = $el.attr("href");
        const text = $el.text().trim().replace(/\s+/g, " ").slice(0, 80) || "(no text)";
        const href = rawHref?.trim() ?? "";

        if (/^javascript:\s*void\(/i.test(href) || /^javascript:/i.test(href)) {
          jsVoidItems.push({ text, href: rawHref ?? null });
          continue;
        }

        if (href === "") {
          emptyHrefItems.push({ text, href: rawHref ?? null });
          continue;
        }

        if (href === "#") {
          emptyHrefItems.push({ text, href });
          continue;
        }

        if (href.startsWith("#") && !resolvesToRealAnchor($, href)) {
          emptyHrefItems.push({ text, href });
        }
      }

      // Empty / non-functional hrefs
      if (emptyHrefItems.length > 0) {
        const { shown, remaining } = capItems(emptyHrefItems);
        findings.push(
          makeFinding({
            category: "navigation",
            title: "Navigation links with empty or non-functional hrefs",
            status: "fail",
            severity: "medium",
            pageUrl: url,
            description: `${emptyHrefItems.length} navigation link${emptyHrefItems.length === 1 ? "" : "s"} have a missing, empty, "#"-only, or unresolvable same-page href.${remaining > 0 ? ` Showing first ${MAX_LISTED_ITEMS}; ${remaining} more not shown.` : ""}`,
            whyItMatters: "Links that go nowhere confuse visitors and look broken or unfinished, and can indicate incomplete implementation (e.g. a menu item left as a placeholder).",
            recommendation: "Point each navigation link to a real destination, or remove the link if it is not yet ready.",
            estimatedFixTime: "20 minutes",
            meta: { count: emptyHrefItems.length, items: shown },
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "navigation",
            title: "No empty or non-functional navigation link hrefs found",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: "All navigation links have a non-empty href pointing to a real destination or a valid same-page anchor.",
            whyItMatters: "Confirms visitors won't hit dead/placeholder links in the navigation.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }

      // javascript:void(0) hrefs
      if (jsVoidItems.length > 0) {
        const { shown, remaining } = capItems(jsVoidItems);
        findings.push(
          makeFinding({
            category: "navigation",
            title: "Navigation links using javascript: hrefs",
            status: "fail",
            severity: "low",
            pageUrl: url,
            description: `${jsVoidItems.length} navigation link${jsVoidItems.length === 1 ? "" : "s"} use a "javascript:" href (e.g. javascript:void(0)) instead of a real URL.${remaining > 0 ? ` Showing first ${MAX_LISTED_ITEMS}; ${remaining} more not shown.` : ""}`,
            whyItMatters: "javascript: hrefs break middle-click/open-in-new-tab, are not crawlable by search engines, and typically indicate the link relies entirely on JS that may fail.",
            recommendation: "Replace javascript: hrefs with a real URL where possible, or attach the behavior via an event listener on a <button> instead of an <a href>.",
            estimatedFixTime: "20 minutes",
            meta: { count: jsVoidItems.length, items: shown },
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "navigation",
            title: "No javascript: hrefs found in navigation",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: "No navigation links use a javascript: href.",
            whyItMatters: "Confirms navigation links remain crawlable and support standard browser behaviors like opening in a new tab.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }
    }

    // 7. Header/footer link reachability — how many header/footer links are broken
    const headerFooterAnchors = $(HEADER_FOOTER_SCOPE_SELECTOR).toArray();
    const uniqueHeaderFooterLinks = new Map<string, string>(); // href -> link text, deduped

    for (const el of headerFooterAnchors) {
      const $el = $(el);
      const rawHref = $el.attr("href")?.trim();
      if (!rawHref || rawHref === "#" || rawHref.startsWith("#") || /^javascript:/i.test(rawHref)) continue;
      if (rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) continue;

      let absolute: string;
      try {
        absolute = new URL(rawHref, url).toString();
      } catch {
        continue;
      }
      if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) continue;

      if (!uniqueHeaderFooterLinks.has(absolute)) {
        uniqueHeaderFooterLinks.set(absolute, $el.text().trim().replace(/\s+/g, " ").slice(0, 80) || "(no text)");
      }
    }

    if (uniqueHeaderFooterLinks.size === 0) {
      findings.push(
        makeFinding({
          category: "navigation",
          title: "No header/footer links to check for broken destinations",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "No checkable http(s) links were found inside the header or footer.",
          whyItMatters: "Not applicable.",
          recommendation: "Not applicable.",
          estimatedFixTime: "N/A",
        }),
      );
    } else {
      const allLinks = Array.from(uniqueHeaderFooterLinks.keys());
      const checkedLinks = allLinks.slice(0, MAX_CHECKED_LINKS);
      const results: LinkCheckResult[] = [];

      for (let i = 0; i < checkedLinks.length; i += FETCH_BATCH_SIZE) {
        const batch = checkedLinks.slice(i, i + FETCH_BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(checkLinkReachable));
        results.push(...batchResults);
      }

      const broken = results.filter((r) => r.outcome === "broken");
      const unknown = results.filter((r) => r.outcome === "unknown");
      const cappedNote =
        allLinks.length > MAX_CHECKED_LINKS
          ? ` Checked the first ${MAX_CHECKED_LINKS} of ${allLinks.length} unique header/footer links found.`
          : "";

      if (broken.length > 0) {
        const { shown, remaining } = capItems(
          broken.map((r) => ({
            text: uniqueHeaderFooterLinks.get(r.href) ?? "(no text)",
            href: r.href,
            status: r.status,
          })),
        );
        findings.push(
          makeFinding({
            category: "navigation",
            title: `${broken.length} of ${checkedLinks.length} header/footer links are broken`,
            status: "fail",
            severity: "high",
            pageUrl: url,
            description: `${broken.length} header/footer link${broken.length === 1 ? "" : "s"} returned an error status (4xx/5xx).${cappedNote}`,
            whyItMatters: "Header and footer links appear on every page and are among the most-clicked navigation elements — a broken one erodes trust site-wide, not just on this page.",
            recommendation: "Fix or remove each broken header/footer link so it points to a live destination.",
            estimatedFixTime: "15 minutes",
            meta: { count: broken.length, items: shown, remaining },
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "navigation",
            title: `0 of ${checkedLinks.length} header/footer links are broken`,
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: `All ${checkedLinks.length} checked header/footer link${checkedLinks.length === 1 ? "" : "s"} resolved successfully.${cappedNote}`,
            whyItMatters: "Confirms visitors won't hit dead links in the header or footer, which appear on every page.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }

      if (unknown.length > 0) {
        const { shown, remaining } = capItems(unknown.map((r) => ({ text: uniqueHeaderFooterLinks.get(r.href) ?? "(no text)", href: r.href })));
        findings.push(
          makeFinding({
            category: "navigation",
            title: "Some header/footer links could not be verified",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description: `${unknown.length} header/footer link${unknown.length === 1 ? "" : "s"} could not be reached (network error or timeout) — this may be a transient issue rather than a broken link.`,
            whyItMatters: "These links couldn't be automatically confirmed as working or broken.",
            recommendation: "Manually verify these links resolve correctly.",
            estimatedFixTime: "10 minutes",
            meta: { count: unknown.length, items: shown, remaining },
          }),
        );
      }
    }

    return findings;
  },
};
