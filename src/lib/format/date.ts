const AUDIT_TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * Formats an audit timestamp identically on server and client — ReportView is SSR'd on the public
 * share page, so a locale/timezone-dependent toLocaleString() would produce a hydration mismatch.
 */
export function formatAuditTimestamp(iso: string): string {
  return `${AUDIT_TIMESTAMP_FORMAT.format(new Date(iso))} UTC`;
}
