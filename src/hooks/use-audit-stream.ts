"use client";

import { useCallback, useState } from "react";
import type { AuditReport, AuditStreamEvent, Category } from "@/lib/audit/types";

export interface ModuleProgress {
  category: Category;
  label: string;
  state: "running" | "done" | "error";
  findingsCount?: number;
  message?: string;
}

export type AuditRunStatus = "idle" | "running" | "complete" | "error";

interface UseAuditStreamResult {
  status: AuditRunStatus;
  statusMessage: string;
  modules: ModuleProgress[];
  report: AuditReport | null;
  error: string | null;
  runAudit: (url: string) => Promise<void>;
  reset: () => void;
}

export function useAuditStream(): UseAuditStreamResult {
  const [status, setStatus] = useState<AuditRunStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [modules, setModules] = useState<ModuleProgress[]>([]);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setStatusMessage("");
    setModules([]);
    setReport(null);
    setError(null);
  }, []);

  const runAudit = useCallback(async (url: string) => {
    setStatus("running");
    setStatusMessage("Starting audit…");
    setModules([]);
    setReport(null);
    setError(null);

    const handleEvent = (event: AuditStreamEvent) => {
      switch (event.type) {
        case "status":
          setStatusMessage(event.message);
          break;
        case "module-start":
          setModules((prev) => [
            ...prev,
            { category: event.category, label: event.label, state: "running" },
          ]);
          break;
        case "module-done":
          setModules((prev) =>
            prev.map((m) =>
              m.category === event.category
                ? { ...m, state: "done", findingsCount: event.findingsCount }
                : m,
            ),
          );
          break;
        case "module-error":
          setModules((prev) =>
            prev.map((m) =>
              m.category === event.category ? { ...m, state: "error", message: event.message } : m,
            ),
          );
          break;
        case "error":
          setStatus("error");
          setError(event.message);
          break;
        case "complete":
          setReport(event.report);
          setStatus("complete");
          break;
      }
    };

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed with status ${res.status}.`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line) as AuditStreamEvent);
        }
      }
      if (buffer.trim()) {
        handleEvent(JSON.parse(buffer) as AuditStreamEvent);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "The audit failed unexpectedly.");
    }
  }, []);

  return { status, statusMessage, modules, report, error, runAudit, reset };
}
