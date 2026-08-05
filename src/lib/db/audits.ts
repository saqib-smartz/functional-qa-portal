import type { RowDataPacket } from "mysql2";
import { getDbPool } from "./client";
import type { AuditReport } from "@/lib/audit/types";
import type { AuditPageSummary, AuditSummary, StoredAudit } from "./types";

/** Historical rows omit screenshots (base64 data URLs) — sizable and only needed for the live view. */
function stripScreenshots(report: AuditReport): AuditReport {
  return { ...report, screenshots: { desktop: "", tablet: "", mobile: "" } };
}

export async function recordAudit(
  report: AuditReport,
  pageText: string,
  crawlBatchId?: string,
): Promise<void> {
  const pool = getDbPool();
  await pool.execute(
    `INSERT INTO audits (id, url, crawled_at, page_title, http_status, page_text, report, crawl_batch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      report.id,
      report.url,
      new Date(report.finishedAt),
      report.pageTitle,
      report.httpStatus,
      pageText,
      JSON.stringify(stripScreenshots(report)),
      crawlBatchId ?? null,
    ],
  );
}

interface AuditSummaryRow extends RowDataPacket {
  id: string;
  url: string;
  crawled_at: Date;
  page_title: string | null;
  http_status: number | null;
}

export async function listAuditsForUrl(url: string): Promise<AuditSummary[]> {
  const pool = getDbPool();
  const [rows] = await pool.execute<AuditSummaryRow[]>(
    `SELECT id, url, crawled_at, page_title, http_status
     FROM audits WHERE url = ? ORDER BY crawled_at DESC`,
    [url],
  );
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    crawledAt: row.crawled_at.toISOString(),
    pageTitle: row.page_title,
    httpStatus: row.http_status,
  }));
}

/**
 * One row per distinct crawled URL, grouped in JS rather than SQL (GROUP BY + "latest title"
 * needs either a window function or a fragile GROUP_CONCAT hack; a plain ordered scan is simpler
 * and the audits table is small enough that this isn't a concern) — used to build the sidebar's
 * site/page tree. Capped since this pulls every row; revisit if the table grows past this.
 */
export async function listAuditPagesSummary(): Promise<AuditPageSummary[]> {
  const pool = getDbPool();
  const [rows] = await pool.execute<AuditSummaryRow[]>(
    `SELECT id, url, crawled_at, page_title, http_status
     FROM audits ORDER BY crawled_at DESC LIMIT 5000`,
  );

  const byUrl = new Map<string, AuditPageSummary>();
  for (const row of rows) {
    const existing = byUrl.get(row.url);
    if (existing) {
      existing.crawlCount += 1;
    } else {
      byUrl.set(row.url, {
        url: row.url,
        crawlCount: 1,
        latestCrawledAt: row.crawled_at.toISOString(),
        latestPageTitle: row.page_title,
      });
    }
  }
  return Array.from(byUrl.values()).sort((a, b) => b.latestCrawledAt.localeCompare(a.latestCrawledAt));
}

interface StoredAuditRow extends AuditSummaryRow {
  page_text: string;
  report: AuditReport | string;
  crawl_batch_id: string | null;
}

export async function getAuditById(id: string): Promise<StoredAudit | null> {
  const pool = getDbPool();
  const [rows] = await pool.execute<StoredAuditRow[]>(
    `SELECT id, url, crawled_at, page_title, http_status, page_text, report, crawl_batch_id
     FROM audits WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    crawledAt: row.crawled_at.toISOString(),
    pageTitle: row.page_title,
    httpStatus: row.http_status,
    pageText: row.page_text,
    report: typeof row.report === "string" ? JSON.parse(row.report) : row.report,
    crawlBatchId: row.crawl_batch_id ?? undefined,
  };
}
