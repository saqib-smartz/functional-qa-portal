import { isDbConfigured } from "@/lib/db/client";
import { clearAllAudits } from "@/lib/db/audits";

export const runtime = "nodejs";

/** Deletes all stored audit history — used by the "Clear database" control in the history sidebar. */
export async function DELETE() {
  if (!isDbConfigured()) {
    return Response.json({ error: "Audit history is not configured." }, { status: 400 });
  }

  const deletedCount = await clearAllAudits();
  return Response.json({ deletedCount });
}
