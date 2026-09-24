import type { Page } from "playwright-core";

// Very long pages produce captures large enough to exhaust the serverless browser's memory
// (and crash it). Anything past this height adds little to a QA preview.
const MAX_SCREENSHOT_HEIGHT = 8000;

// Fallback for entrance-animation libraries whose trigger never fired (e.g. a delay still pending
// when we capture). Applied only for the duration of the screenshot.
const REVEAL_ANIMATED_CONTENT_CSS = `
  .elementor-invisible { visibility: visible !important; }
  .wow { visibility: visible !important; }
  [data-aos] { opacity: 1 !important; transform: none !important; }
`;

/**
 * Scroll-triggered content (entrance animations, lazy-loaded images) stays hidden until it enters
 * the viewport, and a full-page capture never scrolls — so walk the page top to bottom first to
 * fire those IntersectionObserver/scroll handlers, then return to the top.
 */
async function revealScrollTriggeredContent(page: Page): Promise<void> {
  const { viewportHeight, scrollHeight } = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  // Half-viewport steps so every element's top lands inside the viewport at some point —
  // most reveal triggers require the element to be partly on screen, not merely scrolled past.
  const step = Math.max(Math.floor(viewportHeight / 2), 200);
  const bottom = Math.min(scrollHeight, MAX_SCREENSHOT_HEIGHT);

  for (let y = 0; y < bottom; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate((top) => window.scrollTo(0, top), bottom);
  await page.waitForTimeout(400);

  // Lazy-loaded images kicked off by the scroll — give them a bounded window to finish.
  await page
    .waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, {
      timeout: 3000,
    })
    .catch(() => undefined);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

/** Full-page screenshot of the page at its current viewport, as a base64 data URL. */
export async function captureScreenshot(page: Page): Promise<string> {
  // Best effort — a page that blocks scripting still gets a (possibly incomplete) capture.
  await revealScrollTriggeredContent(page).catch(() => undefined);

  const width = page.viewportSize()?.width ?? 1440;
  const buffer = await page.screenshot({
    fullPage: true,
    type: "png",
    clip: { x: 0, y: 0, width, height: MAX_SCREENSHOT_HEIGHT },
    // fast-forwards entrance animations that were triggered but are still mid-flight
    animations: "disabled",
    style: REVEAL_ANIMATED_CONTENT_CSS,
  });
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
