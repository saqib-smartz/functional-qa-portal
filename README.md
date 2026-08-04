# WordPress AI QA Auditor

A Next.js 15 application that performs a comprehensive, AI-assisted QA audit of a **single** WordPress page.
Submit a URL, and it runs a real headless-browser audit (Playwright) across 15 categories — homepage,
navigation, forms, search, images, links, SEO, responsive design, content quality, grammar (AI-powered),
cookie banner, downloads, performance, security, and WordPress detection — then produces a textual QA report
you can export as a PDF. It never crawls beyond the one submitted page.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · shadcn/ui · Playwright · Claude (Anthropic) ·
React Hook Form · Zod · Framer Motion · Lucide

## How it works

1. `POST /api/audit` launches one Playwright browser, navigates to the submitted URL once (desktop viewport),
   and streams NDJSON progress events back to the client as each audit module runs.
2. Modules that only need the static HTML (SEO, images, links, WordPress detection, etc.) run concurrently via
   Cheerio. Modules that need a live, interactive page (performance metrics, responsive-viewport screenshots,
   navigation/search/form interaction) run afterward against the same browser context.
3. After all DOM-based modules finish, the page's visible text is extracted and sent to Claude (Anthropic) for
   grammar/spelling analysis, then an executive summary is generated from the full finding set.
4. The client holds the completed report in memory; **Export as PDF** posts it to `POST /api/audit/pdf`, which
   renders a dedicated print-styled HTML document and converts it to a PDF via Playwright's `page.pdf()`.

Every audit module lives in its own file under `src/lib/audit/modules/` and implements one contract:

```ts
export const someModule: AuditModule = {
  category: "seo",
  label: "SEO",
  run: async (ctx: AuditContext) => Finding[],
};
```

Adding a new check is a new file plus one line in the registry (`src/lib/audit/engine.ts`) — no other module
needs to change.

## ⚠️ Forms module performs real submissions

The Forms audit module (`src/lib/audit/modules/forms.ts`) **actually submits** detected forms (Contact Form 7,
WPForms, Gravity Forms, Fluent Forms, Elementor Forms, Kadence Forms, Ninja Forms, or a generic `<form>`) using
obviously-fake test data (name "QA Audit Test", email `qa-audit-test@example.com`, a message stating it's an
automated QA audit submission) so success/error messages can be verified end-to-end. This is intentional, but
it means:

- Running an audit against a real site **can create a real form entry and/or send a real email** to the site
  owner.
- Only the first 2 forms found on the page are submitted, and only once each per audit.
- Do not point this at a site you don't have permission to test against.

## Setup

```bash
npm install
npx playwright install --with-deps chromium   # local dev only — see Deployment below
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` in `.env` (required for grammar analysis and the AI executive summary — without it, the
report falls back to a deterministic, templated summary and a finding noting AI grammar analysis was skipped).
`ANTHROPIC_MODEL` is optional (defaults to `claude-haiku-4-5`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

Full Playwright + Chromium doesn't fit Vercel's serverless function size/library constraints, so production
uses `playwright-core` + `@sparticuz/chromium` (a Lambda-compatible Chromium build); local development uses the
full `playwright` package instead, via `src/lib/audit/browser.ts`. No extra configuration is needed beyond
deploying normally — `next.config.ts` already marks these packages as external server dependencies.

**Function duration**: an audit (multiple viewports, live form submission, a Claude API call) can take
30–90+ seconds. The API routes set `maxDuration = 300` (300s), but Vercel enforces plan-based ceilings — Hobby
caps out around 60s, Pro allows up to 300s+ (higher with Fluid Compute). **Pro or higher is recommended** for
reliable full audits; on Hobby, expect slower/heavier pages to time out.

## Project structure

```
src/
  app/
    page.tsx                 # home page: form → live progress → report
    api/audit/route.ts       # POST, streams NDJSON progress + final report
    api/audit/pdf/route.ts   # POST report JSON -> streams a PDF
  components/                # UI: home, report, layout, shared, shadcn ui/
  lib/
    audit/
      types.ts               # Finding / AuditReport / AuditContext / AuditModule contract
      engine.ts               # orchestrator — phases, concurrency, streaming
      browser.ts              # Playwright browser launch (prod vs. dev)
      fetch-page.ts            # single navigation + Cheerio snapshot
      modules/                 # one file per QA category
      detectors/               # WordPress theme/plugin, form-plugin, cookie-provider fingerprints
      ai/                      # Claude (Anthropic) client, text extraction, grammar analysis, executive summary
    pdf/build-report-html.ts   # print-HTML template used for PDF export
    validation/                # zod request schema
  hooks/use-audit-stream.ts    # client hook: submit URL, consume the NDJSON stream
```

## Linting & formatting

```bash
npm run lint
npm run format        # prettier --write
npm run format:check
```
