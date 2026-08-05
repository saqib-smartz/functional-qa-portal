import type { NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db/client";
import { getAuditById } from "@/lib/db/audits";
import { compareAudits } from "@/lib/diff/compare-audits";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const a = request.nextUrl.searchParams.get("a");
  const b = request.nextUrl.searchParams.get("b");

  if (!a || !b) {
    return Response.json({ error: "Both `a` and `b` audit id query parameters are required." }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({ error: "Audit history is not configured." }, { status: 400 });
  }

  const [auditA, auditB] = await Promise.all([getAuditById(a), getAuditById(b)]);

  if (!auditA || !auditB) {
    return Response.json({ error: "One or both audits could not be found." }, { status: 404 });
  }

  return Response.json(compareAudits(auditA, auditB));
}
