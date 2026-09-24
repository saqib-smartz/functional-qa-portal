import type { Page } from "playwright-core";

// Very long pages produce captures large enough to exhaust the serverless browser's memory
// (and crash it). Anything past this height adds little to a QA preview.
const MAX_SCREENSHOT_HEIGHT = 8000;

/** Full-page screenshot of the page at its current viewport, as a base64 data URL. */
export async function captureScreenshot(page: Page): Promise<string> {
  const width = page.viewportSize()?.width ?? 1440;
  const buffer = await page.screenshot({
    fullPage: true,
    type: "png",
    clip: { x: 0, y: 0, width, height: MAX_SCREENSHOT_HEIGHT },
  });
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
