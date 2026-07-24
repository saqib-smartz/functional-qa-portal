import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditScreenshots } from "@/lib/audit/types";

export function ScreenshotGallery({ screenshots }: { screenshots: AuditScreenshots }) {
  return (
    <Tabs defaultValue="desktop">
      <TabsList>
        <TabsTrigger value="desktop">Desktop</TabsTrigger>
        <TabsTrigger value="tablet">Tablet</TabsTrigger>
        <TabsTrigger value="mobile">Mobile</TabsTrigger>
      </TabsList>
      {(["desktop", "tablet", "mobile"] as const).map((viewport) => (
        <TabsContent key={viewport} value={viewport}>
          {screenshots[viewport] ? (
            <div className="max-h-[70vh] overflow-y-auto rounded-md border">
              <Image
                src={screenshots[viewport]}
                alt={`${viewport} screenshot`}
                width={1440}
                height={2000}
                unoptimized
                className="h-auto w-full"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No screenshot captured for this viewport.</p>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
