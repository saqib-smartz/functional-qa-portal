import { isDbConfigured } from "@/lib/db/client";
import { createShareLink, getAuditById, revokeShareLink } from "@/lib/db/audits";

export const runtime = "nodejs";

const NOT_CONFIGURED = { error: "Sharing requires audit history to be configured." };
const NOT_FOUND = { error: "Audit not found." };

/** Tells the Share button whether this report already has a live link — 404 means it was never persisted. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDbConfigured()) {
    return Response.json(NOT_CONFIGURED, { status: 400 });
  }

  const audit = await getAuditById(id);
  if (!audit) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  return Response.json({ token: audit.shareToken });
}

/**
 * Mints the public link, or re-returns the existing one — two clicks must yield the same URL.
 * Returns a relative `path` rather than an absolute URL: there is no base-URL env var, and on Vercel
 * `VERCEL_URL` is the per-deployment host, so preview deploys would mint links nobody else can use.
 * The client composes the origin instead.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDbConfigured()) {
    return Response.json(NOT_CONFIGURED, { status: 400 });
  }

  const link = await createShareLink(id);
  if (!link) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  return Response.json({ ...link, path: `/share/${link.token}` });
}

/** Revokes the link, immediately 404-ing the public page. Re-sharing later mints a different token. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDbConfigured()) {
    return Response.json(NOT_CONFIGURED, { status: 400 });
  }

  const revoked = await revokeShareLink(id);
  if (!revoked) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  return Response.json({ revoked: true });
}
