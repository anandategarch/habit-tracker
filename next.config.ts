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
  // FIX HYDRATION PREVIEW: panel preview sandbox mem-proxy app lewat origin
  // lintas-domain (preview-chat-*.space-z.ai). Tanpa whitelist ini, dev
  // server Next 16 menolak request /_next/* lintas-origin — chunk JS bisa
  // gagal/tertunda saat hidrasi berjalan → React melihat DOM berubah →
  // "Hydration failed because the server rendered text didn't match the
  // client" (recoverable error, tree diregenerasi). Whitelist pola domain
  // preview supaya dev assets selalu diizinkan.
  allowedDevOrigins: ["*.space-z.ai", "https://*.space-z.ai"],
};

export default nextConfig;
