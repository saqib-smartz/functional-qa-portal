import type { AuditContext, AuditModule, AuditReport, AuditStreamEvent, Finding } from "./types";
import { makeFinding } from "./types";
import { getBrowser } from "./browser";
import { fetchPage } from "./fetch-page";
import { captureScreenshot } from "./screenshots";

import { homepageModule } from "./modules/homepage";
import { seoModule } from "./modules/seo";
import { wordpressDetectionModule } from "./modules/wordpress-detection";
import { imagesModule } from "./modules/images";
import { linksModule } from "./modules/links";
import { contentQualityModule } from "./modules/content-quality";
import { securityModule } from "./modules/security";
import { downloadsModule } from "./modules/downloads";
import { cookieBannerModule } from "./modules/cookie-banner";
import { performanceModule } from "./modules/performance";
import { responsiveModule } from "./modules/responsive";
import { navigationModule } from "./modules/navigation";
import { searchModule } from "./modules/search";
import { formsModule } from "./modules/forms";

import { extractVisibleText } from "./ai/extract-text";
import { analyzeGrammar } from "./ai/grammar-analysis";
import { generateExecutiveSummary } from "./ai/executive-summary";

/** Phase A + B: independent of each other, safe to run concurrently. */
const CONCURRENT_PHASES: AuditModule[][] = [
  // Phase A — static/Cheerio only, no live-page interaction
  [
    homepageModule,
    seoModule,
    wordpressDetectionModule,
    imagesModule,
    linksModule,
    contentQualityModule,
    securityModule,
    downloadsModule,
    cookieBannerModule,
  ],
  // Phase B — live page, read-only
  [performanceModule],
];

/**
 * Phase C + D: each mutates the live page (viewport resize, navigation, form submission),
 * so they must run one at a time, in this order, to avoid invalidating each other's state.
 */
const SEQUENTIAL_MODULES: AuditModule[] = [
  responsiveModule,
  navigationModule,
  searchModule,
  formsModule,
];

type Emit = (event: AuditStreamEvent) => void;

async function runModule(mod: AuditModule, ctx: AuditContext, findings: Finding[], emit: Emit) {
  emit({ type: "module-start", category: mod.category, label: mod.label });
  try {
    const result = await mod.run(ctx);
    findings.push(...result);
    emit({ type: "module-done", category: mod.category, findingsCount: result.length });
  } catch (err) {
    emit({
      type: "module-error",
      category: mod.category,
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export async function runAudit(url: string, emit: Emit): Promise<AuditReport> {
  const startedAt = new Date().toISOString();
  const findings: Finding[] = [];

  emit({ type: "status", message: "Launching browser…" });
  const browser = await getBrowser();

  try {
    emit({ type: "status", message: `Loading ${url}…` });
    const { context, page, html, $, httpStatus, responseHeaders } = await fetchPage(browser, url);

    try {
      const pageTitle = await page.title();

      emit({ type: "status", message: "Capturing desktop screenshot…" });
      const desktopScreenshot = await captureScreenshot(page);

      const ctx: AuditContext = {
        url,
        page,
        browserContext: context,
        browser,
        html,
        $,
        httpStatus,
        responseHeaders,
        screenshots: { desktop: desktopScreenshot, tablet: "", mobile: "" },
        wordpress: { isWordPress: false, plugins: [] },
      };

      for (const phase of CONCURRENT_PHASES) {
        await Promise.all(phase.map((mod) => runModule(mod, ctx, findings, emit)));
      }
      for (const mod of SEQUENTIAL_MODULES) {
        await runModule(mod, ctx, findings, emit);
      }

      emit({ type: "module-start", category: "grammar", label: "Grammar & Spelling" });
      try {
        // navigation/search/forms may have left the live page on a results/thank-you page —
        // grammar analysis must reflect the originally submitted page, not wherever we ended up.
        if (ctx.page.url() !== url) {
          await ctx.page
            .goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
            .catch(() => undefined);
        }
        const text = await extractVisibleText(ctx.page);
        const grammarFindings = await analyzeGrammar(text, ctx);
        findings.push(...grammarFindings);
        emit({ type: "module-done", category: "grammar", findingsCount: grammarFindings.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Grammar analysis failed";
        findings.push(
          makeFinding({
            category: "grammar",
            title: "AI grammar analysis failed",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description: `Automated grammar/spelling analysis did not complete: ${message}`,
            whyItMatters:
              "Spelling and grammar mistakes on a live page reflect poorly on brand credibility and can confuse visitors.",
            recommendation: "Re-run the audit. If this keeps failing, check the server logs and the ANTHROPIC_API_KEY configuration.",
            estimatedFixTime: "N/A",
          }),
        );
        emit({ type: "module-error", category: "grammar", message });
      }

      emit({ type: "status", message: "Generating executive summary…" });
      const executiveSummary = await generateExecutiveSummary(ctx, findings);

      const report: AuditReport = {
        id: crypto.randomUUID(),
        url,
        pageTitle,
        startedAt,
        finishedAt: new Date().toISOString(),
        httpStatus,
        screenshots: ctx.screenshots,
        wordpress: ctx.wordpress,
        findings,
        executiveSummary,
      };

      emit({ type: "complete", report });
      return report;
    } finally {
      await context.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}
