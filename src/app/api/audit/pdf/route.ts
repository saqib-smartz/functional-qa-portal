import type { NextRequest } from "next/server";
import { getBrowser } from "@/lib/audit/browser";
import { buildReportHtml } from "@/lib/pdf/build-report-html";
import type { AuditReport } from "@/lib/audit/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const FOOTER_TEMPLATE = `
  <div style="font-size:9px;width:100%;text-align:center;color:#8b949e;font-family:-apple-system,sans-serif;">
    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>`;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const report = body?.report as AuditReport | undefined;

  if (!report || typeof report.url !== "string" || !Array.isArray(report.findings)) {
    return Response.json({ error: "A valid audit report is required." }, { status: 400 });
  }

  const html = buildReportHtml(report);

  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: FOOTER_TEMPLATE,
      margin: { top: "20px", bottom: "36px", left: "0", right: "0" },
    });

    const slug = new URL(report.url).hostname.replace(/[^a-z0-9.-]/gi, "-");

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qa-audit-${slug}.pdf"`,
      },
    });
  } finally {
    await browser.close().catch(() => undefined);
  }
}
