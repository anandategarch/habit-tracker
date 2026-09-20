import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
// Toaster sonner — SEMUA komponen memakai `toast` dari 'sonner' (tracker,
// habit-master, finance, …); Toaster ini membaca tema.
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { SWRegister } from "@/components/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// TASK 45 (Design System v2) — Fraunces: serif editorial variabel (optical
// size + "soft" axis) untuk momen emosional: sapaan hero, angka "X dari Y",
// kutipan, dan refleksi. Typografi 3 lapis brief: Display (Fraunces) /
// Sans (Geist) / Serif kontekstual (Fraunces). Georgia hardcoded di
// .premium-quote-text & .work-serif kini memakai variable ini.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // Sumbu variable font — SOFT memberi karakter hangat "wonky" pada display,
// opsz menyesuaikan kontras secara otomatis per ukuran.
  axes: ["SOFT", "opsz", "WONK"],
});

export const metadata: Metadata = {
  title: "Rutina — Habit & Finance Tracker",
  description:
    "Rutina: pelacak habit dan keuangan pribadi. Bangun rutinitas, catat mood & energi, kelola budget, tabungan, dan tujuan.",
  applicationName: "Rutina",
  // TASK 61-i: meta iOS standalone — tanpa ini Next tidak emit
  // apple-mobile-web-app-capable/-status-bar-style/-title; status bar
  // standalone iOS memakai style terang default yang bentrok dengan dark
  // mode + viewportFit cover (sudah ada di export viewport di bawah).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rutina",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS tidak mendukung SVG apple-touch-icon — wajib PNG opaque.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#101513" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="id": seluruh UI berbahasa Indonesia (fix a11y screen reader).
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <SWRegister />
        <Toaster />
      </body>
    </html>
  );
}
