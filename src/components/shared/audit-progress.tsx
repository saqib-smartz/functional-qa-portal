"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleProgress } from "@/hooks/use-audit-stream";

const TOTAL_CATEGORIES = 15;

export function AuditProgress({ statusMessage, modules }: { statusMessage: string; modules: ModuleProgress[] }) {
  const doneCount = modules.filter((m) => m.state === "done" || m.state === "error").length;
  const percent = Math.min(100, Math.round((doneCount / TOTAL_CATEGORIES) * 100));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{statusMessage || "Running audit…"}</span>
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
          {modules.map((mod) => (
            <motion.li
              key={mod.category}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
            >
              {mod.state === "running" && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
              {mod.state === "done" && <CheckCircle2 className="size-4 shrink-0 text-success" />}
              {mod.state === "error" && <XCircle className="size-4 shrink-0 text-destructive" />}
              <span className={cn("flex-1", mod.state === "running" ? "text-foreground" : "text-muted-foreground")}>
                {mod.label}
              </span>
              {mod.state === "done" && typeof mod.findingsCount === "number" && (
                <span className="text-xs text-muted-foreground">{mod.findingsCount} findings</span>
              )}
              {mod.state === "error" && <span className="text-xs text-destructive">failed</span>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
