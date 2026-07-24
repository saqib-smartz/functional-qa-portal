import { describeNonSuccessStatus } from "@/lib/audit/blocked-page";
import { CATEGORIES, CATEGORY_LABELS, type AuditReport, type Finding } from "@/lib/audit/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Same GitHub Primer tokens used by Playwright's own HTML reporter, kept consistent with the app. */
const STATUS_COLORS: Record<Finding["status"], string> = {
  pass: "#1a7f37",
  warning: "#9a6700",
  fail: "#cf222e",
};

const SEVERITY_COLORS: Record<Finding["severity"], string> = {
  critical: "#cf222e",
  high: "#cf222e",
  medium: "#9a6700",
  low: "#0969da",
  info: "#57606a",
};

const LOGO_SVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="6" fill="#2da44e"/>
  <path d="M7 12.5l3 3 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function findingBlock(finding: Finding): string {
  const items =
    Array.isArray(finding.meta?.items) && finding.meta.items.length > 0
      ? `<ul class="items">${(finding.meta.items as unknown[])
          .slice(0, 10)
          .map((item) => `<li>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</li>`)
          .join("")}</ul>`
      : "";

  const screenshot = finding.screenshot
    ? `<img class="finding-screenshot" src="${finding.screenshot}" alt="" />`
    : "";

  return `
    <div class="finding">
      <div class="finding-badges">
        <span class="badge" style="background:${STATUS_COLORS[finding.status]}">${finding.status.toUpperCase()}</span>
        <span class="badge" style="background:${SEVERITY_COLORS[finding.severity]}">${finding.severity.toUpperCase()}</span>
      </div>
      <h4 class="finding-title">${escapeHtml(finding.title)}</h4>
      <p class="finding-url">${escapeHtml(finding.pageUrl)}</p>
      <p><strong>Description:</strong> ${escapeHtml(finding.description)}</p>
      <p><strong>Why this matters:</strong> ${escapeHtml(finding.whyItMatters)}</p>
      <p><strong>Recommendation:</strong> ${escapeHtml(finding.recommendation)}</p>
      <p><strong>Estimated Fix Time:</strong> ${escapeHtml(finding.estimatedFixTime)}</p>
      ${items}
      ${screenshot}
    </div>`;
}

export function buildReportHtml(report: AuditReport): string {
  const generatedAt = new Date(report.finishedAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const totalFail = report.findings.filter((f) => f.status === "fail").length;
  const totalWarning = report.findings.filter((f) => f.status === "warning").length;
  const totalPass = report.findings.filter((f) => f.status === "pass").length;
  const blockedWarning = describeNonSuccessStatus(report.httpStatus);

  const categorySections = CATEGORIES.map((category) => {
    const findings = report.findings.filter((f) => f.category === category);
    if (findings.length === 0) return "";
    return `
      <section class="category">
        <h2>${escapeHtml(CATEGORY_LABELS[category])}</h2>
        ${findings.map(findingBlock).join("")}
      </section>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>QA Audit Report — ${escapeHtml(report.url)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #24292f;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  .cover {
    padding: 48px 40px 32px;
    border-bottom: 3px solid #24292f;
  }
  .cover-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
  .cover-brand span { font-size: 15px; font-weight: 600; }
  .cover h1 { font-size: 26px; margin: 0 0 8px; }
  .cover .meta { color: #57606a; font-size: 12px; margin: 2px 0; }
  .cover .counts { margin-top: 20px; display: flex; gap: 16px; }
  .cover .counts div { font-size: 12px; }
  .cover .counts b { display: block; font-size: 20px; }
  section { padding: 0 40px; }
  .summary { padding: 28px 40px; background: #f6f8fa; }
  .summary h2 { font-size: 16px; margin: 0 0 8px; }
  .summary p { color: #24292f; white-space: pre-line; }
  .wp-detection { padding: 24px 40px; }
  .wp-detection h2 { font-size: 16px; }
  .screenshot-section { padding: 24px 40px; page-break-inside: avoid; }
  .screenshot-section img { width: 100%; border: 1px solid #d0d7de; border-radius: 4px; }
  .category { page-break-before: always; padding-top: 32px; }
  .category h2 { font-size: 18px; border-bottom: 2px solid #24292f; padding-bottom: 6px; margin-bottom: 16px; }
  .finding { border: 1px solid #d0d7de; border-radius: 6px; padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid; }
  .finding-badges { margin-bottom: 6px; }
  .badge { display: inline-block; color: white; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px; margin-right: 6px; }
  .finding-title { font-size: 13px; margin: 0 0 2px; }
  .finding-url { color: #8b949e; font-size: 10px; margin: 0 0 8px; word-break: break-all; }
  .finding p { margin: 4px 0; }
  .items { margin: 6px 0; padding-left: 18px; color: #57606a; font-size: 11px; }
  .finding-screenshot { width: 100%; margin-top: 8px; border: 1px solid #d0d7de; border-radius: 4px; }
  .blocked-banner { margin: 0 40px 24px; padding: 14px 16px; border: 1px solid #cf222e; border-radius: 6px; background: rgba(207,34,46,0.08); }
  .blocked-banner strong { display: block; color: #cf222e; font-size: 13px; margin-bottom: 4px; }
  .blocked-banner p { color: #24292f; font-size: 11px; margin: 0; }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-brand">${LOGO_SVG}<span>WordPress AI QA Auditor</span></div>
    <h1>QA Audit Report</h1>
    <p class="meta">Generated: ${escapeHtml(generatedAt)}</p>
    <p class="meta">Page: ${escapeHtml(report.pageTitle || "Untitled Page")}</p>
    <p class="meta">URL: ${escapeHtml(report.url)}</p>
    <p class="meta">HTTP Status: ${report.httpStatus}</p>
    <div class="counts">
      <div><b style="color:#dc2626">${totalFail}</b>Failed</div>
      <div><b style="color:#d97706">${totalWarning}</b>Warnings</div>
      <div><b style="color:#059669">${totalPass}</b>Passed</div>
    </div>
  </div>

  ${
    blockedWarning
      ? `<div class="blocked-banner"><strong>This audit may be unreliable — the page didn't load normally</strong><p>${escapeHtml(blockedWarning)}</p></div>`
      : ""
  }

  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${escapeHtml(report.executiveSummary)}</p>
  </div>

  <div class="wp-detection">
    <h2>WordPress Detection</h2>
    <p><strong>Is WordPress:</strong> ${report.wordpress.isWordPress ? "Yes" : "No"}</p>
    ${report.wordpress.theme ? `<p><strong>Theme:</strong> ${escapeHtml(report.wordpress.theme)}${report.wordpress.themeConfidence ? ` (${report.wordpress.themeConfidence} confidence)` : ""}</p>` : ""}
    <p><strong>Plugins:</strong> ${report.wordpress.plugins.length > 0 ? escapeHtml(report.wordpress.plugins.join(", ")) : "None detected"}</p>
  </div>

  ${
    report.screenshots.desktop
      ? `<div class="screenshot-section"><h2>Full-Page Screenshot (Desktop)</h2><img src="${report.screenshots.desktop}" alt="Desktop screenshot" /></div>`
      : ""
  }

  ${categorySections}
</body>
</html>`;
}
