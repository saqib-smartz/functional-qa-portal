"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, ChevronRight } from "lucide-react";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/audit/types";

const STATUS_ICON = {
  pass: { Icon: CheckCircle2, className: "text-success" },
  warning: { Icon: AlertTriangle, className: "text-attention" },
  fail: { Icon: XCircle, className: "text-destructive" },
} as const;

export function FindingRow({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const { Icon, className: iconClassName } = STATUS_ICON[finding.status];

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-4 py-3 text-left select-none hover:bg-muted"
      >
        <Icon className={cn("mt-0.5 size-4 shrink-0", iconClassName)} />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">{finding.title}</span>
            <SeverityBadge severity={finding.severity} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{finding.pageUrl}</span>
            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")} />
            <span className="shrink-0">{expanded ? "Hide details" : "View details"}</span>
          </div>
        </div>

        <span className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-muted-foreground">
          {finding.estimatedFixTime}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border bg-muted/60 px-4 py-4 pl-11 text-sm">
              <FieldBlock label="Description" value={finding.description} />
              <FieldBlock label="Why this matters" value={finding.whyItMatters} />
              <FieldBlock label="Recommendation" value={finding.recommendation} />

              {Array.isArray(finding.meta?.items) && finding.meta.items.length > 0 && (
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Examples</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                    {(finding.meta.items as unknown[]).slice(0, 10).map((item, i) => (
                      <li key={i} className="break-all">
                        {typeof item === "string" ? item : JSON.stringify(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {finding.screenshot && (
                <div className="overflow-hidden rounded-md border border-border">
                  <Image
                    src={finding.screenshot}
                    alt={`Screenshot illustrating: ${finding.title}`}
                    width={1200}
                    height={700}
                    unoptimized
                    className="h-auto w-full"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground whitespace-pre-line">{value}</p>
    </div>
  );
}
