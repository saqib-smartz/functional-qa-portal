import { makeFinding, type AuditModule, type AuditContext, type Finding } from "@/lib/audit/types";

const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/g;
const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PLACEHOLDER_RE = /(lorem ipsum|your text here|placeholder text|sample text)/i;

const MAX_EMPTY_SECTIONS_CHECKED = 500; // guard against pathological pages
const EMPTY_SECTION_SELECTOR = 'section, div[class*="content"], div[class*="Content"]';

function capList<T>(items: T[], cap = 10): { items: T[]; truncated: boolean; totalCount: number } {
  return { items: items.slice(0, cap), truncated: items.length > cap, totalCount: items.length };
}

function isTextNode(node: unknown): node is { type: string; data: string } {
  return typeof node === "object" && node !== null && (node as { type?: unknown }).type === "text";
}

export const contentQualityModule: AuditModule = {
  category: "content-quality",
  label: "Content Quality",
  run: async (ctx: AuditContext): Promise<Finding[]> => {
    const findings: Finding[] = [];
    const $ = ctx.$;

    // --- Empty clickable elements (button / link role, no text, no accessible name) ---
    const emptyClickables: string[] = [];
    $("button, a[href]").each((_, el) => {
      const node = $(el);
      const text = node.text().trim();
      const ariaLabel = node.attr("aria-label")?.trim();
      const title = node.attr("title")?.trim();
      const hasAccessibleImage = node.find("img[alt]").toArray().some((img) => ($(img).attr("alt") ?? "").trim().length > 0);
      if (text === "" && !ariaLabel && !title && !hasAccessibleImage) {
        const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "element";
        const href = node.attr("href");
        emptyClickables.push(href ? `<${tag} href="${href}">` : `<${tag}> (no href)`);
      }
    });
    {
      const cap = capList(emptyClickables);
      findings.push(
        makeFinding({
          category: "content-quality",
          title: emptyClickables.length === 0 ? "No empty clickable elements found" : "Empty buttons or links found",
          status: emptyClickables.length === 0 ? "pass" : "warning",
          severity: emptyClickables.length === 0 ? "info" : "medium",
          pageUrl: ctx.url,
          description:
            emptyClickables.length === 0
              ? "All buttons and links have visible text or an accessible name."
              : `${emptyClickables.length} button(s)/link(s) have no visible text and no aria-label/title, so their purpose is unclear.`,
          whyItMatters:
            "Buttons and links without an accessible name are unusable for screen reader users and confusing for everyone else.",
          recommendation: "Add visible text, an aria-label, or a title attribute describing the control's purpose.",
          estimatedFixTime: emptyClickables.length === 0 ? "0 minutes" : "20 minutes",
          meta: emptyClickables.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- Non-clickable phone numbers / emails: walk text nodes, skip those inside tel:/mailto: anchors ---
    const looseNumbers = new Set<string>();
    const looseEmails = new Set<string>();

    $("body")
      .find("*")
      .addBack()
      .each((_, el) => {
        const tag = (el as { tagName?: string }).tagName?.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "noscript" || tag === "textarea") return;

        $(el)
          .contents()
          .each((__, child) => {
            if (!isTextNode(child)) return;
            const text = child.data;
            if (!text || !text.trim()) return;

            const $el = $(el);
            const insideTel = $el.closest('a[href^="tel:" i]').length > 0;
            const insideMailto = $el.closest('a[href^="mailto:" i]').length > 0;

            if (!insideTel) {
              const matches = text.match(PHONE_RE);
              if (matches) {
                for (const m of matches) {
                  const digits = m.replace(/\D/g, "");
                  if (digits.length >= 8) looseNumbers.add(m.trim());
                }
              }
            }
            if (!insideMailto) {
              const matches = text.match(EMAIL_RE);
              if (matches) {
                for (const m of matches) looseEmails.add(m.trim());
              }
            }
          });
      });

    {
      const items = Array.from(looseNumbers);
      const cap = capList(items);
      findings.push(
        makeFinding({
          category: "content-quality",
          title: items.length === 0 ? "No non-clickable phone numbers found" : "Phone numbers not clickable",
          status: items.length === 0 ? "pass" : "warning",
          severity: items.length === 0 ? "info" : "low",
          pageUrl: ctx.url,
          description:
            items.length === 0
              ? "No plain-text phone numbers were found outside of tel: links."
              : `${items.length} phone number(s) appear in page text but aren't wrapped in a tel: link.`,
          whyItMatters:
            "Non-clickable phone numbers force mobile users to manually copy and dial the number instead of tapping to call.",
          recommendation: 'Wrap phone numbers in <a href="tel:+1234567890">...</a> so mobile users can tap to call.',
          estimatedFixTime: items.length === 0 ? "0 minutes" : "20 minutes",
          meta: items.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    {
      const items = Array.from(looseEmails);
      const cap = capList(items);
      findings.push(
        makeFinding({
          category: "content-quality",
          title: items.length === 0 ? "No non-clickable email addresses found" : "Email addresses not clickable",
          status: items.length === 0 ? "pass" : "warning",
          severity: items.length === 0 ? "info" : "low",
          pageUrl: ctx.url,
          description:
            items.length === 0
              ? "No plain-text email addresses were found outside of mailto: links."
              : `${items.length} email address(es) appear in page text but aren't wrapped in a mailto: link.`,
          whyItMatters: "Non-clickable emails add friction, requiring users to copy and paste the address into their mail client manually.",
          recommendation: 'Wrap email addresses in <a href="mailto:address@example.com">...</a>.',
          estimatedFixTime: items.length === 0 ? "0 minutes" : "20 minutes",
          meta: items.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- Placeholder / Lorem Ipsum text ---
    const bodyText = $("body").text();
    const hasPlaceholder = PLACEHOLDER_RE.test(bodyText);
    const placeholderMatches = Array.from(new Set((bodyText.match(new RegExp(PLACEHOLDER_RE.source, "gi")) ?? [])));
    findings.push(
      makeFinding({
        category: "content-quality",
        title: hasPlaceholder ? "Placeholder/Lorem Ipsum text found on the page" : "No placeholder text found",
        status: hasPlaceholder ? "fail" : "pass",
        severity: hasPlaceholder ? "high" : "info",
        pageUrl: ctx.url,
        description: hasPlaceholder
          ? `Found placeholder-style text on the live page: ${placeholderMatches.slice(0, 5).join(", ")}.`
          : "No Lorem Ipsum or other common placeholder text was found in the page content.",
        whyItMatters:
          "Placeholder text left in production content looks unfinished and unprofessional, and may indicate an incomplete page build.",
        recommendation: "Replace placeholder text with final, reviewed copy.",
        estimatedFixTime: hasPlaceholder ? "30 minutes" : "0 minutes",
        meta: hasPlaceholder ? { items: placeholderMatches.slice(0, 10) } : undefined,
      })
    );

    // --- Empty sections/containers ---
    const candidates = $(EMPTY_SECTION_SELECTOR).toArray().slice(0, MAX_EMPTY_SECTIONS_CHECKED);
    const emptySections: string[] = [];
    for (const el of candidates) {
      const node = $(el);
      if (node.text().trim().length === 0 && node.find("img").length === 0) {
        const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "element";
        const cls = node.attr("class");
        emptySections.push(cls ? `<${tag} class="${cls}">` : `<${tag}>`);
      }
    }
    {
      const cap = capList(emptySections);
      findings.push(
        makeFinding({
          category: "content-quality",
          title: emptySections.length === 0 ? "No empty content sections found" : "Empty sections/containers found",
          status: emptySections.length === 0 ? "pass" : "warning",
          severity: emptySections.length === 0 ? "info" : "low",
          pageUrl: ctx.url,
          description:
            emptySections.length === 0
              ? "No <section> or content container elements were found completely empty of text and images."
              : `${emptySections.length} <section>/content container element(s) appear to have no text and no images.`,
          whyItMatters:
            "Empty content blocks are usually leftover template markup or an unfinished page builder section, and can create odd blank gaps in the layout.",
          recommendation: "Remove the empty section, or populate it with the intended content.",
          estimatedFixTime: emptySections.length === 0 ? "0 minutes" : "15 minutes",
          meta: emptySections.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    return findings;
  },
};
