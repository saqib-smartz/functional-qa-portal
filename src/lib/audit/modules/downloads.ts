import { makeFinding, type AuditModule, type AuditContext, type Finding } from "@/lib/audit/types";

const MAX_DOWNLOADS_CHECKED = 15;
const FETCH_TIMEOUT_MS = 10000;
const DOWNLOAD_EXT_RE = /\.(pdf|docx?|zip)$/i;

interface DownloadLink {
  url: string;
  ext: string;
}

function capList<T>(items: T[], cap = 10): { items: T[]; truncated: boolean; totalCount: number } {
  return { items: items.slice(0, cap), truncated: items.length > cap, totalCount: items.length };
}

async function checkDownload(url: string): Promise<"reachable" | "broken" | "unknown"> {
  try {
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      }
    } catch {
      res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    }
    if (res.status >= 200 && res.status < 300) return "reachable";
    if (res.status >= 400) return "broken";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export const downloadsModule: AuditModule = {
  category: "downloads",
  label: "Downloads",
  run: async (ctx: AuditContext): Promise<Finding[]> => {
    const findings: Finding[] = [];
    const $ = ctx.$;
    const found = new Map<string, DownloadLink>();

    $("a[href]").each((_, el) => {
      const raw = $(el).attr("href");
      if (!raw) return;
      let resolved: URL;
      try {
        resolved = new URL(raw, ctx.url);
      } catch {
        return;
      }
      if (!/^https?:$/.test(resolved.protocol)) return;
      const match = resolved.pathname.match(DOWNLOAD_EXT_RE);
      if (!match) return;
      const url = resolved.toString();
      if (!found.has(url)) {
        found.set(url, { url, ext: match[1].toLowerCase() });
      }
    });

    const allLinks = Array.from(found.values());

    if (allLinks.length === 0) {
      findings.push(
        makeFinding({
          category: "downloads",
          title: "No downloadable files found",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: "No links to PDF, Word, or ZIP files were found on the page.",
          whyItMatters: "Informational only — there are no downloadable file links to verify.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        })
      );
      return findings;
    }

    const checked = allLinks.slice(0, MAX_DOWNLOADS_CHECKED);
    const cappedNote =
      allLinks.length > MAX_DOWNLOADS_CHECKED
        ? ` Checked the first ${MAX_DOWNLOADS_CHECKED} of ${allLinks.length} downloadable file(s) found.`
        : "";

    const reachable: DownloadLink[] = [];
    const broken: DownloadLink[] = [];
    const unknown: DownloadLink[] = [];

    for (let i = 0; i < checked.length; i += 5) {
      const batch = checked.slice(i, i + 5);
      const results = await Promise.all(batch.map((link) => checkDownload(link.url)));
      batch.forEach((link, idx) => {
        const result = results[idx];
        if (result === "reachable") reachable.push(link);
        else if (result === "broken") broken.push(link);
        else unknown.push(link);
      });
    }

    if (broken.length > 0) {
      const cap = capList(broken.map((b) => `${b.url} (${b.ext})`));
      findings.push(
        makeFinding({
          category: "downloads",
          title: "Broken downloadable file links found",
          status: "fail",
          severity: "high",
          pageUrl: ctx.url,
          description: `${broken.length} downloadable file link(s) returned an error status.` + cappedNote,
          whyItMatters: "A broken download link frustrates users trying to access a document or resource, and reflects poorly on site maintenance.",
          recommendation: "Re-upload the missing file, or fix/remove the broken link.",
          estimatedFixTime: "20 minutes",
          meta: { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount },
        })
      );
    }

    if (unknown.length > 0) {
      const cap = capList(unknown.map((u) => `${u.url} (${u.ext})`));
      findings.push(
        makeFinding({
          category: "downloads",
          title: "Some downloadable files could not be verified",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `${unknown.length} downloadable file link(s) could not be checked due to a network error or timeout.` + cappedNote,
          whyItMatters: "These files weren't confirmed reachable or broken; a manual check is recommended.",
          recommendation: "Manually verify these download links work as expected.",
          estimatedFixTime: "10 minutes",
          meta: { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount },
        })
      );
    }

    if (reachable.length > 0) {
      const cap = capList(reachable.map((r) => `${r.url} (${r.ext})`));
      findings.push(
        makeFinding({
          category: "downloads",
          title: "Downloadable files are reachable",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `${reachable.length} downloadable file link(s) responded successfully.` + cappedNote,
          whyItMatters: "Informational only — confirms these downloads are working for visitors.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
          meta: { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount },
        })
      );
    }

    return findings;
  },
};
