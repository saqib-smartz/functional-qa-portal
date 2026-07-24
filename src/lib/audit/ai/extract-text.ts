import type { Page } from "playwright-core";

const MAX_CHARS = 12_000;

/**
 * Collects visible body copy for grammar/spelling analysis, excluding hidden elements and
 * nav/header/footer boilerplate (which repeats site-wide and isn't "content" to proofread).
 */
export async function extractVisibleText(page: Page): Promise<string> {
  const text = await page.evaluate(() => {
    const EXCLUDED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "IFRAME"]);
    const EXCLUDED_ANCESTOR_SELECTOR = "nav, header, footer, [role='navigation'], [aria-hidden='true']";

    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    const root = document.querySelector("main") || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (EXCLUDED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(EXCLUDED_ANCESTOR_SELECTOR)) return NodeFilter.FILTER_REJECT;
        if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const chunks: string[] = [];
    let current = walker.nextNode();
    while (current) {
      chunks.push(current.textContent!.trim());
      current = walker.nextNode();
    }
    return chunks.join("\n");
  });

  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n[...truncated for length...]` : text;
}
