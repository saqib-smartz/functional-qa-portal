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
}

export interface AuditPageSummary {
  url: string;
  crawlCount: number;
  latestCrawledAt: string;
  latestPageTitle: string | null;
}
