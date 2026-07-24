import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 text-center">
      <Badge variant="outline" className="text-muted-foreground">
        <Sparkles className="size-3" />
        AI-powered QA audit
      </Badge>
      <h1 className="text-[40px] leading-[1.25] font-normal text-balance text-foreground">
        WordPress AI QA Auditor
      </h1>
      <p className="text-base text-balance text-muted-foreground">
        Analyze a single webpage for functionality, content quality, SEO, responsiveness, and WordPress best
        practices.
      </p>
    </div>
  );
}
