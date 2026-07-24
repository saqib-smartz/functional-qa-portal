import type { Browser, BrowserContext, Page } from "playwright-core";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
export const TABLET_VIEWPORT = { width: 768, height: 1024 };
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

const AUDITOR_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36 WP-QA-Auditor/1.0";

export interface FetchedPage {
  context: BrowserContext;
  page: Page;
  html: string;
  $: CheerioAPI;
  httpStatus: number;
  responseHeaders: Record<string, string>;
}

/**
 * Navigates once, at desktop viewport, and returns everything static analysis needs
 * (raw HTML + a Cheerio snapshot) alongside the live Page for modules that need interaction.
 */
export async function fetchPage(browser: Browser, url: string): Promise<FetchedPage> {
  const context = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    ignoreHTTPSErrors: true,
    userAgent: AUDITOR_USER_AGENT,
  });
  const page = await context.newPage();

  let response;
  try {
    response = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
  } catch {
    // networkidle can time out on pages with long-polling/analytics; fall back to a looser wait
    response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  }

  if (!response) {
    await context.close();
    throw new Error(`Failed to load ${url} — no response received.`);
  }

  // let late-mounting widgets (cookie banners, lazy-loaded content) settle before we snapshot
  await page.waitForTimeout(750);

  const html = await page.content();
  const $ = cheerio.load(html);

  return {
    context,
    page,
    html,
    $,
    httpStatus: response.status(),
    responseHeaders: response.headers(),
  };
}
