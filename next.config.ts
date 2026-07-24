import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium", "playwright"],
  // @sparticuz/chromium and playwright-core both resolve some of their assets
  // (Chromium binaries, browsers.json) via runtime-computed paths, so Next.js's
  // static file tracing can't discover them on its own — without this, the
  // routes deploy without those files and every audit fails at runtime.
  outputFileTracingIncludes: {
    "/api/audit": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/playwright-core/**",
    ],
    "/api/audit/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/playwright-core/**",
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
