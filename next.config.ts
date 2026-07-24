import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium", "playwright"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
