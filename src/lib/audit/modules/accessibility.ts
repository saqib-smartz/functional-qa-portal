import { makeFinding, type AuditModule, type AuditContext, type Finding } from "@/lib/audit/types";

function capList<T>(items: T[], cap = 10): { items: T[]; truncated: boolean; totalCount: number } {
  return { items: items.slice(0, cap), truncated: items.length > cap, totalCount: items.length };
}

const NAMED_FIELD_EXCLUDED_TYPES = new Set(["hidden", "submit", "button", "reset"]);

interface ContrastIssue {
  snippet: string;
  ratio: number;
  required: number;
}

interface ContrastResult {
  sampleCount: number;
  failing: ContrastIssue[];
}

export const accessibilityModule: AuditModule = {
  category: "accessibility",
  label: "Accessibility",
  run: async (ctx: AuditContext): Promise<Finding[]> => {
    const findings: Finding[] = [];
    const $ = ctx.$;

    // --- <html lang> ---
    const lang = ($("html").attr("lang") ?? "").trim();
    findings.push(
      makeFinding({
        category: "accessibility",
        title: lang ? "<html> element has a lang attribute" : "<html> element is missing a lang attribute",
        status: lang ? "pass" : "fail",
        severity: lang ? "info" : "medium",
        pageUrl: ctx.url,
        description: lang
          ? `The <html> element declares lang="${lang}".`
          : "The <html> element has no lang attribute (or it is empty).",
        whyItMatters:
          "Screen readers use the lang attribute to select the correct pronunciation and voice; without it, page content may be read aloud in the wrong language.",
        recommendation: 'Add a lang attribute to the <html> tag, e.g. <html lang="en">.',
        estimatedFixTime: lang ? "0 minutes" : "5 minutes",
      }),
    );

    // --- Form inputs without an accessible name ---
    const labelForIds = new Set(
      $("label")
        .map((_, el) => $(el).attr("for")?.trim())
        .get()
        .filter((v): v is string => !!v),
    );
    const allIds = new Set(
      $("[id]")
        .map((_, el) => $(el).attr("id")?.trim())
        .get()
        .filter((v): v is string => !!v),
    );

    const unnamedFields: string[] = [];
    let namedFieldCount = 0;
    $("input, textarea, select").each((_, el) => {
      const node = $(el);
      const tag = el.tagName?.toLowerCase() ?? "";
      const type = (node.attr("type") ?? "text").toLowerCase();
      if (tag === "input" && NAMED_FIELD_EXCLUDED_TYPES.has(type)) return;

      namedFieldCount += 1;
      const id = node.attr("id")?.trim();
      const hasLabelFor = !!id && labelForIds.has(id);
      const hasWrappingLabel = node.closest("label").length > 0;
      const ariaLabel = (node.attr("aria-label") ?? "").trim();
      const labelledBy = (node.attr("aria-labelledby") ?? "").trim();
      const hasLabelledBy = labelledBy.split(/\s+/).filter(Boolean).some((ref) => allIds.has(ref));

      if (!hasLabelFor && !hasWrappingLabel && !ariaLabel && !hasLabelledBy) {
        const name = node.attr("name") ?? "";
        unnamedFields.push(
          `<${tag}${type && tag === "input" ? ` type="${type}"` : ""}${name ? ` name="${name}"` : ""}${id ? ` id="${id}"` : ""}>`,
        );
      }
    });
    {
      const cap = capList(unnamedFields);
      findings.push(
        makeFinding({
          category: "accessibility",
          title: unnamedFields.length === 0 ? "All form fields have an accessible name" : "Form fields missing an accessible name",
          status: unnamedFields.length === 0 ? "pass" : "fail",
          severity: unnamedFields.length === 0 ? "info" : "high",
          pageUrl: ctx.url,
          description:
            unnamedFields.length === 0
              ? `Checked ${namedFieldCount} form field(s); all have a label, aria-label, or aria-labelledby.`
              : `${unnamedFields.length} of ${namedFieldCount} form field(s) have no associated <label>, aria-label, or aria-labelledby.`,
          whyItMatters:
            "Without an accessible name, screen reader users have no way to know what a form field is for, making forms unusable (WCAG 4.1.2, 3.3.2).",
          recommendation:
            'Associate each field with a <label for="..."> (or wrap it in a <label>), or add an aria-label/aria-labelledby attribute.',
          estimatedFixTime: unnamedFields.length === 0 ? "0 minutes" : "30 minutes",
          meta: unnamedFields.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        }),
      );
    }

    // Buttons/links with no accessible name are already covered by content-quality.ts's
    // "empty clickable elements" check — not duplicated here.

    // --- Missing or multiple <h1> ---
    const h1Count = $("h1").length;
    if (h1Count === 0) {
      findings.push(
        makeFinding({
          category: "accessibility",
          title: "Page is missing an <h1> element",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: "No <h1> element was found on the page.",
          whyItMatters:
            "Screen reader users often navigate by heading landmarks and rely on the h1 to identify the page's main topic; without one, the page structure is harder to understand.",
          recommendation: "Add a single <h1> that describes the page's main content.",
          estimatedFixTime: "10 minutes",
        }),
      );
    } else if (h1Count > 1) {
      findings.push(
        makeFinding({
          category: "accessibility",
          title: "Page has multiple <h1> elements",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `Found ${h1Count} <h1> elements on the page.`,
          whyItMatters: "Multiple h1 elements confuse the page's heading landmark, making it harder for screen reader users to identify the main topic.",
          recommendation: "Use a single <h1> per page and demote the others to h2/h3 as appropriate.",
          estimatedFixTime: "15 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "accessibility",
          title: "Page has exactly one <h1> element",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: "The page has exactly one <h1> element.",
          whyItMatters: "A single h1 gives screen reader users a clear landmark for the page's main topic.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // --- Positive tabindex ---
    const positiveTabindex: string[] = [];
    $("[tabindex]").each((_, el) => {
      const node = $(el);
      const raw = node.attr("tabindex") ?? "";
      const value = Number.parseInt(raw, 10);
      if (Number.isFinite(value) && value > 0) {
        const tag = el.tagName?.toLowerCase() ?? "";
        const id = node.attr("id");
        positiveTabindex.push(`<${tag}${id ? ` id="${id}"` : ""} tabindex="${raw}">`);
      }
    });
    {
      const cap = capList(positiveTabindex);
      findings.push(
        makeFinding({
          category: "accessibility",
          title: positiveTabindex.length === 0 ? "No positive tabindex values found" : "Positive tabindex values found",
          status: positiveTabindex.length === 0 ? "pass" : "warning",
          severity: positiveTabindex.length === 0 ? "info" : "medium",
          pageUrl: ctx.url,
          description:
            positiveTabindex.length === 0
              ? "No element on the page uses a tabindex value greater than 0."
              : `${positiveTabindex.length} element(s) use a tabindex value greater than 0.`,
          whyItMatters:
            "Positive tabindex values override the natural DOM tab order, creating a confusing and unpredictable keyboard navigation experience (WCAG 2.4.3).",
          recommendation: 'Remove positive tabindex values; use tabindex="0" (to include an element in the natural order) or reorder the markup instead.',
          estimatedFixTime: positiveTabindex.length === 0 ? "0 minutes" : "20 minutes",
          meta: positiveTabindex.length
            ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount }
            : undefined,
        }),
      );
    }

    // --- Color contrast (live page) ---
    try {
      const result: ContrastResult = await ctx.page.evaluate(() => {
        function parseColor(value: string): [number, number, number] | null {
          const match = value.match(/rgba?\(([^)]+)\)/i);
          if (!match) return null;
          const parts = match[1].split(",").map((p) => Number.parseFloat(p.trim()));
          if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
          return [parts[0], parts[1], parts[2]];
        }

        function isTransparent(value: string): boolean {
          if (!value || value === "transparent") return true;
          const match = value.match(/rgba\(([^)]+)\)/i);
          if (!match) return false;
          const parts = match[1].split(",").map((p) => Number.parseFloat(p.trim()));
          return parts.length === 4 && parts[3] === 0;
        }

        function effectiveBackground(el: Element): [number, number, number] {
          let current: Element | null = el;
          while (current) {
            const bg = getComputedStyle(current).backgroundColor;
            if (!isTransparent(bg)) {
              const parsed = parseColor(bg);
              if (parsed) return parsed;
            }
            current = current.parentElement;
          }
          return [255, 255, 255];
        }

        function relativeLuminance([r, g, b]: [number, number, number]): number {
          const channel = (c: number) => {
            const v = c / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        }

        function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
          const l1 = relativeLuminance(a);
          const l2 = relativeLuminance(b);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        }

        const SAMPLE_CAP = 300;
        const elements = Array.from(document.querySelectorAll("body *")).filter((el) => {
          const text = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? "")
            .join("")
            .trim();
          if (!text) return false;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          const style = getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
          return true;
        });

        const sample = elements.slice(0, SAMPLE_CAP);
        const failing: ContrastIssue[] = [];

        for (const el of sample) {
          const style = getComputedStyle(el);
          const fg = parseColor(style.color);
          if (!fg) continue;
          const bg = effectiveBackground(el);
          const ratio = contrastRatio(fg, bg);

          const fontSize = Number.parseFloat(style.fontSize);
          const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
          const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
          const required = isLargeText ? 3 : 4.5;

          if (ratio < required) {
            const text = (el.textContent ?? "").trim().slice(0, 40);
            failing.push({ snippet: text, ratio: Math.round(ratio * 100) / 100, required });
          }
        }

        return { sampleCount: sample.length, failing };
      });

      const cap = capList(result.failing.map((f) => `"${f.snippet}" (ratio ${f.ratio}:1, needs ${f.required}:1)`));
      findings.push(
        makeFinding({
          category: "accessibility",
          title: result.failing.length === 0 ? "Text meets WCAG AA color contrast" : "Text fails WCAG AA color contrast",
          status: result.failing.length === 0 ? "pass" : "fail",
          severity: result.failing.length === 0 ? "info" : "medium",
          pageUrl: ctx.url,
          description:
            result.failing.length === 0
              ? `Sampled ${result.sampleCount} text element(s); all meet the WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text).`
              : `${result.failing.length} of ${result.sampleCount} sampled text element(s) fall below the WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text).`,
          whyItMatters:
            "Low color contrast makes text difficult or impossible to read for users with low vision or color vision deficiencies (WCAG 1.4.3).",
          recommendation: "Increase the contrast between text color and its background to meet WCAG AA thresholds.",
          estimatedFixTime: result.failing.length === 0 ? "0 minutes" : "30 minutes",
          meta: result.failing.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        }),
      );
    } catch {
      // If the live check fails for any reason, don't crash the module.
    }

    return findings;
  },
};
