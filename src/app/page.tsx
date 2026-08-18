"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HistorySidebar } from "@/components/layout/history-sidebar";
import { Hero } from "@/components/home/hero";
import { AuditForm } from "@/components/home/audit-form";
import { SitemapUploadForm } from "@/components/home/sitemap-upload-form";
import { SitemapUrlSelector } from "@/components/home/sitemap-url-selector";
import { AuditProgress } from "@/components/shared/audit-progress";
import { SitemapCrawlProgress } from "@/components/shared/sitemap-crawl-progress";
import { ReportView } from "@/components/report/report-view";
import { SitemapCrawlResults } from "@/components/report/sitemap-crawl-results";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditStream } from "@/hooks/use-audit-stream";
import { useSitemapCrawl } from "@/hooks/use-sitemap-crawl";
import type { StoredAudit } from "@/lib/db/types";

export default function Home() {
  const { status, statusMessage, modules, report, error, runAudit, reset } = useAuditStream();
  const crawl = useSitemapCrawl();
  const [mode, setMode] = useState<"single" | "sitemap">("single");

  const [historicalAudit, setHistoricalAudit] = useState<StoredAudit | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (crawl.phase !== "crawling") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [crawl.phase]);

  // A live crawl just finished (single page or sitemap) — the history sidebar should pick it up.
  useEffect(() => {
    if (status === "complete" || crawl.phase === "done") {
      setHistoryRefreshToken((t) => t + 1);
    }
  }, [status, crawl.phase]);

  const loadHistoricalAudit = async (id: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/audits/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not load that crawl.");
      setHistoricalAudit(body as StoredAudit);
      setMobileSidebarOpen(false);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Could not load that crawl.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const startNewCrawl = () => {
    setHistoricalAudit(null);
    setHistoryError(null);
    reset();
    crawl.reset();
    setMobileSidebarOpen(false);
  };

  const idle = status === "idle" && crawl.phase === "idle";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader onToggleHistory={() => setMobileSidebarOpen((v) => !v)} />

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 shrink-0 md:block">
          <HistorySidebar
            activeAuditId={historicalAudit?.id ?? null}
            onSelectAudit={loadHistoricalAudit}
            onNewCrawl={startNewCrawl}
            refreshToken={historyRefreshToken}
          />
        </div>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="w-72 max-w-[85vw]">
              <HistorySidebar
                activeAuditId={historicalAudit?.id ?? null}
                onSelectAudit={loadHistoricalAudit}
                onNewCrawl={startNewCrawl}
                refreshToken={historyRefreshToken}
              />
            </div>
            <button
              type="button"
              aria-label="Close history"
              className="flex-1 bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
            />
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
          {historicalAudit ? (
            <div className="space-y-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Alert className="flex-1">
                  <AlertTitle>Viewing a past crawl</AlertTitle>
                  <AlertDescription>
                    Recorded {new Date(historicalAudit.crawledAt).toLocaleString()}. Screenshots aren&apos;t kept in
                    history; use the comparison tool below to see what changed since another crawl of this page.
                  </AlertDescription>
                </Alert>
                <Button variant="ghost" size="sm" onClick={startNewCrawl} className="shrink-0">
                  ← Back to live crawl
                </Button>
              </div>
              <ReportView report={historicalAudit.report} shareToken={historicalAudit.shareToken} />
            </div>
          ) : (
            <>
              {historyLoading && (
                <p className="mb-6 text-center text-sm text-muted-foreground">Loading crawl…</p>
              )}
              {historyError && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{historyError}</AlertDescription>
                </Alert>
              )}
              <AnimatePresence mode="wait">
          {idle && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <Hero />
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  setMode(value as "single" | "sitemap");
                  if (value === "single") crawl.reset();
                  else reset();
                }}
                className="mx-auto w-full max-w-2xl"
              >
                <TabsList className="mx-auto">
                  <TabsTrigger value="single">Single Page</TabsTrigger>
                  <TabsTrigger value="sitemap">Sitemap Crawl</TabsTrigger>
                </TabsList>
              </Tabs>
              {mode === "single" ? (
                <AuditForm onSubmit={runAudit} isRunning={false} />
              ) : (
                <SitemapUploadForm
                  onUpload={crawl.parseSitemap}
                  isParsing={false}
                  error={crawl.parseError}
                />
              )}
            </motion.div>
          )}

          {status === "running" && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10 py-12"
            >
              <Hero />
              <AuditForm onSubmit={runAudit} isRunning />
              <AuditProgress statusMessage={statusMessage} modules={modules} />
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-2xl space-y-6"
            >
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>The audit failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="text-center">
                <Button variant="outline" onClick={reset}>
                  Try again
                </Button>
              </div>
            </motion.div>
          )}

          {status === "complete" && report && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={reset}>
                  ← Audit another page
                </Button>
              </div>
              <ReportView report={report} />
            </motion.div>
          )}

          {crawl.phase === "parsing" && (
            <motion.div
              key="crawl-parsing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <Hero />
              <SitemapUploadForm onUpload={crawl.parseSitemap} isParsing error={null} />
            </motion.div>
          )}

          {crawl.phase === "selecting" && crawl.parseResult && (
            <motion.div
              key="crawl-selecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8 py-8"
            >
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={crawl.reset}>
                  ← Start over
                </Button>
              </div>
              <SitemapUrlSelector parseResult={crawl.parseResult} onStartCrawl={crawl.startCrawl} />
            </motion.div>
          )}

          {crawl.phase === "crawling" && (
            <motion.div
              key="crawl-running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10 py-12"
            >
              <Hero />
              <SitemapCrawlProgress urlStates={crawl.urlStates} />
            </motion.div>
          )}

          {crawl.phase === "done" && (
            <motion.div
              key="crawl-done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={crawl.reset}>
                  ← Crawl another sitemap
                </Button>
              </div>
              <SitemapCrawlResults urlStates={crawl.urlStates} />
            </motion.div>
          )}
              </AnimatePresence>
            </>
          )}
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
