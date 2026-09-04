import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed ignoreBuildErrors: true — was silently swallowing TypeScript
  // errors in production builds, hiding real type bugs. Now build fails on
  // type errors (correct behavior — fix the errors, don't hide them).
  reactStrictMode: true, // was false — enables React dev safety net (double-invoke effects to catch bugs)
  allowedDevOrigins: [
    "http://21.0.11.1:3000",
    "http://localhost:3000",
  ],
  // PERF-BUNDLE-1 Fix 9: optimizePackageImports forces Next/Turbopack to
  // dedupe recharts/lucide-react/date-fns into a SINGLE shared chunk across
  // all dynamic() importers. Before: recharts+lodash+d3 was duplicated
  // across two ~381KB chunks (Finance + Calendar/DailyTracker). After: a
  // single shared vendor chunk is fetched once + reused. Also ensures
  // lucide-react + date-fns tree-shake into a shared chunk instead of being
  // re-bundled per-tab.
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'date-fns'],
  },
};

export default nextConfig;