import { makeFinding, type AuditModule, type AuditContext, type Finding } from "@/lib/audit/types";
import { COOKIE_PROVIDERS, CUSTOM_COOKIE_BANNER_HINTS } from "@/lib/audit/detectors/cookie-providers";

const CONSENT_COOKIE_NAME_RE = /consent|cookie|cmplz|CookieConsent|OptanonConsent/i;

function capList<T>(items: T[], cap = 10): { items: T[]; truncated: boolean; totalCount: number } {
  return { items: items.slice(0, cap), truncated: items.length > cap, totalCount: items.length };
}

export const cookieBannerModule: AuditModule = {
  category: "cookie-banner",
  label: "Cookie Banner",
  run: async (ctx: AuditContext): Promise<Finding[]> => {
    const findings: Finding[] = [];
    const $ = ctx.$;

    let detectedProviderName: string | null = null;
    let hasAccept = false;
    let hasReject = false;
    let hasPreferences = false;
    let confidenceNote = "";

    for (const provider of COOKIE_PROVIDERS) {
      try {
        if ($(provider.containerSelector).length > 0) {
          detectedProviderName = provider.name;
          hasAccept = $(provider.acceptSelector).length > 0;
          hasReject = $(provider.rejectSelector).length > 0;
          hasPreferences = $(provider.preferencesSelector).length > 0;
          break;
        }
      } catch {
        // Skip a malformed selector rather than crash the whole module.
      }
    }

    if (!detectedProviderName) {
      try {
        const container = $(CUSTOM_COOKIE_BANNER_HINTS.containerSelector);
        if (container.length > 0) {
          detectedProviderName = "Custom/unrecognized cookie banner";
          confidenceNote = " (detected via generic heuristics — control detection is approximate)";
          const text = container.text();
          hasAccept = CUSTOM_COOKIE_BANNER_HINTS.acceptTextPattern.test(text);
          hasReject = CUSTOM_COOKIE_BANNER_HINTS.rejectTextPattern.test(text);
          hasPreferences = CUSTOM_COOKIE_BANNER_HINTS.preferencesTextPattern.test(text);
        }
      } catch {
        // Ignore selector errors.
      }
    }

    if (!detectedProviderName) {
      findings.push(
        makeFinding({
          category: "cookie-banner",
          title: "No cookie consent banner detected",
          status: "warning",
          severity: "medium",
          pageUrl: ctx.url,
          description: "No known cookie consent provider or generic cookie banner was detected on the page.",
          whyItMatters:
            "Many jurisdictions (e.g. GDPR in the EU/UK, and various US state laws) require informing visitors about cookie usage and, in many cases, obtaining consent before setting non-essential cookies.",
          recommendation: "Add a cookie consent banner (e.g. via a plugin such as Complianz, CookieYes, or Cookiebot) that lets visitors accept or reject non-essential cookies.",
          estimatedFixTime: "1 hour",
        })
      );
    } else {
      const controlsPresent = [
        hasAccept ? "Accept" : null,
        hasReject ? "Reject" : null,
        hasPreferences ? "Preferences" : null,
      ].filter((c): c is string => c !== null);
      const controlsMissing = [
        hasAccept ? null : "Accept",
        hasReject ? null : "Reject",
        hasPreferences ? null : "Preferences",
      ].filter((c): c is string => c !== null);

      const missingImportant = !hasReject || !hasPreferences;

      findings.push(
        makeFinding({
          category: "cookie-banner",
          title: `Cookie banner detected (${detectedProviderName})`,
          status: missingImportant ? "warning" : "pass",
          severity: missingImportant ? "medium" : "info",
          pageUrl: ctx.url,
          description:
            `A cookie consent banner was detected${confidenceNote}. ` +
            `Controls present: ${controlsPresent.length ? controlsPresent.join(", ") : "none detected"}.` +
            (controlsMissing.length ? ` Missing: ${controlsMissing.join(", ")}.` : ""),
          whyItMatters: missingImportant
            ? "GDPR-style consent regulations generally expect a genuine choice — a banner that only offers 'Accept' (with no equally easy Reject/Preferences option) may not meet compliance requirements."
            : "A cookie banner with Accept, Reject, and Preferences controls gives visitors a clear, compliant choice.",
          recommendation: missingImportant
            ? "Add a clearly visible Reject/Decline option (and ideally a Preferences/Manage option) alongside Accept, so consent is a genuine choice."
            : "No action needed.",
          estimatedFixTime: missingImportant ? "30 minutes" : "0 minutes",
          meta: { provider: detectedProviderName, hasAccept, hasReject, hasPreferences },
        })
      );
    }

    // --- Consent cookie presence (read-only, no interaction) ---
    try {
      const cookies = await ctx.browserContext.cookies();
      const matches = cookies.filter((c) => CONSENT_COOKIE_NAME_RE.test(c.name)).map((c) => c.name);
      const cap = capList(Array.from(new Set(matches)));
      findings.push(
        makeFinding({
          category: "cookie-banner",
          title: matches.length > 0 ? "Consent-related cookie already present" : "No consent cookie found before interaction",
          status: "pass",
          severity: "info",
          pageUrl: ctx.url,
          description:
            matches.length > 0
              ? `Found ${matches.length} cookie(s) with a consent-related name before any interaction with the banner: ${cap.items.join(", ")}${cap.truncated ? ", and more" : ""}.`
              : "No cookie with a consent-related name (e.g. consent, cookie, cmplz, CookieConsent, OptanonConsent) was found before interacting with the page.",
          whyItMatters:
            "Informational — shows whether the site sets a default/implicit consent state cookie before a visitor makes an explicit choice.",
          recommendation: "No action needed; informational only.",
          estimatedFixTime: "0 minutes",
          meta: matches.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    } catch {
      // If cookie retrieval fails, skip this informational finding rather than crash the module.
    }

    return findings;
  },
};
