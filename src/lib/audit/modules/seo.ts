import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";

const TITLE_IDEAL_MIN = 50;
const TITLE_IDEAL_MAX = 60;
const TITLE_ACCEPTABLE_MIN = 30;
const TITLE_ACCEPTABLE_MAX = 65;

const DESC_IDEAL_MIN = 120;
const DESC_IDEAL_MAX = 158;

export const seoModule: AuditModule = {
  category: "seo",
  label: "SEO",
  run: async (ctx) => {
    const findings: Finding[] = [];
    const { $, url } = ctx;

    // 1. Title length heuristic
    const title = $("title").first().text().trim();
    if (title.length === 0) {
      // homepage.ts already flags a missing title as a failure; skip duplicating that here.
    } else if (title.length < TITLE_ACCEPTABLE_MIN || title.length > TITLE_ACCEPTABLE_MAX) {
      findings.push(
        makeFinding({
          category: "seo",
          title: "Title tag length is outside the SEO-friendly range",
          status: "warning",
          severity: "medium",
          pageUrl: url,
          description: `Title is ${title.length} characters. Search engines typically display ${TITLE_IDEAL_MIN}-${TITLE_IDEAL_MAX} characters before truncating.`,
          whyItMatters: "Titles that are too short waste valuable keyword real estate; titles that are too long get truncated in search results, hiding key information.",
          recommendation: `Rewrite the title to fall within roughly ${TITLE_IDEAL_MIN}-${TITLE_IDEAL_MAX} characters while keeping it descriptive and unique.`,
          estimatedFixTime: "15 minutes",
          meta: { title, length: title.length },
        }),
      );
    } else if (title.length < TITLE_IDEAL_MIN || title.length > TITLE_IDEAL_MAX) {
      findings.push(
        makeFinding({
          category: "seo",
          title: "Title tag length is acceptable but not ideal",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Title is ${title.length} characters, within acceptable range but outside the ideal ${TITLE_IDEAL_MIN}-${TITLE_IDEAL_MAX} window.`,
          whyItMatters: "Titles near the ideal length maximize visibility in search results without being truncated.",
          recommendation: `Consider tightening the title toward ${TITLE_IDEAL_MIN}-${TITLE_IDEAL_MAX} characters for optimal display.`,
          estimatedFixTime: "10 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "seo",
          title: "Title tag length is SEO-friendly",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Title is ${title.length} characters, within the ideal ${TITLE_IDEAL_MIN}-${TITLE_IDEAL_MAX} range.`,
          whyItMatters: "A well-sized title displays fully in search results without truncation.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 2. Meta description length heuristic
    const descriptions = $('meta[name="description"]');
    const description = descriptions.first().attr("content")?.trim() ?? "";
    if (description) {
      if (description.length < DESC_IDEAL_MIN || description.length > DESC_IDEAL_MAX) {
        findings.push(
          makeFinding({
            category: "seo",
            title: "Meta description length is not optimal for search snippets",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description: `Meta description is ${description.length} characters; ideal range for search snippets is roughly ${DESC_IDEAL_MIN}-${DESC_IDEAL_MAX}.`,
            whyItMatters: "Descriptions outside this range are either too thin to be persuasive or get cut off in the search results snippet.",
            recommendation: `Rewrite the meta description to land closer to ${DESC_IDEAL_MIN}-${DESC_IDEAL_MAX} characters.`,
            estimatedFixTime: "15 minutes",
            meta: { length: description.length },
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "seo",
            title: "Meta description length is optimal for search snippets",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: `Meta description is ${description.length} characters, within the ideal ${DESC_IDEAL_MIN}-${DESC_IDEAL_MAX} range.`,
            whyItMatters: "A well-sized description maximizes the chance of showing a full, compelling snippet in search results.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }
    }

    // 3. Duplicate meta tags
    const duplicateChecks: Array<{ selector: string; label: string }> = [
      { selector: 'meta[name="description"]', label: 'meta[name="description"]' },
      { selector: 'meta[name="viewport"]', label: 'meta[name="viewport"]' },
      { selector: 'link[rel="canonical"]', label: 'link[rel="canonical"]' },
    ];
    const duplicated: string[] = [];
    for (const check of duplicateChecks) {
      const count = $(check.selector).length;
      if (count > 1) {
        duplicated.push(`${check.label} (${count} occurrences)`);
      }
    }

    if (duplicated.length > 0) {
      findings.push(
        makeFinding({
          category: "seo",
          title: "Duplicate SEO-critical meta tags found",
          status: "warning",
          severity: "medium",
          pageUrl: url,
          description: `Found duplicated tags that should appear at most once: ${duplicated.slice(0, 10).join(", ")}.`,
          whyItMatters: "Search engines can behave unpredictably when multiple conflicting values are provided for the same tag, potentially ignoring both.",
          recommendation: "Remove duplicate tags so each appears exactly once in the <head>.",
          estimatedFixTime: "15 minutes",
          meta: { items: duplicated.slice(0, 10) },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "seo",
          title: "No duplicate SEO-critical meta tags found",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "Description, viewport, and canonical tags each appear at most once.",
          whyItMatters: "Unique, unambiguous meta tags ensure search engines interpret page signals correctly.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 4. Canonical URL correctness
    const canonicalHref = $('link[rel="canonical"]').first().attr("href");
    if (canonicalHref) {
      try {
        const canonicalUrl = new URL(canonicalHref, url);
        const pageUrlObj = new URL(url);
        const sameOrigin = canonicalUrl.origin === pageUrlObj.origin;
        const samePath =
          canonicalUrl.pathname.replace(/\/$/, "") === pageUrlObj.pathname.replace(/\/$/, "");

        if (!sameOrigin || !samePath) {
          findings.push(
            makeFinding({
              category: "seo",
              title: "Canonical URL points to a different page",
              status: "warning",
              severity: "high",
              pageUrl: url,
              description: `Canonical URL resolves to "${canonicalUrl.href}", which does not match the current page's origin/path ("${pageUrlObj.href}").`,
              whyItMatters: "A canonical pointing to a different page tells search engines to index that other page instead of this one, which can remove this page from search results entirely.",
              recommendation: "Verify this is intentional; if not, correct the canonical tag to reference this page's own URL.",
              estimatedFixTime: "15 minutes",
              meta: { canonical: canonicalUrl.href, pageUrl: pageUrlObj.href },
            }),
          );
        } else {
          findings.push(
            makeFinding({
              category: "seo",
              title: "Canonical URL correctly references this page",
              status: "pass",
              severity: "info",
              pageUrl: url,
              description: `Canonical URL "${canonicalUrl.href}" matches the current page's origin and path.`,
              whyItMatters: "A self-referencing canonical avoids duplicate-content confusion for search engines.",
              recommendation: "No action needed.",
              estimatedFixTime: "0 minutes",
            }),
          );
        }
      } catch {
        findings.push(
          makeFinding({
            category: "seo",
            title: "Canonical URL is malformed",
            status: "warning",
            severity: "medium",
            pageUrl: url,
            description: `Canonical href "${canonicalHref}" could not be resolved to a valid absolute URL.`,
            whyItMatters: "A malformed canonical tag is likely to be ignored or misinterpreted by search engines.",
            recommendation: "Fix the canonical tag to contain a valid absolute URL.",
            estimatedFixTime: "15 minutes",
          }),
        );
      }
    }

    // 5. Heading hierarchy sanity (SEO-level, lightweight)
    const headingTags = $("h1, h2, h3, h4, h5, h6")
      .map((_, el) => el.tagName.toLowerCase())
      .get();
    const firstH2Or1Index = headingTags.findIndex((tag) => tag === "h1" || tag === "h2");
    const firstH3PlusIndex = headingTags.findIndex((tag) => /^h[3-6]$/.test(tag));

    if (firstH3PlusIndex !== -1 && (firstH2Or1Index === -1 || firstH3PlusIndex < firstH2Or1Index)) {
      findings.push(
        makeFinding({
          category: "seo",
          title: "Heading hierarchy skips levels near the top of the page",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "An h3 (or deeper) heading appears before any h1/h2 heading in the document.",
          whyItMatters: "Search engines use heading order as a signal of content structure; skipping levels can dilute the perceived topical hierarchy.",
          recommendation: "Reorder headings so h1/h2 establish top-level structure before more specific h3+ subheadings appear.",
          estimatedFixTime: "20 minutes",
        }),
      );
    } else if (headingTags.length > 0) {
      findings.push(
        makeFinding({
          category: "seo",
          title: "Heading hierarchy order looks sane",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "No h3+ heading was found appearing before a top-level h1/h2 heading.",
          whyItMatters: "A sensible heading order helps search engines interpret the page's content structure.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 6. Structured data validity (independent check, SEO framing)
    const jsonLdScripts = $('script[type="application/ld+json"]');
    if (jsonLdScripts.length > 0) {
      let validCount = 0;
      const types: string[] = [];
      jsonLdScripts.each((_, el) => {
        const raw = $(el).contents().text().trim();
        try {
          const parsed: unknown = JSON.parse(raw);
          validCount += 1;
          if (parsed && typeof parsed === "object") {
            const maybeType = (parsed as Record<string, unknown>)["@type"];
            if (typeof maybeType === "string") types.push(maybeType);
          }
        } catch {
          // invalid JSON is already surfaced by homepage.ts; no need to duplicate here
        }
      });

      if (validCount > 0) {
        findings.push(
          makeFinding({
            category: "seo",
            title: "Structured data schema types detected",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description:
              types.length > 0
                ? `Detected structured data type(s): ${types.slice(0, 10).join(", ")}.`
                : `${validCount} valid JSON-LD block(s) found, but no @type field could be identified.`,
            whyItMatters: "Recognized schema.org types make the page eligible for enhanced search result presentations (rich results).",
            recommendation: "Ensure the schema types used are appropriate for this page's content (e.g. Article, Product, Organization).",
            estimatedFixTime: "0 minutes",
            meta: { types: types.slice(0, 10) },
          }),
        );
      }
    } else {
      findings.push(
        makeFinding({
          category: "seo",
          title: "No structured data available for rich results",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "No JSON-LD structured data was found, so this page cannot qualify for schema-based rich search results.",
          whyItMatters: "Structured data increases eligibility for rich results (star ratings, breadcrumbs, sitelinks) which can improve click-through rate.",
          recommendation: "Add JSON-LD structured data appropriate to the page's content type.",
          estimatedFixTime: "30 minutes",
        }),
      );
    }

    return findings;
  },
};
