import { makeFinding, type AuditModule, type AuditContext, type Finding } from "@/lib/audit/types";

const MAX_LINKS_CHECKED = 25;
const BATCH_SIZE = 5;
const FETCH_TIMEOUT_MS = 8000;

function capList<T>(items: T[], cap = 10): { items: T[]; truncated: boolean; totalCount: number } {
  return { items: items.slice(0, cap), truncated: items.length > cap, totalCount: items.length };
}

type LinkCheckResult =
  | { kind: "ok"; status: number }
  | { kind: "redirect"; status: number; location: string | null; chained: boolean }
  | { kind: "broken"; status: number }
  | { kind: "error" };

async function fetchOnce(href: string, method: "HEAD" | "GET"): Promise<Response> {
  return fetch(href, { method, redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function checkLink(href: string): Promise<LinkCheckResult> {
  let res: Response;
  try {
    res = await fetchOnce(href, "HEAD");
    if (res.status === 405 || res.status === 501) {
      res = await fetchOnce(href, "GET");
    }
  } catch {
    try {
      res = await fetchOnce(href, "GET");
    } catch {
      return { kind: "error" };
    }
  }

  if (res.status >= 200 && res.status < 300) {
    return { kind: "ok", status: res.status };
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    let chained = false;
    if (location) {
      try {
        const nextUrl = new URL(location, href).toString();
        const nextRes = await fetchOnce(nextUrl, "HEAD").catch(() => fetchOnce(nextUrl, "GET"));
        if (nextRes.status >= 300 && nextRes.status < 400) {
          chained = true;
        }
      } catch {
        // Couldn't verify the second hop; treat as a single, non-chained redirect.
      }
    }
    return { kind: "redirect", status: res.status, location, chained };
  }

  return { kind: "broken", status: res.status };
}

export const linksModule: AuditModule = {
  category: "links",
  label: "Links",
  run: async (ctx: AuditContext): Promise<Finding[]> => {
    const findings: Finding[] = [];
    const $ = ctx.$;
    const baseUrl = ctx.url;
    let baseHostname = "";
    try {
      baseHostname = new URL(baseUrl).hostname;
    } catch {
      baseHostname = "";
    }

    const emptyHrefs: string[] = [];
    const jsVoidHrefs: string[] = [];
    const anchorTargets: { href: string; anchor: string }[] = [];
    let internalCount = 0;
    let externalCount = 0;
    const absoluteHttpLinks = new Set<string>();

    $("a").each((_, el) => {
      const node = $(el);
      const rawHref = node.attr("href");
      const label = node.text().trim() || node.attr("aria-label") || "(no text)";

      if (rawHref === undefined || rawHref.trim() === "" || rawHref.trim() === "#") {
        emptyHrefs.push(label);
        return;
      }

      const href = rawHref.trim();

      if (/^javascript:/i.test(href)) {
        jsVoidHrefs.push(label);
        return;
      }

      if (href.startsWith("#")) {
        anchorTargets.push({ href, anchor: href.slice(1) });
        return;
      }

      if (/^(mailto|tel|sms):/i.test(href)) {
        // Not a navigable web link; not counted as internal/external/broken-checkable.
        return;
      }

      let resolved: URL;
      try {
        resolved = new URL(href, baseUrl);
      } catch {
        return;
      }

      if (!/^https?:$/.test(resolved.protocol)) {
        return;
      }

      if (baseHostname && resolved.hostname === baseHostname) {
        internalCount += 1;
      } else {
        externalCount += 1;
      }

      absoluteHttpLinks.add(resolved.toString());
    });

    // --- Empty hrefs ---
    {
      const cap = capList(emptyHrefs);
      findings.push(
        makeFinding({
          category: "links",
          title: emptyHrefs.length === 0 ? "No empty link hrefs found" : "Links with empty or placeholder hrefs",
          status: emptyHrefs.length === 0 ? "pass" : "fail",
          severity: emptyHrefs.length === 0 ? "info" : "medium",
          pageUrl: ctx.url,
          description:
            emptyHrefs.length === 0
              ? "All <a> tags on the page have a non-empty href."
              : `${emptyHrefs.length} <a> tag(s) have a missing, empty, or "#"-only href.`,
          whyItMatters:
            "Links without a real destination are dead ends for users and assistive technology, and often indicate incomplete markup or a broken CMS template.",
          recommendation: "Give every link a real destination, or convert non-navigational elements to <button>.",
          estimatedFixTime: emptyHrefs.length === 0 ? "0 minutes" : "20 minutes",
          meta: emptyHrefs.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- javascript:void(0) hrefs ---
    {
      const cap = capList(jsVoidHrefs);
      findings.push(
        makeFinding({
          category: "links",
          title: jsVoidHrefs.length === 0 ? "No javascript: pseudo-links found" : "Links using javascript: hrefs",
          status: jsVoidHrefs.length === 0 ? "pass" : "warning",
          severity: jsVoidHrefs.length === 0 ? "info" : "low",
          pageUrl: ctx.url,
          description:
            jsVoidHrefs.length === 0
              ? "No <a> tags rely on javascript: hrefs."
              : `${jsVoidHrefs.length} <a> tag(s) use a javascript: href (e.g. javascript:void(0)) instead of a real URL.`,
          whyItMatters:
            "javascript: hrefs bypass normal link semantics (no visible URL on hover, broken for keyboard/middle-click/new-tab, and inaccessible if JS fails).",
          recommendation: "Use a <button> for JS-driven actions, or a real href with a progressive-enhancement click handler.",
          estimatedFixTime: jsVoidHrefs.length === 0 ? "0 minutes" : "30 minutes",
          meta: jsVoidHrefs.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- Internal vs external summary ---
    findings.push(
      makeFinding({
        category: "links",
        title: "Internal vs. external link breakdown",
        status: "pass",
        severity: "info",
        pageUrl: ctx.url,
        description: `Found ${internalCount} internal link(s) and ${externalCount} external link(s) on the page.`,
        whyItMatters: "Understanding the internal/external link mix helps assess site navigation structure and outbound link risk.",
        recommendation: "No action needed; informational only.",
        estimatedFixTime: "0 minutes",
        meta: { internalCount, externalCount },
      })
    );

    // --- Anchor link targets ---
    const brokenAnchors: string[] = [];
    for (const { href, anchor } of anchorTargets) {
      if (!anchor) continue; // bare "#" already handled above as empty
      let exists = false;
      try {
        const escaped = anchor.replace(/([#;&,.+*~':"!^$[\]()=>|/\\])/g, "\\$1");
        exists = $(`#${escaped}`).length > 0 || $(`[name="${anchor}"]`).length > 0;
      } catch {
        exists = ctx.html.includes(`id="${anchor}"`) || ctx.html.includes(`name="${anchor}"`);
      }
      if (!exists) brokenAnchors.push(href);
    }
    {
      const cap = capList(brokenAnchors);
      findings.push(
        makeFinding({
          category: "links",
          title: brokenAnchors.length === 0 ? "All anchor links resolve to a target" : "Anchor links with no matching target",
          status: brokenAnchors.length === 0 ? "pass" : "warning",
          severity: brokenAnchors.length === 0 ? "info" : "medium",
          pageUrl: ctx.url,
          description:
            brokenAnchors.length === 0
              ? `Checked ${anchorTargets.length} in-page anchor link(s); all have a matching id/name on the page.`
              : `${brokenAnchors.length} anchor link(s) point to an id/name that doesn't exist anywhere in the page.`,
          whyItMatters: "A broken anchor link does nothing when clicked, which is confusing for users navigating to a specific section.",
          recommendation: "Add the missing id/name to the target element, or fix the href to point to an existing anchor.",
          estimatedFixTime: brokenAnchors.length === 0 ? "0 minutes" : "15 minutes",
          meta: brokenAnchors.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- Broken / redirecting links (live fetch check, capped and batched) ---
    const uniqueLinks = Array.from(absoluteHttpLinks);
    const checkedLinks = uniqueLinks.slice(0, MAX_LINKS_CHECKED);
    const results = new Map<string, LinkCheckResult>();

    for (let i = 0; i < checkedLinks.length; i += BATCH_SIZE) {
      const batch = checkedLinks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (link) => {
          try {
            return await checkLink(link);
          } catch {
            return { kind: "error" as const };
          }
        })
      );
      batch.forEach((link, idx) => results.set(link, batchResults[idx]));
    }

    const broken: { url: string; status: number }[] = [];
    const chainedRedirects: { url: string; status: number; location: string | null }[] = [];
    const unverifiable: string[] = [];

    for (const [link, result] of results) {
      if (result.kind === "broken") broken.push({ url: link, status: result.status });
      else if (result.kind === "redirect" && result.chained) {
        chainedRedirects.push({ url: link, status: result.status, location: result.location });
      } else if (result.kind === "error") {
        unverifiable.push(link);
      }
    }

    const cappedNote =
      uniqueLinks.length > MAX_LINKS_CHECKED
        ? ` Checked the first ${MAX_LINKS_CHECKED} of ${uniqueLinks.length} unique links found.`
        : "";

    {
      const cap = capList(broken.map((b) => `${b.url} (HTTP ${b.status})`));
      findings.push(
        makeFinding({
          category: "links",
          title: broken.length === 0 ? "No broken links detected" : "Broken links found",
          status: broken.length === 0 ? "pass" : "fail",
          severity: broken.length === 0 ? "info" : "high",
          pageUrl: ctx.url,
          description:
            (broken.length === 0
              ? `All ${checkedLinks.length} checked link(s) returned a successful response.`
              : `${broken.length} of ${checkedLinks.length} checked link(s) returned an error status (4xx/5xx).`) + cappedNote,
          whyItMatters: "Broken links lead to dead ends, hurt user trust, and can negatively affect SEO crawl quality.",
          recommendation: "Fix the destination URL, restore the missing page, or remove/replace the link.",
          estimatedFixTime: broken.length === 0 ? "0 minutes" : "30 minutes",
          meta: broken.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    {
      const cap = capList(chainedRedirects.map((r) => `${r.url} -> ${r.location ?? "(unknown)"} (HTTP ${r.status})`));
      findings.push(
        makeFinding({
          category: "links",
          title: chainedRedirects.length === 0 ? "No chained redirects found" : "Links with chained (multi-hop) redirects",
          status: chainedRedirects.length === 0 ? "pass" : "warning",
          severity: chainedRedirects.length === 0 ? "info" : "low",
          pageUrl: ctx.url,
          description:
            chainedRedirects.length === 0
              ? "No links were found redirecting more than once."
              : `${chainedRedirects.length} link(s) redirect through more than one hop before reaching a final destination.`,
          whyItMatters: "Multi-hop redirects slow down navigation and dilute SEO link equity; single redirects are normal, but chains are wasteful.",
          recommendation: "Update the link to point directly at the final destination URL.",
          estimatedFixTime: chainedRedirects.length === 0 ? "0 minutes" : "20 minutes",
          meta: chainedRedirects.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    if (unverifiable.length > 0) {
      const cap = capList(unverifiable);
      findings.push(
        makeFinding({
          category: "links",
          title: "Some links could not be verified",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description: `${unverifiable.length} link(s) could not be checked due to a network error or timeout.` + cappedNote,
          whyItMatters: "These links weren't confirmed working or broken; a manual check is recommended.",
          recommendation: "Manually visit these links to confirm they work as expected.",
          estimatedFixTime: "10 minutes",
          meta: { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount },
        })
      );
    }

    return findings;
  },
};
