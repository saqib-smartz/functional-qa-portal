"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuditReport } from "@/lib/audit/types";

export function ExportPdfButton({ report }: { report: AuditReport }) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/audit/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `PDF export failed with status ${res.status}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = new URL(report.url).hostname.replace(/[^a-z0-9.-]/gi, "-");
      link.href = url;
      link.download = `qa-audit-${slug}-${report.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleExport} disabled={isExporting} variant="outline">
        {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Export as PDF
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
