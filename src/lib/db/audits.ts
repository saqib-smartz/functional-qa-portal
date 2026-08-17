import { randomBytes } from "node:crypto";
import { getDb } from "./client";
import type { AuditReport } from "@/lib/audit/types";
import type { AuditPageSummary, AuditSummary, SharedAudit, ShareLink, StoredAudit } from "./types";

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
  /** Null until the report is shared, and set back to null on revoke. Absent on rows written before sharing existed. */
  shareToken: string | null;
  sharedAt: Date | null;
}

function auditsCollection(db: Awaited<ReturnType<typeof getDb>>) {
  return db.collection<AuditDocument>("audits");
}

/** 256 bits of URL-safe randomness — a share link is the only thing guarding a public report. */
function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
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
    shareToken: null,
    sharedAt: null,
  });
}

export async function listAuditsForUrl(url: string): Promise<AuditSummary[]> {
  const db = await getDb();
  const rows = await auditsCollection(db)
    .find({ url }, { projection: { _id: 1, url: 1, crawledAt: 1, pageTitle: 1, httpStatus: 1 } })
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

export async function clearAllAudits(): Promise<number> {
  const db = await getDb();
  const { deletedCount } = await auditsCollection(db).deleteMany({});
  return deletedCount;
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
    shareToken: row.shareToken ?? null,
  };
}

/**
 * Mints a share token, or returns the existing one — clicking "Share" twice must yield the same link.
 * Uses an aggregation-pipeline update so the mint is atomic: $ifNull writes only when the field is
 * absent or null, which is exactly the "never shared" and "revoked" states.
 * Returns null when the audit has no row (e.g. the report was never persisted).
 */
export async function createShareLink(auditId: string): Promise<ShareLink | null> {
  const db = await getDb();
  const row = await auditsCollection(db).findOneAndUpdate(
    { _id: auditId },
    [
      {
        $set: {
          shareToken: { $ifNull: ["$shareToken", generateShareToken()] },
          sharedAt: { $ifNull: ["$sharedAt", new Date()] },
        },
      },
    ],
    { returnDocument: "after", projection: { shareToken: 1, sharedAt: 1 } },
  );

  if (!row?.shareToken) return null;
  return { token: row.shareToken, sharedAt: (row.sharedAt ?? new Date()).toISOString() };
}

/** Loads a shared audit by its public token. Returns null for unknown or revoked tokens. */
export async function getSharedAudit(token: string): Promise<SharedAudit | null> {
  const db = await getDb();
  // Exclusion-only projection (Mongo forbids mixing) — also keeps the sizable pageText off the wire.
  const row = await auditsCollection(db).findOne(
    { shareToken: token },
    { projection: { pageText: 0, shareToken: 0, sharedAt: 0, crawlBatchId: 0 } },
  );
  if (!row) return null;

  return {
    id: row._id,
    url: row.url,
    crawledAt: row.crawledAt.toISOString(),
    pageTitle: row.pageTitle,
    httpStatus: row.httpStatus,
    // report.id is the internal _id; handing it to a public viewer would let them revoke their own
    // link via DELETE /api/audits/{id}/share. Its only consumer here is the PDF download filename.
    report: { ...row.report, id: token },
  };
}

/** Kills a share link. Re-sharing afterwards mints a NEW token — the old URL stays dead permanently. */
export async function revokeShareLink(auditId: string): Promise<boolean> {
  const db = await getDb();
  // $set null rather than $unset so the stored shape matches schema.md; the partial index skips nulls.
  const { matchedCount } = await auditsCollection(db).updateOne(
    { _id: auditId },
    { $set: { shareToken: null, sharedAt: null } },
  );
  return matchedCount > 0;
}
