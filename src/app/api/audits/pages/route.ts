import { isDbConfigured } from "@/lib/db/client";
import { listAuditPagesSummary } from "@/lib/db/audits";

export const runtime = "nodejs";

/** Lists every distinct crawled page with its crawl count and most recent crawl, for the history sidebar. */
export async function GET() {
  if (!isDbConfigured()) {
    return Response.json({ pages: [] });
  }

  const pages = await listAuditPagesSummary();
  return Response.json({ pages });
}
