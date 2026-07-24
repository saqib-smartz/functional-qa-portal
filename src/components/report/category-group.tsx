"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FindingRow } from "@/components/report/finding-row";
import { CATEGORY_LABELS, type Category, type Finding } from "@/lib/audit/types";

export function CategoryGroup({ category, findings }: { category: Category; findings: Finding[] }) {
  const [open, setOpen] = useState(true);

  const failCount = findings.filter((f) => f.status === "fail").length;
  const warningCount = findings.filter((f) => f.status === "warning").length;
  const passCount = findings.filter((f) => f.status === "pass").length;

  return (
    <div className="mt-4 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-t-md border border-border bg-muted px-4 py-3 text-left select-none"
        style={!open ? { borderRadius: "var(--radius)" } : undefined}
      >
        <span className="truncate text-base font-semibold text-foreground">{CATEGORY_LABELS[category]}</span>
        <span className="flex shrink-0 items-center gap-3 text-xs">
          {failCount > 0 && <span className="font-medium text-destructive">{failCount} failed</span>}
          {warningCount > 0 && <span className="font-medium text-attention">{warningCount} warnings</span>}
          <span className="text-muted-foreground">{passCount} passed</span>
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </span>
      </button>
      {open && (
        <div className="rounded-b-md border border-t-0 border-border">
          {findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
}
