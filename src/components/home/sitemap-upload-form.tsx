"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SitemapUploadFormProps {
  onUpload: (xml: string) => void;
  isParsing: boolean;
  error: string | null;
}

export function SitemapUploadForm({ onUpload, isParsing, error }: SitemapUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const xml = await file.text();
    onUpload(xml);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="hidden"
          disabled={isParsing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 flex-1 justify-center"
          disabled={isParsing}
          onClick={() => inputRef.current?.click()}
        >
          {isParsing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Parsing sitemap…
            </>
          ) : (
            <>
              <Upload className="size-4" />
              {fileName ?? "Upload sitemap.xml"}
            </>
          )}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
