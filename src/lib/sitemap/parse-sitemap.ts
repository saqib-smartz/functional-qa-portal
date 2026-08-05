import * as cheerio from "cheerio";

export interface ParsedSitemap {
  kind: "urlset" | "sitemapindex" | "unknown";
  locs: string[];
}

/** Parses a sitemap protocol XML document (either a page urlset or a sitemapindex of child sitemaps). */
export function parseSitemapXml(xml: string): ParsedSitemap {
  const $ = cheerio.load(xml, { xmlMode: true });

  const sitemapindexLocs = $("sitemapindex > sitemap > loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  if (sitemapindexLocs.length > 0) {
    return { kind: "sitemapindex", locs: sitemapindexLocs };
  }

  const urlsetLocs = $("urlset > url > loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  if (urlsetLocs.length > 0) {
    return { kind: "urlset", locs: urlsetLocs };
  }

  return { kind: "unknown", locs: [] };
}
