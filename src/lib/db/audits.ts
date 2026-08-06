import { getDb } from "./client";
import type { AuditReport } from "@/lib/audit/types";
import type { AuditPageSummary, AuditSummary, StoredAudit } from "./types";

/** Historical rows omit screenshots (base64 data URLs) — sizable and only needed for the live view. */
function stripScreenshots(report: AuditReport): AuditReport {
  return { ...report, screenshots: { desktop: "", tablet: "", mobile: "" } };
}

interface AuditDocument {
  _id: string;
  url: string;
  crawledAt: Date;
  pageTitle: string | null;
  httpStatus: number | null;
  pageText: string;
  report: AuditReport;
  crawlBatchId: string | null;
}

function auditsCollection(db: Awaited<ReturnType<typeof getDb>>) {
  return db.collection<AuditDocument>("audits");
}

export async function recordAudit(
  report: AuditReport,
  pageText: string,
  crawlBatchId?: string,
): Promise<void> {
  const db = await getDb();
  await auditsCollection(db).insertOne({
    _id: report.id,
    url: report.url,
    crawledAt: new Date(report.finishedAt),
    pageTitle: report.pageTitle,
    httpStatus: report.httpStatus,
    pageText,
    report: stripScreenshots(report),
    crawlBatchId: crawlBatchId ?? null,
  });
}

export async function listAuditsForUrl(url: string): Promise<AuditSummary[]> {
  const db = await getDb();
  const rows = await auditsCollection(db)
    .find(
      { url },
      { projection: { _id: 1, url: 1, crawledAt: 1, pageTitle: 1, httpStatus: 1 } },
    )
    .sort({ crawledAt: -1 })
    .toArray();
  return rows.map((row) => ({
    id: row._id,
    url: row.url,
    crawledAt: row.crawledAt.toISOString(),
    pageTitle: row.pageTitle,
    httpStatus: row.httpStatus,
  }));
}

/** One row per distinct crawled URL, grouped via an aggregation pipeline — used to build the sidebar's site/page tree. */
export async function listAuditPagesSummary(): Promise<AuditPageSummary[]> {
  const db = await getDb();
  const rows = await auditsCollection(db)
    .aggregate<{
      _id: string;
      crawlCount: number;
      latestCrawledAt: Date;
      latestPageTitle: string | null;
    }>([
      { $sort: { crawledAt: -1 } },
      {
        $group: {
          _id: "$url",
          crawlCount: { $sum: 1 },
          latestCrawledAt: { $first: "$crawledAt" },
          latestPageTitle: { $first: "$pageTitle" },
        },
      },
      { $sort: { latestCrawledAt: -1 } },
    ])
    .toArray();

  return rows.map((row) => ({
    url: row._id,
    crawlCount: row.crawlCount,
    latestCrawledAt: row.latestCrawledAt.toISOString(),
    latestPageTitle: row.latestPageTitle,
  }));
}

export async function getAuditById(id: string): Promise<StoredAudit | null> {
  const db = await getDb();
  const row = await auditsCollection(db).findOne({ _id: id });
  if (!row) return null;
  return {
    id: row._id,
    url: row.url,
    crawledAt: row.crawledAt.toISOString(),
    pageTitle: row.pageTitle,
    httpStatus: row.httpStatus,
    pageText: row.pageText,
    report: row.report,
    crawlBatchId: row.crawlBatchId ?? undefined,
  };
}
