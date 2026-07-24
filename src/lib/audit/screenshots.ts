import type { Page } from "playwright-core";

/** Full-page screenshot of the page at its current viewport, as a base64 data URL. */
export async function captureScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({ fullPage: true, type: "png" });
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
