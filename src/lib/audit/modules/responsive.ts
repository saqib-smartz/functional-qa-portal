import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT, TABLET_VIEWPORT } from "@/lib/audit/fetch-page";
import { captureScreenshot } from "@/lib/audit/screenshots";
import { makeFinding, type AuditContext, type AuditModule, type Finding } from "@/lib/audit/types";

/** Summary of a boolean-ish overflow heuristic sampled against a capped element set. */
interface OverflowSummary {
  count: number;
  total: number;
  examples: string[];
}

interface ImageStretchSummary {
  count: number;
  total: number;
  examples: string[];
}

interface ClippedTextSummary {
  count: number;
  examples: string[];
}

interface OverlapSummary {
  count: number;
  examples: string[];
}

interface EmptySpacingSummary {
  count: number;
  examples: string[];
}

/** Everything the in-page layout heuristics report back for a single viewport. */
interface ViewportLayoutResult {
  scrollWidth: number;
  clientWidth: number;
  hasHorizontalScroll: boolean;
  overflowingElements: OverflowSummary;
  overflowingButtons: OverflowSummary;
  stretchedImages: ImageStretchSummary;
  clippedText: ClippedTextSummary;
  overlappingElements: OverlapSummary;
  emptySpacing: EmptySpacingSummary;
}

type ViewportKey = "tablet" | "mobile";

/** Runs all layout heuristics against the page at its *current* viewport size. */
async function analyzeViewportLayout(page: AuditContext["page"]): Promise<ViewportLayoutResult> {
  return page.evaluate((): ViewportLayoutResult => {
    /**
     * Builds a selector that's always valid to paste into DevTools (Elements panel search,
     * or `document.querySelector(...)` in the Console) — capped by class *count*, not string
     * length, so it's never cut mid-class-name into something unusable.
     */
    function selectorFor(el: Element): string {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${CSS.escape(el.id)}` : "";
      let cls = "";
      if (typeof el.className === "string" && el.className.trim().length > 0) {
        const classes = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 4);
        if (classes.length > 0) {
          cls = "." + classes.map((c) => CSS.escape(c)).join(".");
        }
      }
      return `${tag}${id}${cls}`;
    }

    const docEl = document.documentElement;
    const scrollWidth = docEl.scrollWidth;
    const clientWidth = docEl.clientWidth;
    const hasHorizontalScroll = scrollWidth > clientWidth + 1;
    const viewportWidth = window.innerWidth;

    // --- Generic overflowing elements ---
    const sampled = Array.from(document.querySelectorAll("img, button, a, input, h1, h2, h3, p")).slice(0, 300);
    const overflowingEls: Element[] = [];
    for (const el of sampled) {
      const rect = el.getBoundingClientRect();
      if (rect.right > viewportWidth + 2) overflowingEls.push(el);
    }

    // --- Buttons/CTAs overflowing the viewport ---
    const buttonEls = Array.from(document.querySelectorAll("button, a.button, .btn, [role=button]")).slice(0, 300);
    const overflowingButtons: Element[] = [];
    for (const el of buttonEls) {
      const rect = el.getBoundingClientRect();
      if (rect.right > viewportWidth + 2) overflowingButtons.push(el);
    }

    // --- Cropped/stretched images ---
    const imgs = Array.from(document.querySelectorAll("img"));
    const stretched: Element[] = [];
    for (const el of imgs) {
      const img = el as HTMLImageElement;
      if (img.naturalWidth === 0 || img.naturalHeight === 0) continue;
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const naturalRatio = img.naturalWidth / img.naturalHeight;
      const renderedRatio = rect.width / rect.height;
      const diff = Math.abs(renderedRatio - naturalRatio) / naturalRatio;
      if (diff > 0.15) stretched.push(img);
    }

    // --- Clipped text ---
    const textCandidates = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, p, span, a, li, td, button"),
    ).slice(0, 300);
    const clipped: Element[] = [];
    for (const el of textCandidates) {
      const htmlEl = el as HTMLElement;
      const overflowsBox =
        htmlEl.scrollWidth > htmlEl.clientWidth + 2 || htmlEl.scrollHeight > htmlEl.clientHeight + 2;
      if (!overflowsBox) continue;
      const style = window.getComputedStyle(htmlEl);
      if (style.overflow === "hidden") clipped.push(htmlEl);
    }

    // --- Overlapping elements ---
    const overlapCandidates = Array.from(
      document.querySelectorAll("h1, h2, h3, button, img, a.button, .btn"),
    ).slice(0, 60);
    const visibleRects: { el: Element; rect: DOMRect }[] = [];
    for (const el of overlapCandidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) visibleRects.push({ el, rect });
    }
    let overlapCount = 0;
    const overlapExamples: string[] = [];
    for (let i = 0; i < visibleRects.length; i++) {
      for (let j = i + 1; j < visibleRects.length; j++) {
        const a = visibleRects[i];
        const b = visibleRects[j];
        const xOverlap = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const yOverlap = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (xOverlap <= 0 || yOverlap <= 0) continue;
        const overlapArea = xOverlap * yOverlap;
        const areaA = a.rect.width * a.rect.height;
        const areaB = b.rect.width * b.rect.height;
        const smallerArea = Math.min(areaA, areaB);
        if (smallerArea <= 0) continue;
        if (overlapArea / smallerArea > 0.4) {
          overlapCount += 1;
          if (overlapExamples.length < 5) {
            overlapExamples.push(`${selectorFor(a.el)} overlaps ${selectorFor(b.el)}`);
          }
        }
      }
    }

    // --- Empty spacing blocks ---
    const blockCandidates = Array.from(
      document.querySelectorAll("div, section, header, footer, aside, article"),
    ).slice(0, 300);
    const emptyBlocks: Element[] = [];
    for (const el of blockCandidates) {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      if (rect.height <= 150) continue;
      const text = (htmlEl.textContent ?? "").trim();
      if (text.length > 0) continue;
      if (htmlEl.querySelector("img, svg, canvas, video")) continue;
      const style = window.getComputedStyle(htmlEl);
      if (style.backgroundImage && style.backgroundImage !== "none") continue;
      emptyBlocks.push(htmlEl);
    }

    return {
      scrollWidth,
      clientWidth,
      hasHorizontalScroll,
      overflowingElements: {
        count: overflowingEls.length,
        total: sampled.length,
        examples: overflowingEls.slice(0, 10).map(selectorFor),
      },
      overflowingButtons: {
        count: overflowingButtons.length,
        total: buttonEls.length,
        examples: overflowingButtons.slice(0, 10).map(selectorFor),
      },
      stretchedImages: {
        count: stretched.length,
        total: imgs.length,
        examples: stretched.slice(0, 10).map(selectorFor),
      },
      clippedText: {
        count: clipped.length,
        examples: clipped.slice(0, 10).map(selectorFor),
      },
      overlappingElements: {
        count: overlapCount,
        examples: overlapExamples,
      },
      emptySpacing: {
        count: emptyBlocks.length,
        examples: emptyBlocks.slice(0, 5).map(selectorFor),
      },
    };
  });
}

function withMoreNote(examples: string[], total: number): string[] {
  if (total <= examples.length) return examples;
  return [...examples, `…and ${total - examples.length} more`];
}

/** Builds the Finding[] for a single viewport from its layout heuristics result. */
function buildViewportFindings(
  ctx: AuditContext,
  viewport: ViewportKey,
  result: ViewportLayoutResult,
): Finding[] {
  const findings: Finding[] = [];
  const viewportLabel = viewport === "tablet" ? "tablet" : "mobile";
  // Fall back to undefined (rather than an empty string) if this viewport's screenshot
  // capture failed, so findings never carry a broken/empty image reference.
  const screenshot = ctx.screenshots[viewport] || undefined;
  const { url } = ctx;

  // 1. Horizontal scrolling
  if (result.hasHorizontalScroll) {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `Horizontal scrolling on ${viewportLabel}`,
        status: "fail",
        severity: "high",
        pageUrl: url,
        description: `The page content is wider (${result.scrollWidth}px) than the ${viewportLabel} viewport (${result.clientWidth}px), causing horizontal scroll.`,
        whyItMatters:
          "Horizontal scrolling on mobile/tablet is a strong signal of a broken responsive layout and forces visitors to pan sideways to read content.",
        recommendation:
          "Find the element(s) causing the overflow (fixed widths, unwrapped tables/pre blocks, negative margins) and constrain them to 100% of the viewport width.",
        estimatedFixTime: "1 hour",
        screenshot,
      }),
    );
  } else {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `No horizontal scrolling on ${viewportLabel}`,
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: `Document width (${result.scrollWidth}px) matches the ${viewportLabel} viewport (${result.clientWidth}px).`,
        whyItMatters: "Content that fits the viewport width avoids awkward sideways scrolling.",
        recommendation: "No action needed.",
        estimatedFixTime: "0 minutes",
      }),
    );
  }

  // 2. Generic overflowing elements
  const { overflowingElements } = result;
  if (overflowingElements.count > 0) {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `Elements overflow the viewport on ${viewportLabel}`,
        status: "fail",
        severity: "medium",
        pageUrl: url,
        description: `${overflowingElements.count} of ${overflowingElements.total} sampled elements (images, buttons, links, inputs, headings, paragraphs) extend past the right edge of the ${viewportLabel} viewport.`,
        whyItMatters:
          "Elements that spill past the viewport edge are often clipped, unreadable, or unreachable, and indicate the layout hasn't adapted to this screen size.",
        recommendation: "Audit the flagged elements for fixed widths/margins and switch to fluid or responsive sizing.",
        estimatedFixTime: "1 hour",
        screenshot,
        meta: { items: withMoreNote(overflowingElements.examples, overflowingElements.count) },
      }),
    );
  } else {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `No overflowing elements detected on ${viewportLabel}`,
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: `None of the ${overflowingElements.total} sampled elements extend past the ${viewportLabel} viewport edge.`,
        whyItMatters: "Elements staying within the viewport keep content legible and reachable.",
        recommendation: "No action needed.",
        estimatedFixTime: "0 minutes",
      }),
    );
  }

  // 3. Buttons/CTAs overflowing
  const { overflowingButtons } = result;
  if (overflowingButtons.count > 0) {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `Buttons/CTAs extend outside the viewport on ${viewportLabel}`,
        status: "fail",
        severity: "high",
        pageUrl: url,
        description: `${overflowingButtons.count} of ${overflowingButtons.total} button/CTA elements extend past the right edge of the ${viewportLabel} viewport.`,
        whyItMatters:
          "A button or call-to-action that is partly or fully off-screen can block a user from completing a key action, which is worse than generic overflow.",
        recommendation: "Ensure buttons/CTAs sit inside a fluid container and never rely on a fixed pixel width larger than the viewport.",
        estimatedFixTime: "30 minutes",
        screenshot,
        meta: { items: withMoreNote(overflowingButtons.examples, overflowingButtons.count) },
      }),
    );
  } else {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `No buttons/CTAs overflow the viewport on ${viewportLabel}`,
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: `All ${overflowingButtons.total} sampled buttons/CTAs stay within the ${viewportLabel} viewport.`,
        whyItMatters: "Buttons/CTAs that stay on-screen remain clickable and visible to visitors.",
        recommendation: "No action needed.",
        estimatedFixTime: "0 minutes",
      }),
    );
  }

  // 4. Cropped/stretched images
  const { stretchedImages } = result;
  if (stretchedImages.count > 0) {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `Images appear stretched or cropped on ${viewportLabel}`,
        status: "fail",
        severity: "medium",
        pageUrl: url,
        description: `${stretchedImages.count} of ${stretchedImages.total} images render at an aspect ratio more than 15% different from their natural aspect ratio on ${viewportLabel}.`,
        whyItMatters: "Distorted images look unpolished and can misrepresent product photos, logos, or graphics.",
        recommendation: "Use object-fit: contain/cover with a fixed-ratio container instead of stretching width/height independently.",
        estimatedFixTime: "30 minutes",
        meta: { items: withMoreNote(stretchedImages.examples, stretchedImages.count) },
      }),
    );
  } else {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `No stretched/cropped images detected on ${viewportLabel}`,
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: `All ${stretchedImages.total} loaded images preserve their natural aspect ratio on ${viewportLabel}.`,
        whyItMatters: "Correctly scaled images keep the page looking polished and professional.",
        recommendation: "No action needed.",
        estimatedFixTime: "0 minutes",
      }),
    );
  }

  // 5. Clipped text
  const { clippedText } = result;
  if (clippedText.count > 0) {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `Clipped text detected on ${viewportLabel}`,
        status: "fail",
        severity: "medium",
        pageUrl: url,
        description: `${clippedText.count} elements have content larger than their box with overflow hidden on ${viewportLabel}, which typically clips or hides text from view.`,
        whyItMatters: "Clipped text hides information from visitors and is a classic narrow-viewport bug.",
        recommendation: "Allow the text container to grow, wrap, or scroll instead of clipping it with overflow: hidden.",
        estimatedFixTime: "30 minutes",
        meta: { items: withMoreNote(clippedText.examples, clippedText.count) },
      }),
    );
  } else {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `No clipped text detected on ${viewportLabel}`,
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: `No sampled text elements were found with overflow-hidden content clipping on ${viewportLabel}.`,
        whyItMatters: "Text that isn't clipped remains fully readable to visitors.",
        recommendation: "No action needed.",
        estimatedFixTime: "0 minutes",
      }),
    );
  }

  // 6. Overlapping elements
  const { overlappingElements } = result;
  if (overlappingElements.count > 0) {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `Overlapping elements detected on ${viewportLabel}`,
        status: "fail",
        severity: "high",
        pageUrl: url,
        description: `${overlappingElements.count} pair(s) of headings/buttons/images significantly overlap each other on ${viewportLabel}.`,
        whyItMatters: "Overlapping elements can hide content or controls and make the layout look broken.",
        recommendation: "Review spacing, absolute positioning, and z-index rules for the flagged elements at this viewport size.",
        estimatedFixTime: "1 hour",
        screenshot,
        meta: { items: overlappingElements.examples },
      }),
    );
  } else {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `No overlapping elements detected on ${viewportLabel}`,
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: `No significant overlap was found among sampled headings/buttons/images on ${viewportLabel}.`,
        whyItMatters: "Elements that don't overlap keep the layout readable and controls reachable.",
        recommendation: "No action needed.",
        estimatedFixTime: "0 minutes",
      }),
    );
  }

  // 7. Empty spacing blocks
  const { emptySpacing } = result;
  if (emptySpacing.count > 0) {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `Large empty spacing blocks on ${viewportLabel}`,
        status: "fail",
        severity: "low",
        pageUrl: url,
        description: `${emptySpacing.count} container(s) render taller than 150px with no text, media, or background image on ${viewportLabel}, suggesting accidentally empty spacer sections.`,
        whyItMatters: "Large empty blocks waste screen space and often indicate a layout or content bug at this breakpoint.",
        recommendation: "Check whether these sections are missing content at this viewport or should collapse when empty.",
        estimatedFixTime: "15 minutes",
        meta: { items: withMoreNote(emptySpacing.examples, emptySpacing.count) },
      }),
    );
  } else {
    findings.push(
      makeFinding({
        category: "responsive",
        title: `No large empty spacing blocks detected on ${viewportLabel}`,
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: `No oversized, contentless blocks were found on ${viewportLabel}.`,
        whyItMatters: "Avoiding empty spacer sections keeps the page compact and intentional-looking.",
        recommendation: "No action needed.",
        estimatedFixTime: "0 minutes",
      }),
    );
  }

  return findings;
}

export const responsiveModule: AuditModule = {
  category: "responsive",
  label: "Responsive Design",
  run: async (ctx) => {
    const findings: Finding[] = [];

    try {
      // --- Tablet ---
      try {
        await ctx.page.setViewportSize(TABLET_VIEWPORT);
        await ctx.page.waitForTimeout(400);
        try {
          ctx.screenshots.tablet = await captureScreenshot(ctx.page);
        } catch {
          // screenshot failure shouldn't block the layout analysis below
        }
        const result = await analyzeViewportLayout(ctx.page);
        findings.push(...buildViewportFindings(ctx, "tablet", result));
      } catch (err) {
        findings.push(
          makeFinding({
            category: "responsive",
            title: "Could not analyze tablet layout",
            status: "warning",
            severity: "low",
            pageUrl: ctx.url,
            description: `Tablet viewport analysis failed: ${err instanceof Error ? err.message : "unknown error"}.`,
            whyItMatters: "Without a successful tablet analysis, responsive issues at this breakpoint may go unnoticed.",
            recommendation: "Re-run the audit; if this persists, the page may block automated resizing or scripting.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }

      // --- Mobile ---
      try {
        await ctx.page.setViewportSize(MOBILE_VIEWPORT);
        await ctx.page.waitForTimeout(400);
        try {
          ctx.screenshots.mobile = await captureScreenshot(ctx.page);
        } catch {
          // screenshot failure shouldn't block the layout analysis below
        }
        const result = await analyzeViewportLayout(ctx.page);
        findings.push(...buildViewportFindings(ctx, "mobile", result));
      } catch (err) {
        findings.push(
          makeFinding({
            category: "responsive",
            title: "Could not analyze mobile layout",
            status: "warning",
            severity: "low",
            pageUrl: ctx.url,
            description: `Mobile viewport analysis failed: ${err instanceof Error ? err.message : "unknown error"}.`,
            whyItMatters: "Without a successful mobile analysis, responsive issues at this breakpoint may go unnoticed.",
            recommendation: "Re-run the audit; if this persists, the page may block automated resizing or scripting.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }
    } finally {
      // Navigation/search/forms modules run immediately after this one in the same
      // sequential phase and expect the desktop layout, so always restore it.
      await ctx.page.setViewportSize(DESKTOP_VIEWPORT).catch(() => undefined);
    }

    return findings;
  },
};
