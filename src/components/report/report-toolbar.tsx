"use client";

import { CheckCircle2, AlertTriangle, XCircle, ListChecks, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/audit/types";

export type StatusFilter = "all" | Status;

interface ReportToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  counts: { all: number; fail: number; warning: number; pass: number };
  visibleCount: number;
  auditedAt: string;
  totalTimeSeconds: number;
}

const FILTERS: {
  key: StatusFilter;
  label: string;
  countKey: keyof ReportToolbarProps["counts"];
  Icon: typeof ListChecks;
  iconClassName: string;
}[] = [
  { key: "all", label: "All", countKey: "all", Icon: ListChecks, iconClassName: "text-muted-foreground" },
  { key: "fail", label: "Failed", countKey: "fail", Icon: XCircle, iconClassName: "text-destructive" },
  { key: "warning", label: "Warnings", countKey: "warning", Icon: AlertTriangle, iconClassName: "text-attention" },
  { key: "pass", label: "Passed", countKey: "pass", Icon: CheckCircle2, iconClassName: "text-success" },
];

export function ReportToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  counts,
  visibleCount,
  auditedAt,
  totalTimeSeconds,
}: ReportToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search findings…"
            className="h-[30px] rounded-md pl-8 text-sm shadow-none"
          />
        </div>

        {/* Connected segmented control, matching Playwright's report subnav filter tabs */}
        <div className="flex">
          {FILTERS.map(({ key, label, countKey, Icon, iconClassName }, i) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusFilterChange(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 border border-border px-2.5 py-1 text-sm leading-5 font-medium text-foreground select-none",
                  i > 0 && "-ml-px",
                  i === 0 && "rounded-l-md",
                  i === FILTERS.length - 1 && "rounded-r-md",
                  active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <Icon className={cn("size-3.5", iconClassName)} />
                {label}
                <span className="rounded-full bg-muted-foreground/15 px-1.5 py-px text-xs font-medium text-foreground">
                  {counts[countKey]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {visibleCount} of {counts.all}
          {search && ` matching "${search}"`}
        </span>
        <span>
          Audited {auditedAt} &middot; Total time: {totalTimeSeconds.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
