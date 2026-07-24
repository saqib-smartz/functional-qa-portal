const BOT_PROTECTION_CODES = new Set([403, 429, 503]);

/**
 * Returns a caveat to surface prominently when the page didn't return a real 2xx response —
 * every downstream finding reflects whatever content the automated browser actually received,
 * which (especially for 403/429/503) is often a bot/WAF challenge page, not the real content.
 */
export function describeNonSuccessStatus(httpStatus: number): string | null {
  if (httpStatus >= 200 && httpStatus < 300) return null;

  if (BOT_PROTECTION_CODES.has(httpStatus)) {
    return (
      `This page returned HTTP ${httpStatus} to the automated browser used for this audit. That commonly ` +
      `means bot/WAF protection (e.g. Cloudflare, Sucuri, Wordfence) blocked the automated visitor rather ` +
      `than a real page error — if so, every finding below reflects a blocked/challenge page, not what real ` +
      `visitors see. Try allowlisting this tool or temporarily disabling bot protection, then re-run the audit.`
    );
  }

  return (
    `This page returned HTTP ${httpStatus} instead of a successful response. Every finding below reflects ` +
    `whatever content was actually returned at that status, which may not represent the intended page — ` +
    `investigate and resolve the underlying error, then re-run the audit.`
  );
}
