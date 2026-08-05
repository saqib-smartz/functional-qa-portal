"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import type { Change } from "diff";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FindingRow } from "@/components/report/finding-row";
import { cn } from "@/lib/utils";
import type { AuditSummary } from "@/lib/db/types";
import type { Finding } from "@/lib/audit/types";

interface ComparisonResult {
  older: AuditSummary;
  newer: AuditSummary;
  findings: { added: Finding[]; resolved: Finding[]; unchanged: Finding[] };
  contentDiff: Change[];
}

export function AuditComparisonView({ currentReportId, url }: { currentReportId: string; url: string }) {
  const [history, setHistory] = useState<AuditSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/audits?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((body: { audits?: AuditSummary[] }) => {
        const prior = (body.audits ?? []).filter((a) => a.id !== currentReportId);
        setHistory(prior);
        if (prior.length > 0) setSelectedId(prior[0].id);
      })
      .catch(() => undefined);
  }, [url, currentReportId]);

  if (history.length === 0) return null;

  const runComparison = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setComparison(null);
    try {
      const res = await fetch(`/api/audits/compare?a=${currentReportId}&b=${selectedId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not compare audits.");
      setComparison(body as ComparisonResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compare audits.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare with a previous crawl</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {history.map((h) => (
              <option key={h.id} value={h.id}>
                {new Date(h.crawledAt).toLocaleString()}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={runComparison} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Compare
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {comparison && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Before: {new Date(comparison.older.crawledAt).toLocaleString()}
                <br />
                After: {new Date(comparison.newer.crawledAt).toLocaleString()}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 font-medium text-destructive">
                  <XCircle className="size-3.5" />
                  {comparison.findings.added.length} new
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <CheckCircle2 className="size-3.5" />
                  {comparison.findings.resolved.length} resolved
                </span>
                <span className="text-muted-foreground">
                  {comparison.findings.unchanged.length} unresolved from before
                </span>
              </div>
            </div>

            <FindingBucket
              title="New issues since previous crawl"
              findings={comparison.findings.added}
              tone="new"
              emptyLabel="No new issues — nothing regressed since the previous crawl."
            />
            <FindingBucket
              title="Resolved since previous crawl"
              findings={comparison.findings.resolved}
              tone="resolved"
              emptyLabel="Nothing was resolved between these two crawls."
            />
            <FindingBucket
              title="Still open (present in both crawls)"
              findings={comparison.findings.unchanged}
              tone="neutral"
              collapsedByDefault
              emptyLabel="Nothing carried over."
            />

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Page content changes</p>
              <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {comparison.contentDiff.map((part, i) => (
                  <span
                    key={i}
                    className={
                      part.added
                        ? "bg-success/15 text-success"
                        : part.removed
                          ? "bg-destructive/15 text-destructive line-through"
                          : "text-muted-foreground"
                    }
                  >
                    {part.value}
                  </span>
                ))}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const BUCKET_STYLES = {
  new: { icon: XCircle, className: "text-destructive" },
  resolved: { icon: CheckCircle2, className: "text-success" },
  neutral: { icon: AlertTriangle, className: "text-muted-foreground" },
} as const;

function FindingBucket({
  title,
  findings,
  tone,
  collapsedByDefault,
  emptyLabel,
}: {
  title: string;
  findings: Finding[];
  tone: keyof typeof BUCKET_STYLES;
  collapsedByDefault?: boolean;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(!collapsedByDefault);
  const { icon: Icon, className } = BUCKET_STYLES[tone];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        <Icon className={cn("size-4", className)} />
        {title}
        <span className="text-muted-foreground">({findings.length})</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && findings.length > 0 && (
        <div className="rounded-md border border-border">
          {findings.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </div>
      )}
      {open && findings.length === 0 && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
    </div>
  );
}
