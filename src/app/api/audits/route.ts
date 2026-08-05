import type { NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { listAuditsForUrl } from "@/lib/db/audits";
import { isHttpUrl } from "@/lib/validation/audit-request-schema";

export const runtime = "nodejs";

/** Lists past audits recorded for a URL (id/date/title/status only), for a "compare against" picker. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url || !isHttpUrl(url)) {
    return Response.json({ error: "A valid http(s) `url` query parameter is required." }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({ audits: [] });
  }

  const audits = await listAuditsForUrl(url);
  return Response.json({ audits });
}
