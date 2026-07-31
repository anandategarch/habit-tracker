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
};

export default nextConfig;