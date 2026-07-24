"use client";

import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/home/hero";
import { AuditForm } from "@/components/home/audit-form";
import { AuditProgress } from "@/components/shared/audit-progress";
import { ReportView } from "@/components/report/report-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuditStream } from "@/hooks/use-audit-stream";

export default function Home() {
  const { status, statusMessage, modules, report, error, runAudit, reset } = useAuditStream();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <Hero />
              <AuditForm onSubmit={runAudit} isRunning={false} />
            </motion.div>
          )}

          {status === "running" && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10 py-12"
            >
              <Hero />
              <AuditForm onSubmit={runAudit} isRunning />
              <AuditProgress statusMessage={statusMessage} modules={modules} />
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-2xl space-y-6"
            >
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>The audit failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="text-center">
                <Button variant="outline" onClick={reset}>
                  Try again
                </Button>
              </div>
            </motion.div>
          )}

          {status === "complete" && report && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={reset}>
                  ← Audit another page
                </Button>
              </div>
              <ReportView report={report} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SiteFooter />
    </div>
  );
}
