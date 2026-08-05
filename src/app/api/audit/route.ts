import type { NextRequest } from "next/server";
import { runAudit } from "@/lib/audit/engine";
import { auditRequestSchema } from "@/lib/validation/audit-request-schema";
import type { AuditStreamEvent } from "@/lib/audit/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Runs the full audit inside a single request lifecycle and streams NDJSON progress events
 * (module-start / module-done / module-error / complete) so the client can show live progress
 * without needing a job queue or external state store.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = auditRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { url, crawlBatchId } = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: AuditStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await runAudit(url, emit, crawlBatchId);
      } catch (err) {
        emit({
          type: "error",
          message: err instanceof Error ? err.message : "The audit failed unexpectedly.",
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
