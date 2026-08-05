import { diffLines, type Change } from "diff";
import type { Finding } from "@/lib/audit/types";
import type { AuditSummary, StoredAudit } from "@/lib/db/types";

export interface ComparisonResult {
  older: AuditSummary;
  newer: AuditSummary;
  findings: {
    /** present in the newer crawl, not the older one */
    added: Finding[];
    /** present in the older crawl, not the newer one */
    resolved: Finding[];
    /** present in both crawls */
    unchanged: Finding[];
  };
  contentDiff: Change[];
}

/**
 * Findings get fresh ids every run, and both the title and description frequently embed
 * volatile numbers (byte counts, element counts, millisecond timings) that change slightly
 * between crawls even when the underlying pass/fail state hasn't. Matching on the raw
 * title+description (as before) made nearly every numeric finding look "resolved" and
 * "new" simultaneously on every comparison.
 *
 * Instead we match on a coarser anchor that ignores those numbers: the AI's quoted original
 * snippet when present (stable, copied verbatim from page text, used so distinct grammar
 * issues with the same title don't collapse into one), falling back to the title with all
 * digit runs blanked out for deterministic (non-AI) findings. The description is intentionally
 * excluded from the key — it's display detail, not identity.
 */
function findingKey(f: Finding): string {
  if (typeof f.meta?.original === "string") {
    return `${f.category}::${f.meta.original}`;
  }
  const normalizedTitle = f.title.replace(/\d+/g, "#");
  return `${f.category}::${normalizedTitle}`;
}

/** A "pass" is a confirmation nothing is wrong — not an issue, so it has no place in a before/after diff. */
function isIssue(f: Finding): boolean {
  return f.status !== "pass";
}

function toSummary(audit: StoredAudit): AuditSummary {
  const { id, url, crawledAt, pageTitle, httpStatus } = audit;
  return { id, url, crawledAt, pageTitle, httpStatus };
}

/** Order of arguments doesn't matter — older/newer is determined by crawledAt. */
export function compareAudits(x: StoredAudit, y: StoredAudit): ComparisonResult {
  const [older, newer] = x.crawledAt <= y.crawledAt ? [x, y] : [y, x];

  const olderKeys = new Map(older.report.findings.filter(isIssue).map((f) => [findingKey(f), f]));
  const newerKeys = new Map(newer.report.findings.filter(isIssue).map((f) => [findingKey(f), f]));

  const added: Finding[] = [];
  const unchanged: Finding[] = [];
  for (const [key, finding] of newerKeys) {
    if (olderKeys.has(key)) unchanged.push(finding);
    else added.push(finding);
  }

  const resolved: Finding[] = [];
  for (const [key, finding] of olderKeys) {
    if (!newerKeys.has(key)) resolved.push(finding);
  }

  return {
    older: toSummary(older),
    newer: toSummary(newer),
    findings: { added, resolved, unchanged },
    contentDiff: diffLines(older.pageText, newer.pageText),
  };
}
