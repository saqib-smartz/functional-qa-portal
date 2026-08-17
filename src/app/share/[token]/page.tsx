import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ReportView } from "@/components/report/report-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSharedAudit } from "@/lib/db/audits";
import { isDbConfigured } from "@/lib/db/client";
import { formatAuditTimestamp } from "@/lib/format/date";
import { isShareToken } from "@/lib/validation/share-token";

export const runtime = "nodejs";
/** Load-bearing: without it Next can serve this segment from the route cache and revocation wouldn't take effect. */
export const dynamic = "force-dynamic";

/**
 * Static rather than generateMetadata — a per-report title would cost a second getSharedAudit call
 * (or a cache() wrapper) for a browser-tab string. Shared reports are unlisted-by-token, not public
 * content, so they stay out of search results.
 */
export const metadata: Metadata = {
  title: "Shared QA Report",
  robots: { index: false, follow: false },
};

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isDbConfigured() || !isShareToken(token)) notFound();

  const audit = await getSharedAudit(token);
  if (!audit) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <div className="mx-auto mb-8 w-full max-w-4xl">
          <Alert>
            <AlertTitle>Shared QA report</AlertTitle>
            <AlertDescription>
              Read-only snapshot of an audit run on {formatAuditTimestamp(audit.crawledAt)}.
              Full-page viewport screenshots aren&apos;t retained in shared reports; screenshots
              attached to individual findings are.
            </AlertDescription>
          </Alert>
        </div>

        <ReportView report={audit.report} variant="public" />
      </main>

      <SiteFooter />
    </div>
  );
}
