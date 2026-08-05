import type { AuditReport, AuditStreamEvent } from "@/lib/audit/types";

/**
 * Posts to /api/audit and consumes its NDJSON stream, invoking onEvent for each event as it
 * arrives. Resolves with the final AuditReport once a "complete" event is received.
 */
export async function runAuditRequest(
  url: string,
  onEvent: (event: AuditStreamEvent) => void,
  crawlBatchId?: string,
): Promise<AuditReport> {
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, crawlBatchId }),
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with status ${res.status}.`);
  }

  let report: AuditReport | null = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AuditStreamEvent;
    onEvent(event);
    if (event.type === "complete") report = event.report;
    if (event.type === "error") throw new Error(event.message);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handle(line);
  }
  if (buffer.trim()) handle(buffer);

  if (!report) {
    throw new Error("The audit stream ended without a result.");
  }
  return report;
}
