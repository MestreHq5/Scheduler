import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    // Benign Next.js/webpack warning: next/font's embedded font data and
    // Tailwind's generated CSS get cached as large JS strings in webpack's
    // persistent build cache (PackFileCacheStrategy). The string comes from
    // framework internals, not app code, so there's nothing to restructure —
    // this only drops the log level instead of leaving a noisy, unactionable
    // warning on every build.
    config.infrastructureLogging = { level: "error" };
    return config;
  },
};

export default nextConfig;
