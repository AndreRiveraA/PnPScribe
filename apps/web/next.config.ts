import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "..", "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@pnpscribe/ingestion"],
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
