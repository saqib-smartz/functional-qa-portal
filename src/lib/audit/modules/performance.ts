import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";

const MAX_REQUEST_COUNT = 80;
const MAX_PAGE_WEIGHT_BYTES = 3 * 1024 * 1024; // ~3MB
const MAX_JS_BYTES = 1 * 1024 * 1024; // ~1MB
const MAX_CSS_BYTES = 300 * 1024; // ~300KB
const LARGE_IMAGE_THRESHOLD_BYTES = 500 * 1024; // ~500KB
const MAX_LISTED_ITEMS = 10;

interface ResourceEntrySummary {
  name: string;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  duration: number;
}

interface PagePerformanceSnapshot {
  resources: ResourceEntrySummary[];
  pageWeight: number | undefined;
  domContentLoaded: number | undefined;
  loadComplete: number | undefined;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/** transferSize is 0 for cached responses / cross-origin resources without Timing-Allow-Origin, so fall back to encodedBodySize. */
function effectiveSize(resource: ResourceEntrySummary): number {
  return resource.transferSize > 0 ? resource.transferSize : resource.encodedBodySize;
}

function isScriptResource(initiatorType: string): boolean {
  return initiatorType === "script";
}

function isCssResource(initiatorType: string): boolean {
  return initiatorType === "css" || initiatorType === "link";
}

function isImageResource(initiatorType: string): boolean {
  return initiatorType === "img" || initiatorType === "image";
}

export const performanceModule: AuditModule = {
  category: "performance",
  label: "Performance",
  run: async (ctx) => {
    const findings: Finding[] = [];

    let perf: PagePerformanceSnapshot;
    try {
      perf = await ctx.page.evaluate(() => {
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        return {
          resources: resources.map((r) => ({
            name: r.name,
            initiatorType: r.initiatorType,
            transferSize: r.transferSize,
            encodedBodySize: r.encodedBodySize,
            duration: r.duration,
          })),
          pageWeight: nav ? nav.transferSize : undefined,
          domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : undefined,
          loadComplete: nav ? nav.loadEventEnd - nav.startTime : undefined,
        };
      });
    } catch (err) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Performance metrics unavailable",
          status: "warning",
          severity: "low",
          pageUrl: ctx.url,
          description: `Could not collect browser Performance API metrics for this page: ${err instanceof Error ? err.message : String(err)}`,
          whyItMatters: "Without performance metrics, page weight and load-time regressions may go unnoticed.",
          recommendation: "Re-run the audit, or check page performance manually using browser devtools.",
          estimatedFixTime: "15 minutes",
        }),
      );
      return findings;
    }

    const { resources } = perf;

    // 1. Total request count
    const requestCount = resources.length;
    if (requestCount > MAX_REQUEST_COUNT) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "High number of network requests",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `The page issued ${requestCount} resource requests, above the ~${MAX_REQUEST_COUNT} guideline commonly used as a rule of thumb for a lean page.`,
          whyItMatters: "Each additional request adds latency and connection overhead, especially on slower networks and mobile devices.",
          recommendation: "Combine/bundle assets, lazy-load below-the-fold resources, and audit third-party scripts to reduce request count.",
          estimatedFixTime: "2 hours",
          meta: { requestCount },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Reasonable number of network requests",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `The page issued ${requestCount} resource requests, within the ~${MAX_REQUEST_COUNT} guideline commonly used as a rule of thumb for a lean page.`,
          whyItMatters: "Fewer requests generally means faster load times, particularly on slower networks and mobile devices.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { requestCount },
        }),
      );
    }

    // 2. Total page weight
    const totalTransferred = resources.reduce((sum, r) => sum + effectiveSize(r), 0);
    const pageWeight = perf.pageWeight && perf.pageWeight > 0 ? perf.pageWeight : totalTransferred;
    if (pageWeight > MAX_PAGE_WEIGHT_BYTES) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Total page weight is high",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `Total transferred size across all resources is approximately ${formatBytes(pageWeight)}, above the ~${formatBytes(MAX_PAGE_WEIGHT_BYTES)} guideline.`,
          whyItMatters: "Heavier pages take longer to load, consume more mobile data, and can hurt Core Web Vitals and search rankings.",
          recommendation: "Compress and lazy-load images, minify/tree-shake JS and CSS, and audit third-party embeds for unnecessary weight.",
          estimatedFixTime: "2 hours",
          meta: { pageWeightBytes: pageWeight },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Total page weight is reasonable",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `Total transferred size across all resources is approximately ${formatBytes(pageWeight)}, within the ~${formatBytes(MAX_PAGE_WEIGHT_BYTES)} guideline.`,
          whyItMatters: "Lighter pages load faster and consume less data, especially on mobile connections.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { pageWeightBytes: pageWeight },
        }),
      );
    }

    // 3. Largest individual images
    const largeImages = resources
      .filter((r) => isImageResource(r.initiatorType) && effectiveSize(r) > LARGE_IMAGE_THRESHOLD_BYTES)
      .sort((a, b) => effectiveSize(b) - effectiveSize(a));

    if (largeImages.length > 0) {
      const items = largeImages.slice(0, MAX_LISTED_ITEMS).map((r) => `${r.name} (${formatBytes(effectiveSize(r))})`);
      findings.push(
        makeFinding({
          category: "performance",
          title: "Large image resources found",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `${largeImages.length} image(s) exceed ${formatBytes(LARGE_IMAGE_THRESHOLD_BYTES)} in transferred size.${largeImages.length > MAX_LISTED_ITEMS ? ` Showing the largest ${MAX_LISTED_ITEMS}.` : ""}`,
          whyItMatters: "Oversized images are one of the most common causes of slow page loads and poor Largest Contentful Paint (LCP) scores.",
          recommendation: "Compress these images, serve modern formats (WebP/AVIF), and use responsive image srcsets.",
          estimatedFixTime: "1 hour",
          meta: { items },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "No oversized images detected",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `No individual image resource exceeded ${formatBytes(LARGE_IMAGE_THRESHOLD_BYTES)} in transferred size.`,
          whyItMatters: "Well-optimized images keep pages fast, particularly for Largest Contentful Paint (LCP).",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 4. Total JS transfer size
    const jsBytes = resources.filter((r) => isScriptResource(r.initiatorType)).reduce((sum, r) => sum + effectiveSize(r), 0);
    if (jsBytes > MAX_JS_BYTES) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "JavaScript payload is large",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `Scripts total approximately ${formatBytes(jsBytes)} transferred, above the ~${formatBytes(MAX_JS_BYTES)} guideline.`,
          whyItMatters: "Large JS payloads delay interactivity and can hurt Total Blocking Time / Interaction to Next Paint scores.",
          recommendation: "Code-split, defer non-critical scripts, remove unused third-party scripts, and minify bundles.",
          estimatedFixTime: "2 hours",
          meta: { jsBytes },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "JavaScript payload is reasonable",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `Scripts total approximately ${formatBytes(jsBytes)} transferred, within the ~${formatBytes(MAX_JS_BYTES)} guideline.`,
          whyItMatters: "Lean JS payloads keep the page interactive sooner.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { jsBytes },
        }),
      );
    }

    // 5. Total CSS transfer size
    const cssBytes = resources.filter((r) => isCssResource(r.initiatorType)).reduce((sum, r) => sum + effectiveSize(r), 0);
    if (cssBytes > MAX_CSS_BYTES) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "CSS payload is large",
          status: "warning",
          severity: "low",
          pageUrl: ctx.url,
          description: `Stylesheets total approximately ${formatBytes(cssBytes)} transferred, above the ~${formatBytes(MAX_CSS_BYTES)} guideline.`,
          whyItMatters: "Large, render-blocking CSS delays First Contentful Paint.",
          recommendation: "Remove unused CSS, split critical/non-critical styles, and minify stylesheets.",
          estimatedFixTime: "1 hour",
          meta: { cssBytes },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "CSS payload is reasonable",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `Stylesheets total approximately ${formatBytes(cssBytes)} transferred, within the ~${formatBytes(MAX_CSS_BYTES)} guideline.`,
          whyItMatters: "Lean CSS keeps rendering fast.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { cssBytes },
        }),
      );
    }

    // 6. Load timing
    if (perf.domContentLoaded !== undefined && perf.loadComplete !== undefined) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Page load timing",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `DOMContentLoaded fired at ~${Math.round(perf.domContentLoaded)}ms and the load event completed at ~${Math.round(perf.loadComplete)}ms after navigation start. These are single-run observations from one page load, not a repeated-trial lab benchmark (e.g. Lighthouse), so treat them as directional rather than precise.`,
          whyItMatters: "Slow DOMContentLoaded/load times correlate with poor perceived performance and can affect Core Web Vitals and SEO.",
          recommendation: "If these times seem high, re-test under controlled conditions (e.g. Lighthouse/WebPageTest) and investigate render-blocking resources.",
          estimatedFixTime: "30 minutes",
          meta: { domContentLoadedMs: Math.round(perf.domContentLoaded), loadCompleteMs: Math.round(perf.loadComplete) },
        }),
      );
    }

    return findings;
  },
};
