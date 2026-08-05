"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SitemapParseResult } from "@/lib/sitemap/types";

const DEFAULT_PRESELECT = 25;

interface SitemapUrlSelectorProps {
  parseResult: SitemapParseResult;
  onStartCrawl: (urls: string[]) => void;
}

export function SitemapUrlSelector({ parseResult, onStartCrawl }: SitemapUrlSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(parseResult.urls.slice(0, DEFAULT_PRESELECT)),
  );

  const allChecked = selected.size === parseResult.urls.length;

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(parseResult.urls));
  };

  const selectedUrls = useMemo(() => parseResult.urls.filter((u) => selected.has(u)), [parseResult.urls, selected]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {parseResult.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-dashed border-attention/40 bg-attention/5 p-3 text-xs text-muted-foreground">
          {parseResult.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
          {parseResult.totalFound} page{parseResult.totalFound === 1 ? "" : "s"} found — {selected.size} selected
        </label>
        <Button size="lg" disabled={selectedUrls.length === 0} onClick={() => onStartCrawl(selectedUrls)}>
          <Search className="size-4" />
          Crawl {selectedUrls.length} page{selectedUrls.length === 1 ? "" : "s"}
        </Button>
      </div>

      <ScrollArea className="h-80 rounded-md border border-border">
        <ul className="divide-y divide-border">
          {parseResult.urls.map((url) => (
            <li key={url}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox checked={selected.has(url)} onCheckedChange={() => toggle(url)} />
                <span className="truncate text-muted-foreground">{url}</span>
              </label>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
