import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";

const MAX_EXAMPLES = 10;

export const securityModule: AuditModule = {
  category: "security",
  label: "Security",
  run: async (ctx) => {
    const findings: Finding[] = [];
    const { url, html, responseHeaders } = ctx;

    // 1. HTTPS check
    if (url.startsWith("https://")) {
      findings.push(
        makeFinding({
          category: "security",
          title: "HTTPS is enabled",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "The page is served over HTTPS.",
          whyItMatters: "HTTPS is the foundation of transport-layer security for the site.",
          recommendation: "No action needed.",
          estimatedFixTime: "0 minutes",
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "security",
          title: "HTTPS is not enabled",
          status: "fail",
          severity: "high",
          pageUrl: url,
          description: "The page was loaded over an insecure HTTP connection instead of HTTPS.",
          whyItMatters: "Without HTTPS, traffic (including any credentials submitted on the site) can be intercepted or tampered with in transit.",
          recommendation: "Obtain an SSL/TLS certificate and enforce HTTPS site-wide with a redirect.",
          estimatedFixTime: "1 hour",
        }),
      );
    }

    // 2-4. Security headers
    const headerChecks: Array<{
      header: string;
      label: string;
      severity: "medium" | "low";
    }> = [
      { header: "strict-transport-security", label: "Strict-Transport-Security (HSTS)", severity: "medium" },
      { header: "x-frame-options", label: "X-Frame-Options", severity: "medium" },
      { header: "content-security-policy", label: "Content-Security-Policy", severity: "low" },
    ];

    for (const check of headerChecks) {
      const value = responseHeaders[check.header];
      if (value) {
        findings.push(
          makeFinding({
            category: "security",
            title: `${check.label} header is present`,
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: `${check.label} header value: "${value}".`,
            whyItMatters: `The ${check.label} header is a defense-in-depth measure against common web attacks.`,
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "security",
            title: `${check.label} header is missing`,
            status: "warning",
            severity: check.severity,
            pageUrl: url,
            description: `No ${check.label} response header was found.`,
            whyItMatters: `Without ${check.label}, the site misses a layer of defense-in-depth protection, though this alone is not necessarily a critical issue for a typical WordPress site.`,
            recommendation: `Configure the web server or a security plugin to send a ${check.label} header.`,
            estimatedFixTime: "30 minutes",
          }),
        );
      }
    }

    // 5. Mixed content
    if (url.startsWith("https://")) {
      const mixedContentRegex = /(?:src|href)=["']http:\/\/[^"']+["']/gi;
      const matches = html.match(mixedContentRegex) ?? [];
      if (matches.length > 0) {
        const examples = matches.slice(0, MAX_EXAMPLES);
        const truncated = matches.length > MAX_EXAMPLES;
        findings.push(
          makeFinding({
            category: "security",
            title: "Mixed content detected (insecure HTTP resources on an HTTPS page)",
            status: "fail",
            severity: "high",
            pageUrl: url,
            description: `Found ${matches.length} reference(s) to http:// resources on this https:// page.${
              truncated ? ` Showing first ${MAX_EXAMPLES}.` : ""
            }`,
            whyItMatters: "Mixed content can be blocked or flagged by browsers, breaks the padlock/secure indicator, and can expose those specific resources to interception or tampering.",
            recommendation: "Update all hardcoded http:// resource references to https:// or protocol-relative URLs.",
            estimatedFixTime: "30 minutes",
            meta: { items: examples, total: matches.length },
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "security",
            title: "No mixed content detected",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: "No hardcoded http:// resource references were found on this https:// page.",
            whyItMatters: "Avoiding mixed content keeps the page fully secure and preserves the browser's secure-connection indicator.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }
    }

    // 6. REST API exposure
    try {
      const restRes = await fetch(new URL("/wp-json/", url), { signal: AbortSignal.timeout(8000) });
      if (restRes.ok) {
        findings.push(
          makeFinding({
            category: "security",
            title: "WordPress REST API is publicly accessible",
            status: "pass",
            severity: "low",
            pageUrl: url,
            description: `/wp-json/ responded with HTTP ${restRes.status}, indicating the REST API is publicly reachable.`,
            whyItMatters: "This is expected and by-design for most WordPress sites (many themes/plugins rely on it), but it can expose information such as usernames or post data if not deliberately restricted.",
            recommendation: "Confirm this exposure is intentional; if the API doesn't need to be public, restrict access with a security plugin or server rule.",
            estimatedFixTime: "20 minutes",
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "security",
            title: "WordPress REST API is not publicly accessible",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: `/wp-json/ responded with HTTP ${restRes.status}.`,
            whyItMatters: "A restricted REST API reduces the amount of information exposed to unauthenticated visitors.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      }
    } catch {
      findings.push(
        makeFinding({
          category: "security",
          title: "WordPress REST API exposure could not be verified",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "/wp-json/ could not be fetched due to a network error.",
          whyItMatters: "Without verifying this, we cannot confirm whether the REST API is exposed as expected.",
          recommendation: "Verify manually whether /wp-json/ is reachable and whether that is intentional.",
          estimatedFixTime: "10 minutes",
        }),
      );
    }

    // 7. XML-RPC exposure
    try {
      const xmlrpcRes = await fetch(new URL("/xmlrpc.php", url), {
        method: "POST",
        signal: AbortSignal.timeout(8000),
      });

      if (xmlrpcRes.status === 403 || xmlrpcRes.status === 404) {
        findings.push(
          makeFinding({
            category: "security",
            title: "XML-RPC endpoint is not accessible",
            status: "pass",
            severity: "info",
            pageUrl: url,
            description: `/xmlrpc.php responded with HTTP ${xmlrpcRes.status}.`,
            whyItMatters: "A blocked or absent XML-RPC endpoint removes a known brute-force and DDoS amplification vector.",
            recommendation: "No action needed.",
            estimatedFixTime: "0 minutes",
          }),
        );
      } else if (xmlrpcRes.status === 200) {
        const body = await xmlrpcRes.text().catch(() => "");
        const looksLikeXmlRpc = /<methodResponse|<\?xml|Fault/i.test(body);
        findings.push(
          makeFinding({
            category: "security",
            title: "XML-RPC endpoint is exposed",
            status: "warning",
            severity: "medium",
            pageUrl: url,
            description: `/xmlrpc.php responded with HTTP 200${
              looksLikeXmlRpc ? " and returned XML-RPC-style content" : ""
            }, indicating the endpoint is active.`,
            whyItMatters: "xmlrpc.php is a well-known vector for brute-force login attempts (via system.multicall) and can be abused for DDoS amplification (pingback).",
            recommendation: "Disable XML-RPC entirely if not needed (e.g. for the Jetpack or mobile app integrations that require it), or restrict access to trusted IPs.",
            estimatedFixTime: "20 minutes",
          }),
        );
      } else {
        findings.push(
          makeFinding({
            category: "security",
            title: "XML-RPC endpoint returned an unexpected status",
            status: "warning",
            severity: "low",
            pageUrl: url,
            description: `/xmlrpc.php responded with HTTP ${xmlrpcRes.status}.`,
            whyItMatters: "An unexpected response makes it unclear whether this known attack vector is properly mitigated.",
            recommendation: "Verify manually whether xmlrpc.php should be disabled or restricted.",
            estimatedFixTime: "10 minutes",
          }),
        );
      }
    } catch {
      findings.push(
        makeFinding({
          category: "security",
          title: "XML-RPC exposure could not be verified",
          status: "warning",
          severity: "low",
          pageUrl: url,
          description: "/xmlrpc.php could not be fetched due to a network error.",
          whyItMatters: "Without verifying this, we cannot confirm whether this known brute-force/DDoS vector is mitigated.",
          recommendation: "Verify manually whether xmlrpc.php is disabled or restricted.",
          estimatedFixTime: "10 minutes",
        }),
      );
    }

    return findings;
  },
};
