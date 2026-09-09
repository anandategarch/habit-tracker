import type { NextConfig } from "next";

// `output: "standalone"` HANYA untuk self-host (sandbox: `bun run start` menjalankan
// .next/standalone/server.js). Di Vercel, build adapter mereka tidak kompatibel dengan
// standalone — `next build` crash ENOENT .next/next-server.js.nft.json
// (lihat vercel/next.js#96657, #49594). Vercel mengeset env VERCEL=1 saat build,
// jadi kita matikan standalone di sana.
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(!isVercel ? { output: "standalone" as const } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
