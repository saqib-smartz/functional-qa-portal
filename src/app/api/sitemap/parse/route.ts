import type { NextRequest } from "next/server";
import { parseSitemapXml } from "@/lib/sitemap/parse-sitemap";
import { fetchChildSitemaps } from "@/lib/sitemap/fetch-child-sitemaps";
import { sitemapParseRequestSchema } from "@/lib/validation/sitemap-request-schema";
import { isHttpUrl } from "@/lib/validation/audit-request-schema";
import type { SitemapParseResult } from "@/lib/sitemap/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_URLS_RETURNED = 500;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = sitemapParseRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const root = parseSitemapXml(parsed.data.xml);

  if (root.kind === "unknown") {
    return Response.json(
      { error: "This doesn't look like a sitemap XML file (no <urlset> or <sitemapindex> found)." },
      { status: 400 },
    );
  }

  const warnings: string[] = [];
  let urls: string[];

  if (root.kind === "sitemapindex") {
    const children = await fetchChildSitemaps(root.locs);
    urls = children.urls;
    warnings.push(...children.warnings);
  } else {
    urls = root.locs;
  }

  const validUrls = urls.filter(isHttpUrl);
  if (validUrls.length < urls.length) {
    warnings.push(`${urls.length - validUrls.length} entries were not valid http(s) URLs and were skipped.`);
  }

  const deduped = Array.from(new Set(validUrls));
  const truncated = deduped.length > MAX_URLS_RETURNED;
  if (truncated) {
    warnings.push(`Found ${deduped.length} URLs; only the first ${MAX_URLS_RETURNED} are shown.`);
  }

  const result: SitemapParseResult = {
    urls: deduped.slice(0, MAX_URLS_RETURNED),
    totalFound: deduped.length,
    truncated,
    warnings,
  };

  return Response.json(result);
}
