import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <ClipboardCheck className="size-5" />
          <span>WP QA Auditor</span>
        </Link>
        <Badge className="hidden border-transparent bg-ring text-white sm:inline-flex">Single-page audit</Badge>
      </div>
    </header>
  );
}
