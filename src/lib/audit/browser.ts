import type { Browser } from "playwright-core";

const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
);

/**
 * Full Chromium doesn't fit Vercel's serverless function size/lib constraints, so production
 * uses playwright-core + the AWS-Lambda-compatible @sparticuz/chromium build. Locally, the full
 * `playwright` package (with its own downloaded browser) is simpler and needs no executablePath.
 */
// Suppresses the navigator.webdriver flag that most baseline bot-detection checks look for.
const STEALTH_ARGS = ["--disable-blink-features=AutomationControlled"];

export async function getBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    const [{ chromium }, sparticuzChromium] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium").then((m) => m.default),
    ]);

    // The SwiftShader GPU stack runs in-process under --single-process, so when it exhausts its
    // buffers compositing a tall, iframe-heavy page it takes the whole browser down mid-screenshot.
    // Audits don't need WebGL; software compositing is slower to fail and cheaper on memory.
    sparticuzChromium.setGraphicsMode = false;

    return chromium.launch({
      args: [...sparticuzChromium.args, ...STEALTH_ARGS],
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true, args: STEALTH_ARGS });
}
