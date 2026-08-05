import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";

const MAX_REQUEST_COUNT = 80;
const MAX_PAGE_WEIGHT_BYTES = 3 * 1024 * 1024; // ~3MB
const MAX_JS_BYTES = 1 * 1024 * 1024; // ~1MB
const MAX_CSS_BYTES = 300 * 1024; // ~300KB
const LARGE_IMAGE_THRESHOLD_BYTES = 500 * 1024; // ~500KB
const MAX_LISTED_ITEMS = 10;
const MAX_CLS = 0.1; // Core Web Vitals "good" threshold; above this is at best "needs improvement"
const LCP_GOOD_MS = 2500; // Core Web Vitals "good" threshold
const LCP_POOR_MS = 4000; // Core Web Vitals "poor" threshold

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
  cumulativeLayoutShift: number;
  largestContentfulPaintMs: number | undefined;
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

        // layout-shift and largest-contentful-paint aren't in every lib.dom.d.ts version,
        // and not every browser/context supports these buffered entry types, so guard both
        // the lookup and the shape with an inline cast.
        let layoutShiftEntries: Array<{ value: number; hadRecentInput: boolean }> = [];
        try {
          layoutShiftEntries = performance.getEntriesByType("layout-shift") as unknown as Array<{
            value: number;
            hadRecentInput: boolean;
          }>;
        } catch {
          layoutShiftEntries = [];
        }
        const cumulativeLayoutShift = layoutShiftEntries
          .filter((entry) => !entry.hadRecentInput)
          .reduce((sum, entry) => sum + entry.value, 0);

        let lcpEntries: Array<{ startTime: number; renderTime: number }> = [];
        try {
          lcpEntries = performance.getEntriesByType("largest-contentful-paint") as unknown as Array<{
            startTime: number;
            renderTime: number;
          }>;
        } catch {
          lcpEntries = [];
        }
        const lastLcpEntry = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : undefined;
        const largestContentfulPaintMs = lastLcpEntry
          ? lastLcpEntry.renderTime || lastLcpEntry.startTime
          : undefined;

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
          cumulativeLayoutShift,
          largestContentfulPaintMs,
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

    // 7. Cumulative Layout Shift (CLS)
    const cls = perf.cumulativeLayoutShift;
    if (cls > MAX_CLS) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Cumulative Layout Shift is high",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `Cumulative Layout Shift (CLS) measured ${cls.toFixed(2)}, above the ${MAX_CLS.toFixed(2)} "good" threshold.`,
          whyItMatters: "A high CLS score hurts Core Web Vitals and means visible content is jumping around as the page loads, which can cause mis-clicks and a poor user experience.",
          recommendation: "Set explicit width/height (or aspect-ratio) on images and embeds, avoid inserting content above existing content, and preload web fonts to reduce layout shifts.",
          estimatedFixTime: "1 hour",
          meta: { cls: Number(cls.toFixed(2)) },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Cumulative Layout Shift is within a healthy range",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `Cumulative Layout Shift (CLS) measured ${cls.toFixed(2)}, within the ${MAX_CLS.toFixed(2)} "good" threshold.`,
          whyItMatters: "A low CLS score means page content is visually stable as it loads, which is good for user experience and Core Web Vitals.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { cls: Number(cls.toFixed(2)) },
        }),
      );
    }

    // 8. Largest Contentful Paint (LCP)
    if (perf.largestContentfulPaintMs !== undefined) {
      const lcpMs = Math.round(perf.largestContentfulPaintMs);
      if (lcpMs > LCP_POOR_MS) {
        findings.push(
          makeFinding({
            category: "performance",
            title: "Largest Contentful Paint is poor",
            status: "fail",
            severity: "high",
            pageUrl: ctx.url,
            description: `Largest Contentful Paint (LCP) occurred at ~${lcpMs}ms, above the ${LCP_POOR_MS}ms "poor" threshold.`,
            whyItMatters: "LCP measures when the main content becomes visible. A poor LCP score is a strong Core Web Vitals failure and signals a slow, frustrating loading experience.",
            recommendation: "Optimize the largest above-the-fold element: compress/preload its image, remove render-blocking resources, and improve server response time.",
            estimatedFixTime: "2 hours",
            meta: { lcpMs },
          }),
        );
      } else if (lcpMs > LCP_GOOD_MS) {
        findings.push(
          makeFinding({
            category: "performance",
            title: "Largest Contentful Paint needs improvement",
            status: "warning",
            severity: "medium",
            pageUrl: ctx.url,
            description: `Largest Contentful Paint (LCP) occurred at ~${lcpMs}ms, between the ${LCP_GOOD_MS}ms "good" and ${LCP_POOR_MS}ms "poor" thresholds.`,
            whyItMatters: "LCP measures when the main content becomes visible. Scores in this range are a Core Web Vitals warning and can indicate a sluggish loading experience for some visitors.",
            recommendation: "Optimize the largest above-the-fold element: compress/preload its image, remove render-blocking resources, and improve server response time.",
            estimatedFixTime: "1 hour",
            meta: { lcpMs },
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "performance",
            title: "Largest Contentful Paint is good",
            status: "pass",
            severity: "info",
            pageUrl: ctx.url,
            description: `Largest Contentful Paint (LCP) occurred at ~${lcpMs}ms, within the ${LCP_GOOD_MS}ms "good" threshold.`,
            whyItMatters: "A good LCP score means the main content of the page becomes visible quickly, which is central to Core Web Vitals and perceived performance.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
            meta: { lcpMs },
          }),
        );
      }
    }

    // 9. Render-blocking resources in <head>
    const headScripts = ctx.$("head script[src]").toArray();
    const blockingScripts = headScripts.filter((el) => {
      const $el = ctx.$(el);
      const hasAsync = $el.attr("async") !== undefined;
      const hasDefer = $el.attr("defer") !== undefined;
      const isModule = $el.attr("type") === "module";
      return !hasAsync && !hasDefer && !isModule;
    });
    const blockingScriptSrcs = blockingScripts.map((el) => ctx.$(el).attr("src") ?? "").filter(Boolean);

    const headStylesheets = ctx.$("head link[rel='stylesheet']").toArray();
    const blockingStylesheetCount = headStylesheets.filter((el) => {
      const media = ctx.$(el).attr("media");
      return !media || media === "all" || media === "screen";
    }).length;

    if (blockingScriptSrcs.length > 0) {
      const items = blockingScriptSrcs.slice(0, MAX_LISTED_ITEMS);
      findings.push(
        makeFinding({
          category: "performance",
          title: "Render-blocking scripts found in <head>",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `${blockingScriptSrcs.length} script(s) in <head> lack async/defer and will block HTML parsing.${blockingScriptSrcs.length > MAX_LISTED_ITEMS ? ` Showing the first ${MAX_LISTED_ITEMS}.` : ""} For reference, ${blockingStylesheetCount} stylesheet(s) in <head> are also render-blocking, which is normal and largely unavoidable.`,
          whyItMatters: "Render-blocking scripts delay First Contentful Paint because the browser must download and execute them before it can continue parsing the rest of the HTML.",
          recommendation: "Add the `async` or `defer` attribute to non-critical scripts, or move them to just before the closing </body> tag.",
          estimatedFixTime: "30 minutes",
          meta: { items },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "No render-blocking scripts found in <head>",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `No scripts in <head> block HTML parsing. ${blockingStylesheetCount} stylesheet(s) in <head> are render-blocking, which is normal and largely unavoidable.`,
          whyItMatters: "Avoiding render-blocking scripts helps the browser parse HTML and reach First Contentful Paint sooner.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 10. Response compression
    const contentEncoding = ctx.responseHeaders["content-encoding"];
    const isCompressed =
      !!contentEncoding &&
      (contentEncoding.includes("gzip") || contentEncoding.includes("br") || contentEncoding.includes("deflate"));

    if (!isCompressed) {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Response is not compressed",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: `The main document response did not include a recognized compression Content-Encoding (gzip, br, or deflate)${contentEncoding ? `; found "${contentEncoding}"` : ""}.`,
          whyItMatters: "Uncompressed HTML transfers 3-5x more bytes than gzip/brotli-compressed responses, slowing every visitor's initial page load.",
          recommendation: "Enable gzip or brotli compression at the web server or CDN level (e.g. mod_deflate, a Brotli module, or a CDN setting).",
          estimatedFixTime: "30 minutes",
          meta: { contentEncoding: contentEncoding ?? null },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "performance",
          title: "Response compression is enabled",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `The main document response is compressed using "${contentEncoding}".`,
          whyItMatters: "Compressed responses transfer fewer bytes, speeding up initial page load for every visitor.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { contentEncoding },
        }),
      );
    }

    return findings;
  },
};
