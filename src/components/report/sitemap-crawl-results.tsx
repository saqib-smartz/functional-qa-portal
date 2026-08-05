"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ReportView } from "@/components/report/report-view";
import type { CrawlUrlState } from "@/hooks/use-sitemap-crawl";

function countStatus(urlStates: CrawlUrlState[], status: "fail" | "warning" | "pass") {
  return urlStates.reduce(
    (sum, u) => sum + (u.report?.findings.filter((f) => f.status === status).length ?? 0),
    0,
  );
}

export function SitemapCrawlResults({ urlStates }: { urlStates: CrawlUrlState[] }) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  const completed = urlStates.filter((u) => u.status === "done" && u.report);
  const failedCrawls = urlStates.filter((u) => u.status === "error");

  const totals = {
    fail: countStatus(urlStates, "fail"),
    warning: countStatus(urlStates, "warning"),
    pass: countStatus(urlStates, "pass"),
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4 text-sm">
        <span className="font-medium text-foreground">
          {completed.length}/{urlStates.length} pages audited
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <XCircle className="size-3.5 text-destructive" />
          {totals.fail} failed
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <AlertTriangle className="size-3.5 text-attention" />
          {totals.warning} warnings
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          {totals.pass} passed
        </span>
        {failedCrawls.length > 0 && (
          <span className="text-destructive">{failedCrawls.length} page(s) could not be audited</span>
        )}
      </div>

      <div className="space-y-2">
        {urlStates.map((u) => {
          const failCount = u.report?.findings.filter((f) => f.status === "fail").length ?? 0;
          const warningCount = u.report?.findings.filter((f) => f.status === "warning").length ?? 0;
          const isOpen = expandedUrl === u.url;

          return (
            <div key={u.url} className="rounded-md border border-border">
              <button
                type="button"
                disabled={u.status !== "done"}
                onClick={() => setExpandedUrl(isOpen ? null : u.url)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {u.report?.pageTitle || u.url}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  {u.status === "error" && <span className="text-destructive">{u.error}</span>}
                  {u.status === "done" && (
                    <>
                      {failCount > 0 && <span className="font-medium text-destructive">{failCount} failed</span>}
                      {warningCount > 0 && <span className="font-medium text-attention">{warningCount} warnings</span>}
                      {isOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </>
                  )}
                </div>
              </button>
              {isOpen && u.report && (
                <div className="border-t border-border p-4">
                  <ReportView report={u.report} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
