"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlUrlState } from "@/hooks/use-sitemap-crawl";

export function SitemapCrawlProgress({ urlStates }: { urlStates: CrawlUrlState[] }) {
  const doneCount = urlStates.filter((u) => u.status === "done" || u.status === "error").length;
  const percent = urlStates.length > 0 ? Math.round((doneCount / urlStates.length) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            Crawling {doneCount}/{urlStates.length} pages…
          </span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-foreground"
            animate={{ width: `${percent}%` }}
            transition={{ ease: "easeOut", duration: 0.4 }}
          />
        </div>
      </div>

      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {urlStates.map((u) => (
            <motion.li
              key={u.url}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
            >
              {u.status === "pending" && <Circle className="size-4 shrink-0 text-muted-foreground/40" />}
              {u.status === "running" && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
              {u.status === "done" && <CheckCircle2 className="size-4 shrink-0 text-success" />}
              {u.status === "error" && <XCircle className="size-4 shrink-0 text-destructive" />}
              <span
                className={cn(
                  "flex-1 truncate",
                  u.status === "running" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {u.url}
              </span>
              {u.status === "running" && u.statusMessage && (
                <span className="shrink-0 text-xs text-muted-foreground">{u.statusMessage}</span>
              )}
              {u.status === "error" && <span className="shrink-0 text-xs text-destructive">failed</span>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
