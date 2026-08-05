import { gunzipSync } from "zlib";
import { parseSitemapXml } from "./parse-sitemap";

/** Sane ceiling even for large sites — avoids an upload triggering hundreds of outbound fetches. */
const MAX_CHILD_SITEMAPS = 20;
const FETCH_TIMEOUT_MS = 15_000;

async function fetchSitemapText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const isGzip =
      url.endsWith(".gz") ||
      (res.headers.get("content-encoding")?.includes("gzip") ?? false) ||
      (buffer[0] === 0x1f && buffer[1] === 0x8b);
    return (isGzip ? gunzipSync(buffer) : buffer).toString("utf-8");
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches and flattens child sitemap files referenced by a <sitemapindex>. One level deep only. */
export async function fetchChildSitemaps(
  childUrls: string[],
): Promise<{ urls: string[]; warnings: string[] }> {
  const capped = childUrls.slice(0, MAX_CHILD_SITEMAPS);
  const warnings: string[] = [];
  if (childUrls.length > capped.length) {
    warnings.push(
      `Sitemap index lists ${childUrls.length} child sitemaps; only the first ${MAX_CHILD_SITEMAPS} were fetched.`,
    );
  }

  const results = await Promise.all(
    capped.map(async (childUrl) => {
      try {
        const xml = await fetchSitemapText(childUrl);
        return parseSitemapXml(xml).locs;
      } catch (err) {
        warnings.push(
          `Could not fetch child sitemap ${childUrl}: ${err instanceof Error ? err.message : "unknown error"}`,
        );
        return [];
      }
    }),
  );

  return { urls: results.flat(), warnings };
}
