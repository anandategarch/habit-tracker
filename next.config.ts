import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "http://21.0.11.1:3000",
    "http://localhost:3000",
  ],
};

export default nextConfig;