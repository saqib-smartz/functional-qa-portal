"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auditRequestSchema, type AuditRequest } from "@/lib/validation/audit-request-schema";

interface AuditFormProps {
  onSubmit: (url: string) => void;
  isRunning: boolean;
}

export function AuditForm({ onSubmit, isRunning }: AuditFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuditRequest>({
    resolver: zodResolver(auditRequestSchema),
    defaultValues: { url: "" },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values.url))}
      className="mx-auto w-full max-w-2xl"
      noValidate
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="https://example.com/about/"
          className="h-12 flex-1 text-base"
          disabled={isRunning}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.url)}
          {...register("url")}
        />
        <Button type="submit" size="lg" className="h-12 px-6" disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Running Audit…
            </>
          ) : (
            <>
              <Search className="size-4" />
              Run Website Audit
            </>
          )}
        </Button>
      </div>
      {errors.url && <p className="mt-2 text-sm text-destructive">{errors.url.message}</p>}
    </form>
  );
}
