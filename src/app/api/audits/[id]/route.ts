import { isDbConfigured } from "@/lib/db/client";
import { getAuditById } from "@/lib/db/audits";

export const runtime = "nodejs";

/** Fetches one historical audit in full (including its stored report), for viewing a past crawl. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDbConfigured()) {
    return Response.json({ error: "Audit history is not configured." }, { status: 400 });
  }

  const audit = await getAuditById(id);
  if (!audit) {
    return Response.json({ error: "Audit not found." }, { status: 404 });
  }

  return Response.json(audit);
}
