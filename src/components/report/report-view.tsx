"use client";

import { useMemo, useState } from "react";
import { XCircle, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ExecutiveSummary } from "@/components/report/executive-summary";
import { ScreenshotGallery } from "@/components/report/screenshot-gallery";
import { CategoryGroup } from "@/components/report/category-group";
import { ReportToolbar, type StatusFilter } from "@/components/report/report-toolbar";
import { ExportPdfButton } from "@/components/report/export-pdf-button";
import { describeNonSuccessStatus } from "@/lib/audit/blocked-page";
import { CATEGORIES, type AuditReport } from "@/lib/audit/types";

export function ReportView({ report }: { report: AuditReport }) {
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

  const totalTimeSeconds = (new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime()) / 1000;

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
          <h2 className="text-[28px] leading-[1.25] font-normal text-foreground">
            {report.pageTitle || "Untitled Page"}
          </h2>
          <p className="text-sm break-all text-muted-foreground">{report.url}</p>
          <p className="text-xs text-muted-foreground">
            Audited {new Date(report.finishedAt).toLocaleString()} &middot; HTTP {report.httpStatus}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <XCircle className="size-3.5 text-destructive" />
              <span className="rounded-full bg-muted-foreground/15 px-1.5 py-px font-medium text-foreground">
                {counts.fail}
              </span>
              failed
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="size-3.5 text-attention" />
              <span className="rounded-full bg-muted-foreground/15 px-1.5 py-px font-medium text-foreground">
                {counts.warning}
              </span>
              warnings
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-success" />
              <span className="rounded-full bg-muted-foreground/15 px-1.5 py-px font-medium text-foreground">
                {counts.pass}
              </span>
              passed
            </span>
          </div>
        </div>
        <ExportPdfButton report={report} />
      </div>

      <ExecutiveSummary summary={report.executiveSummary} />

      <Card>
        <CardHeader>
          <CardTitle>WordPress Detection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="font-medium text-foreground">Is WordPress: </span>
            <span className="text-muted-foreground">{report.wordpress.isWordPress ? "Yes" : "No"}</span>
          </p>
          {report.wordpress.theme && (
            <p>
              <span className="font-medium text-foreground">Theme: </span>
              <span className="text-muted-foreground">
                {report.wordpress.theme}
                {report.wordpress.themeConfidence ? ` (${report.wordpress.themeConfidence} confidence)` : ""}
              </span>
            </p>
          )}
          <p>
            <span className="font-medium text-foreground">Plugins: </span>
            <span className="text-muted-foreground">
              {report.wordpress.plugins.length > 0 ? report.wordpress.plugins.join(", ") : "None detected"}
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
        <h3 className="text-lg font-semibold text-foreground">Findings</h3>
        <ReportToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          counts={counts}
          visibleCount={filteredFindings.length}
          auditedAt={new Date(report.finishedAt).toLocaleString()}
          totalTimeSeconds={totalTimeSeconds}
        />

        <div className="space-y-3">
          {findingsByCategory.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No findings match the current filter.
            </p>
          ) : (
            findingsByCategory.map((group) => (
              <CategoryGroup key={group.category} category={group.category} findings={group.findings} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
