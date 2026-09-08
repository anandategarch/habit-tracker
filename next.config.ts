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
  // dedupe recharts/lucide-react into a SINGLE shared chunk across
  // all dynamic() importers. Before: recharts+lodash+d3 was duplicated
  // across two ~381KB chunks (Finance + Calendar/DailyTracker). After: a
  // single shared vendor chunk is fetched once + reused. Also ensures
  // lucide-react tree-shakes into a shared chunk instead of being
  // re-bundled per-tab.
  //
  // NOTE: `date-fns` is intentionally NOT in this list — it remains a real
  // dependency (used by src/lib/date-utils.ts and many components/routes)
  // and its ESM build already tree-shakes well, so dedupe hints add nothing.
  // (An earlier comment here claimed date-fns had been removed — wrong.)
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
};

export default nextConfig;