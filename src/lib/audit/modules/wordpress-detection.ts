import { makeFinding, type AuditModule, type Finding } from "@/lib/audit/types";
import { detectTheme } from "@/lib/audit/detectors/wordpress-themes";
import { detectPlugins, detectIsWordPress, detectGenerator } from "@/lib/audit/detectors/wordpress-plugins";

export const wordpressDetectionModule: AuditModule = {
  category: "wordpress",
  label: "WordPress Detection",
  run: async (ctx) => {
    const findings: Finding[] = [];
    const { html, url } = ctx;

    const isWordPress = detectIsWordPress(html);
    const { theme, confidence } = detectTheme(html);
    const plugins = detectPlugins(html);
    const generator = detectGenerator(html);

    // Mutate shared context in place so later modules (e.g. forms.ts) can read it.
    ctx.wordpress.isWordPress = isWordPress;
    ctx.wordpress.theme = theme;
    ctx.wordpress.themeConfidence = confidence;
    ctx.wordpress.plugins = plugins;
    ctx.wordpress.generator = generator;

    // 1. Is WordPress?
    findings.push(
      makeFinding({
        category: "wordpress",
        title: isWordPress ? "Site is running on WordPress" : "Site does not appear to be running on WordPress",
        status: "pass",
        severity: "info",
        pageUrl: url,
        description: isWordPress
          ? `WordPress fingerprints (wp-content/wp-includes paths or a WordPress generator tag) were detected.${
              generator ? ` Generator tag: "${generator}".` : ""
            }`
          : "No WordPress fingerprints (wp-content/wp-includes paths or a WordPress generator tag) were found in the page HTML.",
        whyItMatters: "Knowing the CMS platform determines which platform-specific checks (themes, plugins, security hardening) are relevant to this audit.",
        recommendation: "No action needed — this is informational.",
        estimatedFixTime: "0 minutes",
        meta: { isWordPress, generator },
      }),
    );

    // 2. Theme detection
    if (theme) {
      findings.push(
        makeFinding({
          category: "wordpress",
          title: `Detected theme: ${theme}`,
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `The active theme appears to be "${theme}" (confidence: ${confidence ?? "unknown"}).`,
          whyItMatters: "Knowing the active theme helps contextualize markup/performance findings elsewhere in this report.",
          recommendation: "No action needed — this is informational.",
          estimatedFixTime: "0 minutes",
          meta: { theme, confidence },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "wordpress",
          title: "Theme could not be identified",
          status: "pass",
          severity: "low",
          pageUrl: url,
          description: "No wp-content/themes/<slug> reference could be found in the page HTML to identify the active theme.",
          whyItMatters: "This is usually harmless (many themes obfuscate or proxy asset paths), but it limits how specific this audit can be about theme-related issues.",
          recommendation: "No action needed — this is informational.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    // 3. Plugin detection
    if (plugins.length > 0) {
      findings.push(
        makeFinding({
          category: "wordpress",
          title: `Detected ${plugins.length} plugin(s)`,
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: `Plugins detected from page markup: ${plugins.slice(0, 10).join(", ")}${
            plugins.length > 10 ? ` (and ${plugins.length - 10} more)` : ""
          }.`,
          whyItMatters: "Knowing which plugins are active helps contextualize forms, SEO, and performance findings elsewhere in this report.",
          recommendation: "No action needed — this is informational.",
          estimatedFixTime: "0 minutes",
          meta: { items: plugins.slice(0, 10), total: plugins.length },
        }),
      );
    } else {
      findings.push(
        makeFinding({
          category: "wordpress",
          title: "No plugins detected",
          status: "pass",
          severity: "info",
          pageUrl: url,
          description: "No recognizable plugin fingerprints were found in the page markup.",
          whyItMatters: "This may mean the site uses few/no plugins, or that active plugins don't leave detectable markup fingerprints.",
          recommendation: "No action needed — this is informational.",
          estimatedFixTime: "0 minutes",
        }),
      );
    }

    return findings;
  },
};
