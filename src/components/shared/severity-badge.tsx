import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/audit/types";

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className: "border-transparent bg-destructive text-white",
  },
  high: {
    label: "High",
    className: "border-transparent bg-destructive/15 text-destructive",
  },
  medium: {
    label: "Medium",
    className: "border-transparent bg-attention/15 text-attention",
  },
  low: {
    label: "Low",
    className: "border-transparent bg-ring/15 text-ring",
  },
  info: {
    label: "Info",
    className: "border border-border bg-muted text-muted-foreground",
  },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const config = SEVERITY_CONFIG[severity];
  return <Badge className={cn("font-medium", config.className, className)}>{config.label}</Badge>;
}
