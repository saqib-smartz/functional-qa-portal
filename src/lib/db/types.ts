import type { AuditReport } from "@/lib/audit/types";

export interface AuditSummary {
  id: string;
  url: string;
  crawledAt: string;
  pageTitle: string | null;
  httpStatus: number | null;
}

export interface StoredAudit extends AuditSummary {
  pageText: string;
  report: AuditReport;
  crawlBatchId?: string;
  /** null when this audit has never been shared, or its link was revoked. */
  shareToken: string | null;
}

export interface AuditPageSummary {
  url: string;
  crawlCount: number;
  latestCrawledAt: string;
  latestPageTitle: string | null;
}

/** Public projection of a shared audit — deliberately omits pageText, crawlBatchId and the token itself. */
export interface SharedAudit {
  id: string;
  url: string;
  crawledAt: string;
  pageTitle: string | null;
  httpStatus: number | null;
  report: AuditReport;
}

export interface ShareLink {
  token: string;
  sharedAt: string;
}
