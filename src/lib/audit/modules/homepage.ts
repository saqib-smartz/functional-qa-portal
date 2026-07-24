import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";

const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 160;

export const homepageModule: AuditModule = {
  category: "homepage",
  label: "Homepage",
  run: async (ctx) => {
    const findings: Finding[] = [];
    const { $, url, httpStatus } = ctx;

    // 1. Page loaded successfully
    if (httpStatus >= 200 && httpStatus < 300) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Page loaded successfully",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `The page responded with HTTP ${httpStatus}.`,
          whyItMatters: "A successful HTTP response is the baseline requirement for the page to be usable at all.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Page did not load successfully",
          status: "fail",
          severity: "critical",
          pageUrl: url,
          description: `The page responded with HTTP ${httpStatus}, which indicates an error rather than a successful page load.`,
          whyItMatters: "Visitors and search engines will see an error page instead of your content, harming both UX and SEO.",
          recommendation: "Investigate the server/application error causing this status code and resolve it.",
          estimatedFixTime: "1 hour",
        }),
      );
    }

    // 2. HTTPS enabled
    if (url.startsWith("https://")) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "HTTPS is enabled",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "The page is served over HTTPS.",
          whyItMatters: "HTTPS protects visitor data in transit and is required for modern browser features and SEO.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "HTTPS is not enabled",
          status: "fail",
          severity: "high",
          pageUrl: url,
          description: "The page was loaded over an insecure HTTP connection instead of HTTPS.",
          whyItMatters: "Without HTTPS, data can be intercepted in transit, browsers show 'Not Secure' warnings, and SEO rankings are penalized.",
          recommendation: "Obtain an SSL/TLS certificate and enforce HTTPS across the entire site with a redirect.",
          estimatedFixTime: "1 hour",
        }),
      );
    }

    // 3. Title tag
    const title = $("title").first().text().trim();
    if (title.length > 0) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Page title is present",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Title tag found: "${title}".`,
          whyItMatters: "The title tag is one of the most important on-page SEO signals and appears in browser tabs and search results.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { title },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Page title is missing",
          status: "fail",
          severity: "high",
          pageUrl: url,
          description: "No non-empty <title> element was found in the page <head>.",
          whyItMatters: "Missing titles hurt SEO and make browser tabs/search results unhelpful to users.",
          recommendation: "Add a descriptive, unique <title> tag to the page.",
          estimatedFixTime: "15 minutes",
        }),
      );
    }

    // 4. Meta description
    const description = $('meta[name="description"]').first().attr("content")?.trim() ?? "";
    if (!description) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Meta description is missing",
          status: "fail",
          severity: "medium",
          pageUrl: url,
          description: "No <meta name=\"description\"> tag was found.",
          whyItMatters: "Meta descriptions influence click-through rate from search results even though they aren't a direct ranking factor.",
          recommendation: "Add a unique, compelling meta description between roughly 50 and 160 characters.",
          estimatedFixTime: "15 minutes",
        }),
      );
    } else if (description.length < MIN_DESCRIPTION_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Meta description length is not ideal",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: `Meta description is ${description.length} characters long (recommended range is ~${MIN_DESCRIPTION_LENGTH}-${MAX_DESCRIPTION_LENGTH}).`,
          whyItMatters: "Descriptions that are too short waste an opportunity to sell the click; too long ones get truncated in search results.",
          recommendation: "Rewrite the meta description to fall within the recommended length range.",
          estimatedFixTime: "10 minutes",
          meta: { description, length: description.length },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Meta description is present and well-sized",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Meta description is ${description.length} characters long: "${description}".`,
          whyItMatters: "A well-sized meta description improves click-through rate from search results.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 5. Exactly one H1
    const h1Count = $("h1").length;
    if (h1Count === 1) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Exactly one <h1> element found",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "The page contains exactly one <h1> heading, as recommended.",
          whyItMatters: "A single, clear H1 helps both users and search engines understand the primary topic of the page.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else if (h1Count === 0) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "No <h1> element found",
          status: "fail",
          severity: "medium",
          pageUrl: url,
          description: "The page does not contain any <h1> heading.",
          whyItMatters: "Missing H1s reduce clarity for screen reader users and can weaken SEO relevance signals.",
          recommendation: "Add a single, descriptive <h1> that reflects the page's main topic.",
          estimatedFixTime: "15 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Multiple <h1> elements found",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: `Found ${h1Count} <h1> elements on the page; best practice is a single H1 per page.`,
          whyItMatters: "Multiple H1s can dilute topical relevance signals and confuse the document outline for assistive technology.",
          recommendation: "Consolidate to a single <h1> and demote the others to <h2>/<h3> as appropriate.",
          estimatedFixTime: "15 minutes",
          meta: { h1Count },
        }),
      );
    }

    // 6. Canonical link
    const canonical = $('link[rel="canonical"]').first().attr("href");
    if (canonical) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Canonical link tag is present",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Canonical URL is set to: ${canonical}.`,
          whyItMatters: "Canonical tags prevent duplicate-content SEO issues by telling search engines which URL is authoritative.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Canonical link tag is missing",
          status: "warning",
          severity: "medium",
          pageUrl: url,
          description: "No <link rel=\"canonical\"> tag was found in the page <head>.",
          whyItMatters: "Without a canonical tag, search engines may index duplicate or parameterized versions of the page instead of the intended one.",
          recommendation: "Add a self-referencing <link rel=\"canonical\"> tag pointing to the preferred URL.",
          estimatedFixTime: "15 minutes",
        }),
      );
    }

    // 7. Open Graph tags
    const ogTitle = $('meta[property="og:title"]').first().attr("content");
    const ogDescription = $('meta[property="og:description"]').first().attr("content");
    const ogImage = $('meta[property="og:image"]').first().attr("content");
    const missingOg: string[] = [];
    if (!ogTitle) missingOg.push("og:title");
    if (!ogDescription) missingOg.push("og:description");
    if (!ogImage) missingOg.push("og:image");

    if (missingOg.length === 0) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Open Graph tags are present",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "og:title, og:description, and og:image are all present.",
          whyItMatters: "Open Graph tags control how the page appears when shared on social platforms like Facebook and LinkedIn.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Open Graph tags are incomplete",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: `Missing Open Graph tag(s): ${missingOg.join(", ")}.`,
          whyItMatters: "Incomplete Open Graph data leads to poor-looking or blank previews when the page is shared on social media.",
          recommendation: "Add the missing og: meta tags to the page <head>.",
          estimatedFixTime: "15 minutes",
          meta: { missing: missingOg },
        }),
      );
    }

    // 8. Twitter Card
    const twitterCard = $('meta[name="twitter:card"]').first().attr("content");
    if (twitterCard) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Twitter Card meta tag is present",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `twitter:card is set to "${twitterCard}".`,
          whyItMatters: "Twitter Card tags control how the page renders when shared on X/Twitter.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Twitter Card meta tag is missing",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "No <meta name=\"twitter:card\"> tag was found.",
          whyItMatters: "Without a Twitter Card tag, shared links on X/Twitter fall back to a generic, less engaging preview.",
          recommendation: "Add a twitter:card meta tag (e.g. \"summary_large_image\").",
          estimatedFixTime: "15 minutes",
        }),
      );
    }

    // 9. Favicon
    const faviconLink = $('link[rel~="icon"]').first().attr("href");
    if (faviconLink) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "Favicon is present",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Favicon link found: ${faviconLink}.`,
          whyItMatters: "A favicon reinforces brand identity in browser tabs, bookmarks, and history.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      try {
        const faviconRes = await fetch(new URL("/favicon.ico", url), { signal: AbortSignal.timeout(6000) });
        if (faviconRes.ok) {
          findings.push(
            makeFinding({
              category: "homepage",
              title: "Favicon is present (default path)",
              status: "pass",
              severity: "info",
              pageUrl: url,
              description: "No <link rel=\"icon\"> tag was found, but /favicon.ico resolves successfully.",
              whyItMatters: "A favicon reinforces brand identity in browser tabs, bookmarks, and history.",
              recommendation: "Consider adding an explicit <link rel=\"icon\"> tag for broader browser/device support.",
              estimatedFixTime: "10 minutes",
            }),
          );
        } else {
          findings.push(
            makeFinding({
              category: "homepage",
              title: "Favicon is missing",
              status: "warning",
              severity: "low",
              pageUrl: url,
              description: "No favicon <link> tag was found and /favicon.ico is not reachable.",
              whyItMatters: "Missing favicons make the site look unfinished in browser tabs and bookmarks.",
              recommendation: "Add a favicon and reference it with a <link rel=\"icon\"> tag.",
              estimatedFixTime: "15 minutes",
            }),
          );
        }
      } catch {
        findings.push(
          makeFinding({
            category: "homepage",
            title: "Favicon could not be verified",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description: "No favicon <link> tag was found and /favicon.ico could not be checked (network error).",
            whyItMatters: "Missing favicons make the site look unfinished in browser tabs and bookmarks.",
            recommendation: "Add a favicon and reference it with a <link rel=\"icon\"> tag.",
            estimatedFixTime: "15 minutes",
          }),
        );
      }
    }

    // 10. robots.txt
    try {
      const robotsRes = await fetch(new URL("/robots.txt", url), { signal: AbortSignal.timeout(6000) });
      if (robotsRes.ok) {
        findings.push(
          makeFinding({
            category: "homepage",
            title: "robots.txt is reachable",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: `/robots.txt responded with HTTP ${robotsRes.status}.`,
            whyItMatters: "robots.txt guides search engine crawlers on what they may and may not crawl.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "homepage",
            title: "robots.txt is not reachable",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description: `/robots.txt responded with HTTP ${robotsRes.status}.`,
            whyItMatters: "Without a robots.txt, crawl behavior defaults to crawling everything, which may not be desired for staging or admin paths.",
            recommendation: "Add a robots.txt file at the site root.",
            estimatedFixTime: "15 minutes",
          }),
        );
      }
    } catch {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "robots.txt could not be verified",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "/robots.txt could not be fetched due to a network error.",
          whyItMatters: "Without a robots.txt, crawl behavior defaults to crawling everything, which may not be desired for staging or admin paths.",
          recommendation: "Verify manually that /robots.txt is reachable and correctly configured.",
          estimatedFixTime: "15 minutes",
        }),
      );
    }

    // 11. JSON-LD structured data
    const jsonLdScripts = $('script[type="application/ld+json"]');
    if (jsonLdScripts.length === 0) {
      findings.push(
        makeFinding({
          category: "homepage",
          title: "No JSON-LD structured data found",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "No <script type=\"application/ld+json\"> blocks were found on the page.",
          whyItMatters: "Structured data helps search engines understand page content and can enable rich results.",
          recommendation: "Add relevant JSON-LD structured data (e.g. Organization, WebSite, or content-type-specific schema).",
          estimatedFixTime: "30 minutes",
        }),
      );
    } else {
      let validCount = 0;
      const invalidExamples: string[] = [];
      jsonLdScripts.each((_, el) => {
        const raw = $(el).contents().text().trim();
        try {
          JSON.parse(raw);
          validCount += 1;
        } catch {
          if (invalidExamples.length < 10) {
            invalidExamples.push(raw.slice(0, 120));
          }
        }
      });

      findings.push(
        makeFinding({
          category: "homepage",
          title: "JSON-LD structured data found",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Found ${jsonLdScripts.length} JSON-LD block(s), ${validCount} of which parsed as valid JSON.`,
          whyItMatters: "Structured data helps search engines understand page content and can enable rich results.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );

      if (invalidExamples.length > 0) {
        const truncated = jsonLdScripts.length - validCount > invalidExamples.length;
        findings.push(
          makeFinding({
            category: "homepage",
            title: "Some JSON-LD blocks contain invalid JSON",
            status: "warning",
            severity: "medium",
            pageUrl: url,
            description: `${invalidExamples.length} JSON-LD block(s) failed to parse as valid JSON.${truncated ? " (showing first 10)" : ""}`,
            whyItMatters: "Invalid JSON-LD is silently ignored by search engines, wasting the effort of adding structured data.",
            recommendation: "Validate JSON-LD blocks with a linter and fix any syntax errors.",
            estimatedFixTime: "30 minutes",
            meta: { items: invalidExamples },
          }),
        );
      }
    }

    return findings;
  },
};
