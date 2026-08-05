"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Globe, History, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuditPageSummary, AuditSummary } from "@/lib/db/types";

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
  } catch {
    return url;
  }
}

function formatCrawledAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface SiteGroup {
  hostname: string;
  pages: AuditPageSummary[];
}

function groupByHostname(pages: AuditPageSummary[]): SiteGroup[] {
  const byHost = new Map<string, AuditPageSummary[]>();
  for (const page of pages) {
    const host = hostnameOf(page.url);
    const list = byHost.get(host);
    if (list) list.push(page);
    else byHost.set(host, [page]);
  }
  return Array.from(byHost.entries())
    .map(([hostname, sitePages]) => ({
      hostname,
      pages: sitePages.sort((a, b) => a.url.localeCompare(b.url)),
    }))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
}

interface HistorySidebarProps {
  activeAuditId: string | null;
  onSelectAudit: (id: string) => void;
  onNewCrawl: () => void;
  /** Bump this (e.g. on audit completion) to force the page list to refetch. */
  refreshToken: number;
}

export function HistorySidebar({ activeAuditId, onSelectAudit, onNewCrawl, refreshToken }: HistorySidebarProps) {
  const [pages, setPages] = useState<AuditPageSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [datesByUrl, setDatesByUrl] = useState<Record<string, AuditSummary[]>>({});
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  const loadPages = () => {
    setLoading(true);
    fetch("/api/audits/pages")
      .then((res) => res.json())
      .then((body: { pages?: AuditPageSummary[] }) => setPages(body.pages ?? []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  };

  useEffect(loadPages, [refreshToken]);

  const toggleSite = (hostname: string) => {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(hostname)) next.delete(hostname);
      else next.add(hostname);
      return next;
    });
  };

  const togglePage = (url: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
        if (!datesByUrl[url]) {
          setLoadingUrl(url);
          fetch(`/api/audits?url=${encodeURIComponent(url)}`)
            .then((res) => res.json())
            .then((body: { audits?: AuditSummary[] }) => {
              setDatesByUrl((d) => ({ ...d, [url]: body.audits ?? [] }));
            })
            .catch(() => setDatesByUrl((d) => ({ ...d, [url]: [] })))
            .finally(() => setLoadingUrl(null));
        }
      }
      return next;
    });
  };

  const groups = pages ? groupByHostname(pages) : [];

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <History className="size-4" />
          Crawl History
        </div>
        <button
          type="button"
          onClick={loadPages}
          title="Refresh"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="p-2">
        <Button size="sm" variant="outline" className="w-full justify-start gap-1.5" onClick={onNewCrawl}>
          <Plus className="size-3.5" />
          New crawl
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading && !pages && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}

        {pages && pages.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No crawls yet. Run your first audit to build history here.
          </p>
        )}

        {groups.map((group) => {
          const siteOpen = expandedSites.has(group.hostname);
          return (
            <div key={group.hostname} className="mb-1">
              <button
                type="button"
                onClick={() => toggleSite(group.hostname)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted"
              >
                <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", siteOpen && "rotate-90")} />
                <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{group.hostname}</span>
                <span className="shrink-0 text-xs font-normal text-muted-foreground">{group.pages.length}</span>
              </button>

              {siteOpen && (
                <div className="ml-2 border-l border-border pl-2">
                  {group.pages.map((page) => {
                    const pageOpen = expandedPages.has(page.url);
                    const dates = datesByUrl[page.url];
                    return (
                      <div key={page.url}>
                        <button
                          type="button"
                          onClick={() => togglePage(page.url)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          <ChevronRight className={cn("size-3 shrink-0 text-muted-foreground transition-transform", pageOpen && "rotate-90")} />
                          <span className="min-w-0 flex-1 truncate text-foreground">{pathOf(page.url)}</span>
                          <span className="shrink-0 text-muted-foreground">{page.crawlCount}</span>
                        </button>

                        {pageOpen && (
                          <div className="ml-2 space-y-0.5 border-l border-border py-1 pl-3">
                            {loadingUrl === page.url && !dates && (
                              <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                                <Loader2 className="size-3 animate-spin" /> Loading…
                              </div>
                            )}
                            {dates?.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => onSelectAudit(d.id)}
                                className={cn(
                                  "block w-full truncate rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
                                  activeAuditId === d.id && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                                )}
                              >
                                {formatCrawledAt(d.crawledAt)}
                              </button>
                            ))}
                            {dates && dates.length === 0 && (
                              <p className="px-2 py-1 text-xs text-muted-foreground">No other crawls.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
