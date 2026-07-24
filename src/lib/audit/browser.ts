import type { Browser } from "playwright-core";

const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
);

/**
 * Full Chromium doesn't fit Vercel's serverless function size/lib constraints, so production
 * uses playwright-core + the AWS-Lambda-compatible @sparticuz/chromium build. Locally, the full
 * `playwright` package (with its own downloaded browser) is simpler and needs no executablePath.
 */
export async function getBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    const [{ chromium }, sparticuzChromium] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium").then((m) => m.default),
    ]);

    return chromium.launch({
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}
