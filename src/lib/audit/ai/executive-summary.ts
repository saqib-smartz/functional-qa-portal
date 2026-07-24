import { getOpenAIClient, isAiConfigured, OPENAI_MODEL } from "./client";
import { describeNonSuccessStatus } from "@/lib/audit/blocked-page";
import { CATEGORY_LABELS, type AuditContext, type Finding } from "@/lib/audit/types";

const SYSTEM_PROMPT = `You are a senior QA engineer writing the executive summary section of a professional webpage
audit report for a client (a WordPress agency, developer, or content team). Write 2 short paragraphs in a
confident, professional, plain-English tone — no bullet lists, no markdown, no headings. The first paragraph
should state what was reviewed and give an overall impression. The second should call out the most important
findings (by title, briefly) and close with a clear verdict on launch-readiness given the outstanding issues.
Do not invent findings that weren't provided. Do not use numeric scores.`;

function buildPrompt(
  ctx: AuditContext,
  findings: Finding[],
  counts: { fail: number; warning: number; pass: number; critical: number; high: number },
): string {
  const notable = findings
    .filter((f) => f.status !== "pass" && (f.severity === "critical" || f.severity === "high"))
    .slice(0, 10)
    .map((f) => `- [${CATEGORY_LABELS[f.category]}] ${f.title} (${f.severity})`)
    .join("\n");

  return [
    `Page audited: ${ctx.url}`,
    `Total findings: ${findings.length} (${counts.fail} failed, ${counts.warning} warnings, ${counts.pass} passed)`,
    `Critical severity: ${counts.critical}, High severity: ${counts.high}`,
    notable ? `Most notable issues:\n${notable}` : "No critical or high-severity issues were found.",
  ].join("\n\n");
}

function countBy(findings: Finding[]) {
  return {
    fail: findings.filter((f) => f.status === "fail").length,
    warning: findings.filter((f) => f.status === "warning").length,
    pass: findings.filter((f) => f.status === "pass").length,
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
  };
}

function buildFallbackSummary(
  ctx: AuditContext,
  findings: Finding[],
  counts: ReturnType<typeof countBy>,
): string {
  const topIssues = findings
    .filter((f) => f.status !== "pass" && (f.severity === "critical" || f.severity === "high"))
    .slice(0, 5)
    .map((f) => f.title);

  const intro = `I analyzed ${ctx.url} across functionality, SEO, responsive design, content quality, security, and WordPress best practices. The page was reviewed with ${findings.length} individual checks: ${counts.pass} passed, ${counts.warning} produced warnings, and ${counts.fail} failed outright.`;

  const highlights =
    topIssues.length > 0
      ? `Key findings include: ${topIssues.join("; ")}.`
      : "No critical or high-severity issues were found during this audit.";

  const verdict =
    counts.critical > 0
      ? "Several critical issues should be resolved before this page is considered launch-ready."
      : counts.high > 0
        ? "The page is generally solid, but resolving the high-priority issues above will meaningfully improve quality before launch."
        : "The page demonstrates good overall quality and is considered launch-ready, with only minor items left to polish.";

  return `${intro} ${highlights} ${verdict}`;
}

export async function generateExecutiveSummary(ctx: AuditContext, findings: Finding[]): Promise<string> {
  const counts = countBy(findings);
  // Prepended deterministically (not left to the model) so it can never be paraphrased away or omitted.
  const blockedWarning = describeNonSuccessStatus(ctx.httpStatus);

  const summary = await (async () => {
    if (!isAiConfigured()) {
      return buildFallbackSummary(ctx, findings, counts);
    }

    try {
      const client = getOpenAIClient();
      const completion = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(ctx, findings, counts) },
        ],
      });

      const text = completion.choices[0]?.message?.content?.trim();
      return text && text.length > 0 ? text : buildFallbackSummary(ctx, findings, counts);
    } catch {
      return buildFallbackSummary(ctx, findings, counts);
    }
  })();

  return blockedWarning ? `${blockedWarning}\n\n${summary}` : summary;
}
