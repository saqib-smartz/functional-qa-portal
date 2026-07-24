import type { Browser, BrowserContext, Page } from "playwright-core";
import type { CheerioAPI } from "cheerio";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Status = "pass" | "warning" | "fail";

export const CATEGORIES = [
  "homepage",
  "navigation",
  "forms",
  "search",
  "images",
  "links",
  "seo",
  "responsive",
  "content-quality",
  "grammar",
  "cookie-banner",
  "downloads",
  "performance",
  "security",
  "wordpress",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  homepage: "Homepage",
  navigation: "Navigation",
  forms: "Forms",
  search: "Search",
  images: "Images",
  links: "Links",
  seo: "SEO",
  responsive: "Responsive Design",
  "content-quality": "Content Quality",
  grammar: "Grammar & Spelling",
  "cookie-banner": "Cookie Banner",
  downloads: "Downloads",
  performance: "Performance",
  security: "Security",
  wordpress: "WordPress Detection",
};

/** A single QA finding, written the way a QA engineer would report it in a review doc. */
export interface Finding {
  id: string;
  category: Category;
  title: string;
  status: Status;
  severity: Severity;
  pageUrl: string;
  description: string;
  whyItMatters: string;
  recommendation: string;
  estimatedFixTime: string;
  /** base64 data URL, only attached when a screenshot materially illustrates the finding */
  screenshot?: string;
  /** free-form structured detail specific to a module, e.g. grammar original/suggestion */
  meta?: Record<string, unknown>;
}

export interface WordPressDetectionResult {
  isWordPress: boolean;
  theme?: string;
  themeConfidence?: "high" | "medium" | "low";
  plugins: string[];
  generator?: string;
}

export interface AuditScreenshots {
  desktop: string;
  tablet: string;
  mobile: string;
}

export interface AuditReport {
  id: string;
  url: string;
  pageTitle: string;
  startedAt: string;
  finishedAt: string;
  httpStatus: number;
  screenshots: AuditScreenshots;
  wordpress: WordPressDetectionResult;
  findings: Finding[];
  executiveSummary: string;
}

/** Shared state built once per audit and passed to every module. */
export interface AuditContext {
  url: string;
  page: Page;
  browserContext: BrowserContext;
  browser: Browser;
  html: string;
  $: CheerioAPI;
  httpStatus: number;
  responseHeaders: Record<string, string>;
  screenshots: AuditScreenshots;
  /** mutated in place by wordpress-detection.ts so later modules (e.g. forms) can read it */
  wordpress: WordPressDetectionResult;
}

export interface AuditModule {
  category: Category;
  label: string;
  run: (ctx: AuditContext) => Promise<Finding[]>;
}

export type AuditStreamEvent =
  | { type: "status"; message: string }
  | { type: "module-start"; category: Category; label: string }
  | { type: "module-done"; category: Category; findingsCount: number }
  | { type: "module-error"; category: Category; message: string }
  | { type: "error"; message: string }
  | { type: "complete"; report: AuditReport };

let findingCounter = 0;

/** Deterministic-enough id generator; audits run once per request so collision risk is nil. */
export function nextFindingId(category: Category): string {
  findingCounter += 1;
  return `${category}-${findingCounter}-${Math.floor(Math.random() * 1e6)}`;
}

export function makeFinding(input: Omit<Finding, "id">): Finding {
  return { id: nextFindingId(input.category), ...input };
}
