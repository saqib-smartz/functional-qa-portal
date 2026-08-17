"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2Off, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ShareStatus = "probing" | "unavailable" | "idle" | "minting" | "shared" | "revoking";

/**
 * Mints and revokes the public `/share/<token>` link for one report.
 *
 * Renders nothing when sharing isn't possible. A single probe on mount covers both cases: a 400 means
 * no MONGODB_URI, a 404 means this report never got a database row (recordAudit's failure is swallowed
 * in the audit engine, so a live report can exist on screen with nothing persisted behind it).
 */
export function ShareReportButton({
  reportId,
  initialToken,
}: {
  reportId: string;
  initialToken?: string | null;
}) {
  const [status, setStatus] = useState<ShareStatus>(initialToken ? "shared" : "probing");
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  // Composed in an effect rather than during render: with initialToken seeded, the shared state can
  // appear in server-rendered HTML, and window doesn't exist there.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch(`/api/audits/${reportId}/share`);
        if (cancelled) return;
        if (!res.ok) {
          setStatus("unavailable");
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        setToken(body?.token ?? null);
        setStatus(body?.token ? "shared" : "idle");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    }

    probe();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const shareUrl = token ? `${origin}/share/${token}` : "";

  async function handleShare() {
    setStatus("minting");
    setError(null);
    try {
      const res = await fetch(`/api/audits/${reportId}/share`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Could not create a share link (${res.status}).`);
      setToken(body.token);
      setStatus("shared");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a share link.");
      setStatus("idle");
    }
  }

  async function handleRevoke() {
    setStatus("revoking");
    setError(null);
    try {
      const res = await fetch(`/api/audits/${reportId}/share`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Could not revoke the link (${res.status}).`);
      setToken(null);
      setStatus("idle");
      setRevokeDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke the link.");
      setStatus("shared");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (insecure origin, permissions) — the input stays selectable.
    }
  }

  if (status === "probing" || status === "unavailable") return null;

  if (status === "idle" || status === "minting") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={handleShare} disabled={status === "minting"} variant="outline">
          {status === "minting" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Share2 className="size-4" />
          )}
          Share
        </Button>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-end gap-1.5 sm:w-[420px]">
      <div className="flex w-full items-center gap-1.5">
        <Input
          readOnly
          value={shareUrl}
          aria-label="Public share link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 text-xs"
        />
        <Button variant="outline" size="sm" onClick={handleCopy} title="Copy link">
          {copied ? <Check className="text-success size-4" /> : <Copy className="size-4" />}
        </Button>
        <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevokeDialogOpen(true)}
            title="Revoke link"
          >
            <Link2Off className="size-4" />
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke this share link?</AlertDialogTitle>
              <AlertDialogDescription>
                Anyone holding this URL will immediately get a 404. This is permanent — sharing the
                report again creates a different link, and the old one never works.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose disabled={status === "revoking"}>Cancel</AlertDialogClose>
              <Button variant="destructive" onClick={handleRevoke} disabled={status === "revoking"}>
                {status === "revoking" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2Off className="size-4" />
                )}
                Revoke link
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <p className="text-muted-foreground text-xs">
        Anyone with this link can view the report. It doesn&apos;t expire.
      </p>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
