# WordPress AI QA Auditor

A Next.js 15 application that performs a comprehensive, AI-assisted QA audit of WordPress pages.
Submit a URL — or upload a `sitemap.xml` and audit many pages in one batch — and it runs a real
headless-browser audit (Playwright) across **16 categories**, then produces a QA report you can
read in the browser, export as a PDF, save to history, and diff against a previous crawl of the
same page.

---

## Table of contents

- [Features](#features)
- [Audit categories](#audit-categories)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [⚠️ The Forms module performs real submissions](#%EF%B8%8F-the-forms-module-performs-real-submissions)
- [Prerequisites](#prerequisites)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [MongoDB setup (optional)](#mongodb-setup-optional)
- [Sharing a report](#sharing-a-report)
- [Deployment](#deployment)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)

---

## Features

| Feature                      | Description                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single-page audit**        | Enter one URL, watch live per-module progress, get a full report.                                                                                       |
| **Sitemap batch crawl**      | Upload a `sitemap.xml` (or sitemap index), pick which URLs to audit, and crawl them with bounded concurrency.                                           |
| **AI grammar analysis**      | Page text is sent to Claude, which flags 14 kinds of writing issues (spelling, grammar, placeholder text, broken English, inconsistent terminology, …). |
| **AI executive summary**     | A written summary of the whole finding set, generated from the audit results.                                                                           |
| **PDF export**               | Renders a dedicated print-styled document and converts it via Playwright's `page.pdf()`.                                                                |
| **Audit history**            | Every audit is saved to MongoDB, browsable from a sidebar grouped by page with crawl counts.                                                            |
| **Crawl comparison**         | Diff any two audits of the same page — findings _added_, _resolved_, _unchanged_, plus a line-level text diff of the page content.                      |
| **Public share links**       | Mint an unguessable, revocable `/share/<token>` URL for any stored report — safe to send to a client.                                                    |
| **Clear history**            | One control wipes the stored audit database.                                                                                                            |
| **Responsive screenshots**   | Desktop, tablet, and mobile captures attached to the live report.                                                                                       |
| **WordPress fingerprinting** | Detects theme, plugins, and the `generator` tag.                                                                                                        |

History, comparison, and the sidebar are **optional** — they activate only when `MONGODB_URI` is
set. Without it, audits still run and report normally; nothing is persisted.

## Audit categories

Homepage · Navigation · Forms · Search · Images · Links · SEO · Responsive Design ·
Accessibility · Content Quality · Grammar & Spelling (AI) · Cookie Banner · Downloads ·
Performance · Security · WordPress Detection

Every finding carries a category, `pass`/`warning`/`fail` status, a severity
(`critical`/`high`/`medium`/`low`/`info`), a description, _why it matters_, a recommendation,
and an estimated fix time — written the way a QA engineer would report it in a review doc.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui ·
Playwright · Cheerio · MongoDB · Claude (Anthropic SDK) · React Hook Form · Zod ·
Framer Motion · Lucide

## How it works

1. `POST /api/audit` launches one Playwright browser, navigates to the submitted URL once at a
   desktop viewport (1440×900), and streams **NDJSON progress events** back to the client as each
   module runs — no job queue or external state store required.
2. Modules run in four phases, ordered by what they need:
   - **Phase A** (concurrent) — static HTML only, via Cheerio: homepage, SEO, WordPress detection,
     images, links, content quality, security, downloads, cookie banner.
   - **Phase B** (concurrent) — live page, read-only: performance, accessibility.
   - **Phase C/D** (sequential) — each _mutates_ the live page (viewport resize, navigation, form
     submission), so they run one at a time: responsive → navigation → search → forms.
3. Because navigation/search/forms may leave the browser on a results or thank-you page, the engine
   navigates **back to the original URL** before extracting visible text, then sends that text to
   Claude for grammar analysis and generates the executive summary.
4. If `MONGODB_URI` is set, the finished report is written to the `audits` collection (screenshots
   stripped — they're large base64 data URLs and only needed for the live view).
5. **Export as PDF** posts the in-memory report to `POST /api/audit/pdf`, which builds a print-styled
   HTML document and converts it with Playwright.

### Adding a new check

Every audit module lives in its own file under [src/lib/audit/modules/](src/lib/audit/modules/) and
implements one contract:

```ts
export const someModule: AuditModule = {
  category: "seo",
  label: "SEO",
  run: async (ctx: AuditContext) => Finding[],
};
```

Adding a check is a new file plus one line in the registry ([engine.ts](src/lib/audit/engine.ts)) —
no other module needs to change. Add the category to `CATEGORIES` and `CATEGORY_LABELS` in
[types.ts](src/lib/audit/types.ts) if it's a new one.

## ⚠️ The Forms module performs real submissions

The Forms audit module ([forms.ts](src/lib/audit/modules/forms.ts)) **actually submits** detected
forms (Contact Form 7, WPForms, Gravity Forms, Fluent Forms, Elementor Forms, Kadence Forms, Ninja
Forms, or a generic `<form>`) using obviously-fake test data — name "QA Audit Test", email
`qa-audit-test@example.com`, and a message stating it's an automated QA audit submission — so
success/error handling can be verified end-to-end. This is intentional, but it means:

- Running an audit against a real site **can create a real form entry and/or send a real email** to
  the site owner.
- Only the first 2 forms found on the page are submitted, once each per audit.
- A sitemap crawl of 50 pages submits forms on **every** page that has one.
- **Do not point this at a site you don't have permission to test.**

## Prerequisites

- **Node.js 22.x** (enforced via `engines` in [package.json](package.json))
- **npm**
- An **Anthropic API key** — optional but strongly recommended; without it, grammar analysis is
  skipped and the executive summary falls back to a deterministic template.
- A **MongoDB** database — optional; enables history and comparison.

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Download the Chromium browser Playwright drives (local dev only — see Deployment)
npx playwright install --with-deps chromium

# 3. Create your env file
cp .env.example .env.local

# 4. Edit .env.local and set ANTHROPIC_API_KEY (and MONGODB_URI if you want history)

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To run a production build locally:

```bash
npm run build
npm start
```

## Environment variables

Copy [.env.example](.env.example) to `.env.local` (git-ignored) and fill it in.

| Variable            | Required    | Default                 | Purpose                                                                                                                                                                                                                                                                    |
| ------------------- | ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Recommended | —                       | Powers AI grammar/spelling analysis and the executive summary. Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys). Without it, the audit still runs but records a finding noting grammar analysis was skipped.                                |
| `ANTHROPIC_MODEL`   | No          | `claude-haiku-4-5`      | Override to use a stronger model for higher-quality grammar analysis.                                                                                                                                                                                                      |
| `AUDIT_USER_AGENT`  | No          | Stock desktop Chrome UA | Overrides the browser User-Agent. Set this if a host's bot detection (e.g. Pressable) blocks the default.                                                                                                                                                                  |
| `MONGODB_URI`       | No          | —                       | Enables audit history, the sidebar, and crawl comparison. A MongoDB Atlas connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority`. Include the database name in the path — the code calls `client.db()` with no argument. |

Never commit real values. `.env*` is git-ignored except `.env.example`.

## MongoDB setup (optional)

Audits are stored in a single `audits` collection. Document shape (see
[src/lib/db/schema.md](src/lib/db/schema.md) and `AuditDocument` in
[audits.ts](src/lib/db/audits.ts)):

```ts
{
  _id: string; // report.id (UUID), reused as the Mongo _id
  url: string;
  crawledAt: Date;
  pageTitle: string | null;
  httpStatus: number | null;
  pageText: string; // visible text, used for the content diff
  report: AuditReport; // native subdocument, screenshots stripped
  crawlBatchId: string | null; // groups pages audited in one sitemap crawl
  shareToken: string | null; // public share secret; null when never shared or revoked
  sharedAt: Date | null;
}
```

The collection is created automatically on first write. Create the indexes once, via `mongosh` or
the Atlas UI's **Indexes** tab:

```js
db.audits.createIndex({ url: 1, crawledAt: -1 }, { name: "audits_url_crawledAt_idx" });
db.audits.createIndex({ crawlBatchId: 1 }, { name: "audits_crawlBatchId_idx", sparse: true });

db.audits.createIndex(
  { shareToken: 1 },
  {
    name: "audits_shareToken_idx",
    unique: true,
    partialFilterExpression: { shareToken: { $type: "string" } },
  },
);
```

The share index is **partial, not sparse**: revoked rows store an explicit `null`, which a sparse
index still indexes, so every revoked row would collide on the unique constraint. Rows written
before sharing existed simply lack both fields — no backfill is needed.

If you're using Atlas, allow your deployment's egress IPs under **Network Access**. Serverless
platforms use dynamic IPs, so `0.0.0.0/0` is typically required for Vercel — pair it with a strong,
least-privilege database user.

The connection pool is capped at `maxPoolSize: 10` and the `connect()` promise is cached across warm
serverless invocations and dev HMR reloads, so concurrent cold starts share one connection instead
of racing ([client.ts](src/lib/db/client.ts)).

## Sharing a report

Any stored report has a **Share** button next to _Export as PDF_. Clicking it mints a public URL:

```
https://your-deployment.example.com/share/<token>
```

The token is 256 bits of URL-safe randomness ([audits.ts](src/lib/db/audits.ts)), stored on the
audit's own document. What the recipient gets is a read-only view of that one report — findings,
filters, executive summary, and PDF export. The crawl-comparison panel is hidden, because it lists
every stored audit of that URL; so is the history sidebar.

Things worth knowing before you send a link:

- **Requires `MONGODB_URI`.** Without it nothing is persisted, so the Share button doesn't render.
- **Anyone with the URL can read the report.** There is no password and no login. Treat the link
  itself as the credential.
- **Links don't expire.** They live until you revoke them.
- **Revoking is immediate and permanent for that token.** The URL starts returning a real 404.
  Sharing the report again mints a *different* token; the old link never works.
- **Sharing is idempotent.** Clicking Share twice returns the same link, not a second one.
- **Shared pages are `noindex, nofollow`**, so they stay out of search results.
- **Full-page viewport screenshots aren't included.** `recordAudit` strips them before writing to
  MongoDB, so the desktop/tablet/mobile gallery reads "No screenshot captured" on a shared page.
  Screenshots attached to individual findings *are* stored and do render. Including the viewport
  captures would mean moving those PNGs to object storage — inline base64 would run at the 16 MB
  BSON document limit.

The share link is composed client-side from `window.location.origin`, so no base-URL environment
variable is needed and preview deployments mint links for their own host.

## Deployment

### Vercel (recommended)

The project is built for Vercel and needs no special build configuration.

1. **Import the repository** into Vercel. It auto-detects Next.js — build command `next build`,
   output handled by the framework preset.
2. **Set Node.js to 22.x** in _Project Settings → General → Node.js Version_. The `engines` field
   in `package.json` already pins `22.x`, which Vercel honors.
3. **Add the environment variables** from the table above under _Settings → Environment Variables_,
   for Production (and Preview, if you want previews to work).
4. **Deploy.**

**Why it works on serverless:** full Playwright + Chromium exceeds Vercel's function size and shared
library constraints, so production uses `playwright-core` + `@sparticuz/chromium` (a Lambda-compatible
Chromium build), while local development uses the full `playwright` package. The switch is automatic
— [browser.ts](src/lib/audit/browser.ts) checks for `VERCEL` / `AWS_LAMBDA_FUNCTION_NAME` /
`LAMBDA_TASK_ROOT` at runtime. [next.config.ts](next.config.ts) marks both packages as
`serverExternalPackages` and adds `outputFileTracingIncludes` entries for the audit routes, because
both resolve their binaries via runtime-computed paths that Next's static tracing can't discover on
its own.

> ⏱️ **Function duration matters.** An audit — multiple viewports, live form submission, two Claude
> calls — routinely takes 30–90+ seconds. The routes declare `maxDuration` (`/api/audit` = 300s,
> `/api/audit/pdf` = 120s, `/api/sitemap/parse` = 60s), but **Vercel enforces plan-based ceilings**:
> Hobby caps out around 60s, Pro allows 300s (more with Fluid Compute). **Pro or higher is strongly
> recommended** — on Hobby, expect heavier pages to time out mid-audit.

### Self-hosting (Node server, VPS, Docker)

Outside a serverless environment the app uses the full `playwright` package, so the host needs a real
Chromium and its system libraries.

```bash
npm install                                    # NOT --omit=dev — see note below
npx playwright install --with-deps chromium    # installs Chromium + OS dependencies
npm run build
npm start                                      # serves on :3000
```

> **Note:** `playwright` is currently a **devDependency**, while `playwright-core` and
> `@sparticuz/chromium` are runtime dependencies. A production install with `npm ci --omit=dev` will
> therefore fail at audit time on a non-serverless host with a module-not-found error. Either install
> with dev dependencies included (as above), or move `playwright` into `dependencies` for
> self-hosted deployments.

For Docker, base the image on `mcr.microsoft.com/playwright:v1.61.1-jammy` (matching the Playwright
version in `package.json`) so the browser and system libraries are preinstalled. Put the app behind a
reverse proxy with a **generous timeout** — the default 60s in nginx (`proxy_read_timeout`) will cut
audits off mid-stream. The audit endpoint streams its response, so also disable response buffering
(`proxy_buffering off;`).

### Deployment checklist

- [ ] Node 22.x
- [ ] `ANTHROPIC_API_KEY` set
- [ ] `MONGODB_URI` set and Atlas network access configured (if you want history)
- [ ] Indexes created on the `audits` collection
- [ ] Function/proxy timeout ≥ 300s
- [ ] Response buffering disabled on the reverse proxy (self-hosted only)

## API reference

All routes run on the Node.js runtime.

| Method   | Route                               | Description                                                                                                                                                         |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/audit`                        | Runs a full audit. Body: `{ url: string, crawlBatchId?: uuid }`. Streams `application/x-ndjson` progress events.                                                    |
| `POST`   | `/api/audit/pdf`                    | Body: `{ report: AuditReport }`. Returns a PDF attachment.                                                                                                          |
| `POST`   | `/api/sitemap/parse`                | Body: `{ xml: string }` (10 MB max). Parses a `<urlset>` or `<sitemapindex>`, fetching child sitemaps as needed. Returns up to 500 deduplicated URLs plus warnings. |
| `GET`    | `/api/audits/pages`                 | Every distinct crawled page with its crawl count and latest crawl — powers the history sidebar.                                                                     |
| `GET`    | `/api/audits?url=<url>`             | Past audits for one URL (id/date/title/status), for the "compare against" picker.                                                                                   |
| `GET`    | `/api/audits/[id]`                  | One historical audit in full, including its stored report.                                                                                                          |
| `GET`    | `/api/audits/compare?a=<id>&b=<id>` | Diffs two audits. Order doesn't matter — older/newer is decided by `crawledAt`.                                                                                     |
| `GET`    | `/api/audits/[id]/share`            | Returns `{ token }` — the report's live share token, or `null` if it isn't shared.                                                                                  |
| `POST`   | `/api/audits/[id]/share`            | Mints the share link, or re-returns the existing one. Responds `{ token, sharedAt, path }`.                                                                         |
| `DELETE` | `/api/audits/[id]/share`            | Revokes the share link. The URL 404s immediately and that token is dead permanently.                                                                                |
| `DELETE` | `/api/audits/clear`                 | Deletes all stored audit history. Returns `{ deletedCount }`.                                                                                                       |

### NDJSON stream events

`POST /api/audit` emits one JSON object per line:

```ts
| { type: "status";       message: string }
| { type: "module-start"; category: Category; label: string }
| { type: "module-done";  category: Category; findingsCount: number }
| { type: "module-error"; category: Category; message: string }
| { type: "error";        message: string }
| { type: "complete";     report: AuditReport }
```

[run-audit-request.ts](src/lib/audit/run-audit-request.ts) is the client-side consumer — it handles
chunk buffering and resolves with the final report.

### Comparison matching

Findings get fresh ids each run, and titles often embed volatile numbers (byte counts, timings), so
[compare-audits.ts](src/lib/diff/compare-audits.ts) matches on a coarser anchor: the AI's quoted
original snippet when present, otherwise the title with digit runs blanked out. `pass` findings are
excluded — a confirmation that nothing is wrong has no place in a before/after diff.

## Project structure

```
src/
  app/
    page.tsx                      # home: mode tabs → form/sitemap → progress → report
    layout.tsx, globals.css
    api/
      audit/route.ts              # POST, streams NDJSON progress + final report
      audit/pdf/route.ts          # POST report JSON → streams a PDF
      audits/route.ts             # GET past audits for a URL
      audits/[id]/route.ts        # GET one stored audit
      audits/pages/route.ts       # GET page summary tree for the sidebar
      audits/compare/route.ts     # GET diff of two audits
      audits/clear/route.ts       # DELETE all history
      sitemap/parse/route.ts      # POST sitemap XML → URL list
  components/
    home/                         # hero, audit form, sitemap upload + URL selector
    layout/                       # header, footer, history sidebar
    report/                       # report view, comparison view, PDF button, screenshots
    shared/                       # progress indicators, severity badge
    ui/                           # shadcn/ui primitives
  hooks/
    use-audit-stream.ts           # single-URL: submit and consume the NDJSON stream
    use-sitemap-crawl.ts          # batch: parse sitemap, crawl with concurrency limit
  lib/
    audit/
      types.ts                    # Finding / AuditReport / AuditContext / AuditModule
      engine.ts                   # orchestrator — phases, concurrency, streaming, persistence
      browser.ts                  # Playwright launch (serverless vs. local)
      fetch-page.ts               # single navigation + Cheerio snapshot, viewport constants
      screenshots.ts, blocked-page.ts
      modules/                    # one file per QA category
      detectors/                  # WP theme/plugin, form-plugin, cookie-provider fingerprints
      ai/                         # Anthropic client, text extraction, grammar, exec summary
    db/                           # Mongo client, audits collection access, schema.md
    diff/compare-audits.ts        # findings + content diff between two crawls
    sitemap/                      # sitemap XML parsing, child-sitemap fetching
    pdf/build-report-html.ts      # print-HTML template for PDF export
    concurrency/run-pool.ts       # bounded-concurrency worker pool
    validation/                   # zod request schemas
```

## Scripts

```bash
npm run dev           # dev server (Turbopack)
npm run build         # production build (Turbopack)
npm start             # serve the production build
npm run lint          # eslint
npm run format        # prettier --write .
npm run format:check  # prettier --check .
```

## Troubleshooting

| Symptom                                                             | Likely cause / fix                                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Audit times out on Vercel**                                       | Function duration ceiling. Upgrade past Hobby, or enable Fluid Compute. See [Deployment](#deployment).               |
| **`Executable doesn't exist` / browser launch fails locally**       | Run `npx playwright install --with-deps chromium`.                                                                   |
| **Module-not-found for `playwright` on a self-hosted server**       | You installed with `--omit=dev`. `playwright` is a devDependency — see the self-hosting note.                        |
| **Audit fails on a specific host with a 403 or bot-detection page** | Set `AUDIT_USER_AGENT` to a UA that host accepts.                                                                    |
| **"AI grammar analysis failed" finding**                            | `ANTHROPIC_API_KEY` missing/invalid, or the API call errored. Check server logs.                                     |
| **History sidebar is empty / "Audit history is not configured"**    | `MONGODB_URI` isn't set, or the connection is failing. Check Atlas network access.                                   |
| **Audit completes but "could not be saved to history"**             | The audit succeeded; the DB write failed. Verify the URI includes a database name and the user has write permission. |
| **Comparison shows everything as added _and_ resolved**             | Expected only if findings changed shape substantially; normal numeric drift is already normalized away.              |
| **Screenshots missing on a historical audit**                       | By design — screenshots are stripped before storage. Use the comparison view to see what changed.                    |

---

Built with [Next.js](https://nextjs.org) and [Claude](https://www.anthropic.com/claude).
