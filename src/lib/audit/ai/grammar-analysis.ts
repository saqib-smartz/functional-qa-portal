import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, isAiConfigured, ANTHROPIC_MODEL } from "./client";
import { makeFinding, type AuditContext, type Finding, type Severity } from "@/lib/audit/types";

const ISSUE_TYPES = [
  "grammar",
  "spelling",
  "punctuation",
  "capitalization",
  "awkward-phrasing",
  "passive-voice",
  "long-sentence",
  "long-paragraph",
  "difficult-wording",
  "inconsistent-tone",
  "duplicate-content",
  "placeholder-text",
  "broken-english",
  "inconsistent-terminology",
] as const;

const ISSUE_TYPE_LABELS: Record<(typeof ISSUE_TYPES)[number], string> = {
  grammar: "Grammar Mistake",
  spelling: "Spelling Mistake",
  punctuation: "Incorrect Punctuation",
  capitalization: "Incorrect Capitalization",
  "awkward-phrasing": "Awkward Phrasing",
  "passive-voice": "Passive Voice",
  "long-sentence": "Long Sentence",
  "long-paragraph": "Long Paragraph",
  "difficult-wording": "Difficult Wording",
  "inconsistent-tone": "Inconsistent Tone",
  "duplicate-content": "Duplicate Content",
  "placeholder-text": "Placeholder Text",
  "broken-english": "Broken English",
  "inconsistent-terminology": "Inconsistent Terminology",
};

const SYSTEM_PROMPT = `You are a meticulous professional copy editor and QA reviewer for websites. You are given the visible
body text extracted from one webpage. Identify concrete writing issues: grammar mistakes, spelling mistakes,
awkward or broken English, incorrect punctuation, incorrect capitalization, passive voice used where active voice
would read better, sentences that are too long, paragraphs that are too long, unnecessarily difficult wording,
inconsistent tone, duplicate/repeated content, placeholder or Lorem Ipsum text left in by mistake, and inconsistent
terminology (the same concept referred to by different names inconsistently).

Only report real issues you are confident about — do not invent problems in already-correct text, and do not flag
proper nouns, brand names, or intentional stylistic choices as errors. For each issue, quote the exact original
text and a corrected/improved version. Keep "original" short (a phrase or sentence, not the whole page). Return at
most 40 of the clearest, highest-value issues.`;

const IssueSchema = z.strictObject({
  original: z.string(),
  suggestion: z.string(),
  issueType: z.enum(ISSUE_TYPES),
  severity: z.enum(["critical", "high", "medium", "low"]),
  explanation: z.string(),
});

const GrammarAnalysisResponseSchema = z.strictObject({
  issues: z.array(IssueSchema),
});

function toSeverity(value: string): Severity {
  return (["critical", "high", "medium", "low", "info"] as const).includes(value as Severity)
    ? (value as Severity)
    : "medium";
}

export async function analyzeGrammar(text: string, ctx: AuditContext): Promise<Finding[]> {
  if (!isAiConfigured()) {
    return [
      makeFinding({
        category: "grammar",
        title: "AI grammar analysis skipped — no API key configured",
        status: "warning",
        severity: "low",
        pageUrl: ctx.url,
        description: "ANTHROPIC_API_KEY is not configured, so automated grammar/spelling analysis did not run for this audit.",
        whyItMatters:
          "Spelling and grammar mistakes on a live page reflect poorly on brand credibility and can confuse visitors.",
        recommendation: "Set ANTHROPIC_API_KEY (and optionally ANTHROPIC_MODEL) in the environment to enable this check.",
        estimatedFixTime: "5 minutes",
      }),
    ];
  }

  if (!text.trim()) {
    return [
      makeFinding({
        category: "grammar",
        title: "No extractable body text",
        status: "pass",
        severity: "info",
        pageUrl: ctx.url,
        description: "No visible body text was found on the page to analyze for grammar or spelling.",
        whyItMatters: "Not applicable.",
        recommendation: "Not applicable.",
        estimatedFixTime: "N/A",
      }),
    ];
  }

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Analyze the following webpage body text:\n\n${text}` }],
    output_config: { format: zodOutputFormat(GrammarAnalysisResponseSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Claude returned a grammar-analysis response that could not be parsed.");
  }

  if (parsed.issues.length === 0) {
    return [
      makeFinding({
        category: "grammar",
        title: "No grammar or spelling issues detected",
        status: "pass",
        severity: "info",
        pageUrl: ctx.url,
        description: "AI-assisted review of the page's visible text did not surface any grammar or spelling issues.",
        whyItMatters: "Not applicable.",
        recommendation: "Not applicable.",
        estimatedFixTime: "N/A",
      }),
    ];
  }

  return parsed.issues.map((issue) => {
    const issueType = (ISSUE_TYPES as readonly string[]).includes(issue.issueType)
      ? (issue.issueType as (typeof ISSUE_TYPES)[number])
      : "grammar";

    return makeFinding({
      category: "grammar",
      title: ISSUE_TYPE_LABELS[issueType],
      status: "fail",
      severity: toSeverity(issue.severity),
      pageUrl: ctx.url,
      description: `Original: "${issue.original}"\n\n${issue.explanation}`,
      whyItMatters:
        "Clear, correct, professional writing builds trust and keeps visitors reading instead of bouncing.",
      recommendation: `Suggested rewrite: "${issue.suggestion}"`,
      estimatedFixTime: "1-2 minutes",
      meta: { original: issue.original, suggestion: issue.suggestion, issueType },
    });
  });
}
