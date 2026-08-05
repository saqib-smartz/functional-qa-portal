"use client";

import { useCallback, useState } from "react";
import type { AuditReport } from "@/lib/audit/types";
import { runAuditRequest } from "@/lib/audit/run-audit-request";
import { runWithConcurrencyLimit } from "@/lib/concurrency/run-pool";
import type { SitemapParseResult } from "@/lib/sitemap/types";

export interface CrawlUrlState {
  url: string;
  status: "pending" | "running" | "done" | "error";
  statusMessage?: string;
  report?: AuditReport;
  error?: string;
}

export type CrawlPhase = "idle" | "parsing" | "selecting" | "crawling" | "done";

/** Each page costs 2 Claude API calls (grammar + executive summary) — keep this low by default. */
const DEFAULT_CONCURRENCY = 2;

interface UseSitemapCrawlResult {
  phase: CrawlPhase;
  parseResult: SitemapParseResult | null;
  parseError: string | null;
  urlStates: CrawlUrlState[];
  parseSitemap: (xml: string) => Promise<void>;
  startCrawl: (urls: string[], concurrency?: number) => Promise<void>;
  reset: () => void;
}

export function useSitemapCrawl(): UseSitemapCrawlResult {
  const [phase, setPhase] = useState<CrawlPhase>("idle");
  const [parseResult, setParseResult] = useState<SitemapParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [urlStates, setUrlStates] = useState<CrawlUrlState[]>([]);

  const reset = useCallback(() => {
    setPhase("idle");
    setParseResult(null);
    setParseError(null);
    setUrlStates([]);
  }, []);

  const parseSitemap = useCallback(async (xml: string) => {
    setPhase("parsing");
    setParseError(null);
    try {
      const res = await fetch("/api/sitemap/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? `Request failed with status ${res.status}.`);
      }
      setParseResult(body as SitemapParseResult);
      setPhase("selecting");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not parse the sitemap.");
      setPhase("idle");
    }
  }, []);

  const startCrawl = useCallback(async (urls: string[], concurrency = DEFAULT_CONCURRENCY) => {
    const crawlBatchId = crypto.randomUUID();
    setUrlStates(urls.map((url) => ({ url, status: "pending" })));
    setPhase("crawling");

    const updateUrl = (url: string, patch: Partial<CrawlUrlState>) => {
      setUrlStates((prev) => prev.map((u) => (u.url === url ? { ...u, ...patch } : u)));
    };

    await runWithConcurrencyLimit(urls, concurrency, async (url) => {
      updateUrl(url, { status: "running", statusMessage: "Starting audit…" });
      try {
        const report = await runAuditRequest(
          url,
          (event) => {
            if (event.type === "status") updateUrl(url, { statusMessage: event.message });
          },
          crawlBatchId,
        );
        updateUrl(url, { status: "done", report, statusMessage: undefined });
      } catch (err) {
        updateUrl(url, {
          status: "error",
          error: err instanceof Error ? err.message : "Audit failed.",
          statusMessage: undefined,
        });
      }
    });

    setPhase("done");
  }, []);

  return { phase, parseResult, parseError, urlStates, parseSitemap, startCrawl, reset };
}
