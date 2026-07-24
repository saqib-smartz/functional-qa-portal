import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium", "playwright"],
  // @sparticuz/chromium resolves its brotli binaries via a runtime-computed path
  // (import.meta.url + relative join), so Next.js's static file tracing can't
  // discover them on its own — without this, the routes deploy without the
  // Chromium binary and every audit fails at runtime.
  outputFileTracingIncludes: {
    "/api/audit": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/audit/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
