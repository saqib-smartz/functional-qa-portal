import { ClipboardCheck, History } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function SiteHeader({ onToggleHistory }: { onToggleHistory?: () => void }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          {onToggleHistory && (
            <button
              type="button"
              onClick={onToggleHistory}
              aria-label="Toggle crawl history"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            >
              <History className="size-5" />
            </button>
          )}
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <ClipboardCheck className="size-5" />
            <span>WP QA Auditor</span>
          </Link>
        </div>
        <Badge className="hidden border-transparent bg-ring text-white sm:inline-flex">Single-page audit</Badge>
      </div>
    </header>
  );
}
