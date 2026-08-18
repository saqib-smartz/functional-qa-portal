"use client";

import { useMemo, useState } from "react";
import { XCircle, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ExecutiveSummary } from "@/components/report/executive-summary";
import { AuditComparisonView } from "@/components/report/audit-comparison-view";
import { ScreenshotGallery } from "@/components/report/screenshot-gallery";
import { CategoryGroup } from "@/components/report/category-group";
import { ReportToolbar, type StatusFilter } from "@/components/report/report-toolbar";
import { ExportPdfButton } from "@/components/report/export-pdf-button";
import { ShareReportButton } from "@/components/report/share-report-button";
import { describeNonSuccessStatus } from "@/lib/audit/blocked-page";
import { formatAuditTimestamp } from "@/lib/format/date";
import { CATEGORIES, type AuditReport } from "@/lib/audit/types";

export function ReportView({
  report,
  variant = "internal",
  shareToken,
}: {
  report: AuditReport;
  /** "public" hides internal-only affordances (crawl history, share controls) on the shared page. */
  variant?: "internal" | "public";
  shareToken?: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const blockedWarning = describeNonSuccessStatus(report.httpStatus);

  const counts = useMemo(
    () => ({
      all: report.findings.length,
      fail: report.findings.filter((f) => f.status === "fail").length,
      warning: report.findings.filter((f) => f.status === "warning").length,
      pass: report.findings.filter((f) => f.status === "pass").length,
    }),
    [report.findings],
  );

  const filteredFindings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return report.findings.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (query && !`${f.title} ${f.description}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [report.findings, statusFilter, search]);

  const findingsByCategory = CATEGORIES.map((category) => ({
    category,
    findings: filteredFindings.filter((f) => f.category === category),
  })).filter((group) => group.findings.length > 0);

  const totalTimeSeconds =
    (new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime()) / 1000;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      {blockedWarning && (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>This audit may be unreliable — the page didn&apos;t load normally</AlertTitle>
          <AlertDescription>{blockedWarning}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-foreground text-[28px] leading-[1.25] font-normal">
            {report.pageTitle || "Untitled Page"}
          </h2>
          <p className="text-muted-foreground text-sm break-all">{report.url}</p>
          <p className="text-muted-foreground text-xs">
            Audited {formatAuditTimestamp(report.finishedAt)} &middot; HTTP {report.httpStatus}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <XCircle className="text-destructive size-3.5" />
              <span className="bg-muted-foreground/15 text-foreground rounded-full px-1.5 py-px font-medium">
                {counts.fail}
              </span>
              failed
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="text-attention size-3.5" />
              <span className="bg-muted-foreground/15 text-foreground rounded-full px-1.5 py-px font-medium">
                {counts.warning}
              </span>
              warnings
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="text-success size-3.5" />
              <span className="bg-muted-foreground/15 text-foreground rounded-full px-1.5 py-px font-medium">
                {counts.pass}
              </span>
              passed
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          {variant === "internal" && (
            <ShareReportButton reportId={report.id} initialToken={shareToken} />
          )}
          <ExportPdfButton report={report} />
        </div>
      </div>

      <ExecutiveSummary summary={report.executiveSummary} />

      {/* Comparison lists every stored crawl of this URL — internal history, never for a share recipient. */}
      {variant === "internal" && (
        <AuditComparisonView currentReportId={report.id} url={report.url} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>WordPress Detection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-foreground font-medium">Is WordPress: </span>
            <span className="text-muted-foreground">
              {report.wordpress.isWordPress ? "Yes" : "No"}
            </span>
          </p>
          {report.wordpress.theme && (
            <p>
              <span className="text-foreground font-medium">Theme: </span>
              <span className="text-muted-foreground">
                {report.wordpress.theme}
                {report.wordpress.themeConfidence
                  ? ` (${report.wordpress.themeConfidence} confidence)`
                  : ""}
              </span>
            </p>
          )}
          <p>
            <span className="text-foreground font-medium">Plugins: </span>
            <span className="text-muted-foreground">
              {report.wordpress.plugins.length > 0
                ? report.wordpress.plugins.join(", ")
                : "None detected"}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Screenshots</CardTitle>
        </CardHeader>
        <CardContent>
          <ScreenshotGallery screenshots={report.screenshots} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-foreground text-lg font-semibold">Findings</h3>
        <ReportToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          counts={counts}
          visibleCount={filteredFindings.length}
          auditedAt={formatAuditTimestamp(report.finishedAt)}
          totalTimeSeconds={totalTimeSeconds}
        />

        <div className="space-y-3">
          {findingsByCategory.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              No findings match the current filter.
            </p>
          ) : (
            findingsByCategory.map((group) => (
              <CategoryGroup
                key={group.category}
                category={group.category}
                findings={group.findings}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
