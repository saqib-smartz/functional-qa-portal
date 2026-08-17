import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/** Colocated in the segment so notFound() renders it with a genuine 404 status, not a 200 error state. */
export default function SharedReportNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-16 sm:px-6">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="text-muted-foreground size-4" />
              This shared report isn&apos;t available
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-4 text-sm">
            <p>
              The link may have been revoked by whoever shared it, or the URL is incorrect. Ask them
              for a new link.
            </p>
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Go to WP QA Auditor
            </Link>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
