import { makeFinding, type AuditModule, type AuditContext, type Finding } from "@/lib/audit/types";

const LAZY_EXEMPT_COUNT = 2; // first N images are treated as likely above-the-fold

interface ImgRecord {
  index: number;
  src: string;
  effectiveSrc: string;
  hasAlt: boolean;
  hasWidth: boolean;
  hasHeight: boolean;
  hasLazy: boolean;
  isWebp: boolean;
  inPicture: boolean;
}

function resolveUrl(raw: string, base: string): string {
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

function looksLikeWebp(value: string): boolean {
  return /\.webp(\?|#|$)/i.test(value.split(",")[0]?.trim() ?? value);
}

function firstNonEmpty(...vals: Array<string | undefined>): string {
  for (const v of vals) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
}

function capList<T>(items: T[], cap = 10): { items: T[]; truncated: boolean; totalCount: number } {
  return { items: items.slice(0, cap), truncated: items.length > cap, totalCount: items.length };
}

export const imagesModule: AuditModule = {
  category: "images",
  label: "Images",
  run: async (ctx: AuditContext): Promise<Finding[]> => {
    const findings: Finding[] = [];
    const $ = ctx.$;
    const records: ImgRecord[] = [];

    $("img").each((index, el) => {
      const node = $(el);
      const src = node.attr("src") ?? "";
      const srcset = node.attr("srcset") ?? "";
      const dataSrc = node.attr("data-src") ?? node.attr("data-lazy-src") ?? "";
      const dataSrcset = node.attr("data-srcset") ?? node.attr("data-lazy-srcset") ?? "";
      const effectiveSrc = firstNonEmpty(src, dataSrc, srcset, dataSrcset);

      const picture = node.closest("picture");
      const inPicture = picture.length > 0;
      const webpSource =
        inPicture &&
        picture
          .find("source")
          .toArray()
          .some((s) => {
            const type = $(s).attr("type") ?? "";
            const ss = $(s).attr("srcset") ?? "";
            return /image\/webp/i.test(type) || looksLikeWebp(ss);
          });

      const isWebp =
        webpSource || looksLikeWebp(src) || looksLikeWebp(srcset) || looksLikeWebp(dataSrc) || looksLikeWebp(dataSrcset);

      records.push({
        index,
        src: resolveUrl(effectiveSrc || src, ctx.url),
        effectiveSrc,
        hasAlt: node.attr("alt") !== undefined,
        hasWidth: !!node.attr("width"),
        hasHeight: !!node.attr("height"),
        hasLazy: (node.attr("loading") ?? "").toLowerCase() === "lazy",
        isWebp,
        inPicture,
      });
    });

    const totalImages = records.length;

    // --- Missing alt ---
    const missingAlt = records.filter((r) => !r.hasAlt);
    {
      const cap = capList(missingAlt.map((r) => r.src));
      findings.push(
        makeFinding({
          category: "images",
          title: missingAlt.length === 0 ? "All images have alt attributes" : "Images missing alt attributes",
          status: missingAlt.length === 0 ? "pass" : "fail",
          severity: missingAlt.length === 0 ? "info" : "high",
          pageUrl: ctx.url,
          description:
            missingAlt.length === 0
              ? `Checked ${totalImages} image(s) on the page; all have an alt attribute.`
              : `${missingAlt.length} of ${totalImages} image(s) are missing an alt attribute.`,
          whyItMatters:
            "Alt text is essential for screen reader users and search engines to understand image content. Missing alt attributes are a common accessibility (WCAG 1.1.1) and SEO failure.",
          recommendation: "Add a descriptive alt attribute to every content image (or alt=\"\" for purely decorative images).",
          estimatedFixTime: missingAlt.length === 0 ? "0 minutes" : "30 minutes",
          meta: missingAlt.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- Missing width/height (CLS risk) ---
    const missingDimensions = records.filter((r) => !(r.hasWidth && r.hasHeight));
    {
      const cap = capList(missingDimensions.map((r) => r.src));
      findings.push(
        makeFinding({
          category: "images",
          title:
            missingDimensions.length === 0
              ? "All images have explicit width/height"
              : "Images missing explicit width/height attributes",
          status: missingDimensions.length === 0 ? "pass" : "warning",
          severity: missingDimensions.length === 0 ? "info" : "medium",
          pageUrl: ctx.url,
          description:
            missingDimensions.length === 0
              ? `All ${totalImages} image(s) declare both width and height.`
              : `${missingDimensions.length} of ${totalImages} image(s) are missing a width and/or height attribute, which can cause layout shift (CLS) while the page loads.`,
          whyItMatters:
            "Without explicit dimensions, the browser cannot reserve space for the image before it loads, causing content to jump around (Cumulative Layout Shift), which hurts Core Web Vitals and user experience.",
          recommendation: "Add explicit width and height attributes to every <img> tag (or use CSS aspect-ratio) so the browser can reserve layout space.",
          estimatedFixTime: missingDimensions.length === 0 ? "0 minutes" : "1 hour",
          meta: missingDimensions.length
            ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount }
            : undefined,
        })
      );
    }

    // --- Non-WebP formats ---
    const nonWebp = records.filter((r) => !r.isWebp && r.src);
    {
      const cap = capList(nonWebp.map((r) => r.src));
      findings.push(
        makeFinding({
          category: "images",
          title: nonWebp.length === 0 ? "Images are served in modern formats" : "Images not served as WebP",
          status: nonWebp.length === 0 ? "pass" : "warning",
          severity: nonWebp.length === 0 ? "info" : "low",
          pageUrl: ctx.url,
          description:
            nonWebp.length === 0
              ? "All detected images use WebP (or an equivalent modern format source)."
              : `${nonWebp.length} of ${totalImages} image(s) are served in legacy formats (e.g. JPG/PNG/GIF) rather than WebP.`,
          whyItMatters:
            "WebP images are typically 25-35% smaller than equivalent JPG/PNG files at the same visual quality, improving page load time and Core Web Vitals.",
          recommendation:
            "Convert images to WebP (with a fallback via <picture>/<source> if broad legacy browser support is required), e.g. using a plugin like ShortPixel, Imagify, or WebP Express.",
          estimatedFixTime: nonWebp.length === 0 ? "0 minutes" : "1 hour",
          meta: nonWebp.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- Missing loading="lazy" (excluding likely above-the-fold images) ---
    const belowFold = records.filter((r) => r.index >= LAZY_EXEMPT_COUNT);
    const missingLazy = belowFold.filter((r) => !r.hasLazy);
    {
      const cap = capList(missingLazy.map((r) => r.src));
      findings.push(
        makeFinding({
          category: "images",
          title: missingLazy.length === 0 ? "Below-the-fold images use lazy loading" : "Images missing loading=\"lazy\"",
          status: missingLazy.length === 0 ? "pass" : "warning",
          severity: missingLazy.length === 0 ? "info" : "low",
          pageUrl: ctx.url,
          description:
            belowFold.length === 0
              ? "Not enough images on the page to evaluate lazy-loading (only likely above-the-fold images present)."
              : missingLazy.length === 0
                ? `All ${belowFold.length} below-the-fold image(s) use loading="lazy".`
                : `${missingLazy.length} of ${belowFold.length} below-the-fold image(s) are missing loading="lazy" (the first ${LAZY_EXEMPT_COUNT} images on the page are excluded as likely above-the-fold).`,
          whyItMatters:
            "Lazy-loading offscreen images defers their download until they're about to enter the viewport, reducing initial page weight and improving load performance.",
          recommendation: "Add loading=\"lazy\" to <img> tags that appear below the initial viewport.",
          estimatedFixTime: missingLazy.length === 0 ? "0 minutes" : "20 minutes",
          meta: missingLazy.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    }

    // --- Broken images (live browser check) ---
    try {
      const broken = await ctx.page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.src)
      );
      const cap = capList(broken);
      findings.push(
        makeFinding({
          category: "images",
          title: broken.length === 0 ? "No broken images detected" : "Broken images found",
          status: broken.length === 0 ? "pass" : "fail",
          severity: broken.length === 0 ? "info" : "critical",
          pageUrl: ctx.url,
          description:
            broken.length === 0
              ? "All images on the page loaded successfully."
              : `${broken.length} image(s) failed to load (broken src).`,
          whyItMatters:
            "Broken images look unprofessional, waste a network request, and typically indicate a missing file, incorrect path, or deleted media in the WordPress media library.",
          recommendation: "Fix or replace the broken image sources, or remove the <img> tags if the assets no longer exist.",
          estimatedFixTime: broken.length === 0 ? "0 minutes" : "30 minutes",
          meta: broken.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    } catch {
      // If the live check fails for any reason, don't crash the module.
    }

    // --- Oversized images (live browser check) ---
    try {
      const oversized = await ctx.page.evaluate(() =>
        Array.from(document.images)
          .map((img) => ({
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            clientWidth: img.clientWidth,
            clientHeight: img.clientHeight,
          }))
          .filter(
            (i) =>
              i.naturalWidth > 0 &&
              i.clientWidth > 0 &&
              i.naturalWidth > i.clientWidth * 2
          )
      );
      const cap = capList(
        oversized.map((i) => `${i.src} (natural ${i.naturalWidth}x${i.naturalHeight}, rendered ${i.clientWidth}x${i.clientHeight})`)
      );
      findings.push(
        makeFinding({
          category: "images",
          title: oversized.length === 0 ? "Images are appropriately sized" : "Oversized images found",
          status: oversized.length === 0 ? "pass" : "warning",
          severity: oversized.length === 0 ? "info" : "medium",
          pageUrl: ctx.url,
          description:
            oversized.length === 0
              ? "No images were found serving significantly larger pixel dimensions than their rendered size."
              : `${oversized.length} image(s) are served at more than 2x the pixel dimensions they're actually rendered at, wasting bandwidth.`,
          whyItMatters:
            "Serving oversized images increases page weight and load time unnecessarily; the extra pixels are downloaded but never displayed.",
          recommendation:
            "Resize/compress images to match their rendered dimensions, or use responsive images (srcset/sizes) so the browser can pick an appropriately sized file.",
          estimatedFixTime: oversized.length === 0 ? "0 minutes" : "1 hour",
          meta: oversized.length ? { items: cap.items, truncated: cap.truncated, totalCount: cap.totalCount } : undefined,
        })
      );
    } catch {
      // If the live check fails for any reason, don't crash the module.
    }

    return findings;
  },
};
