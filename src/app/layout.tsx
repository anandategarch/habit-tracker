import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Toaster sonner — SEMUA komponen memakai `toast` dari 'sonner' (tracker,
// habit-master, finance, …). Toaster radix lama tidak punya konsumen
// (use-toast) sehingga toast tidak pernah tampil; dipasangkan Toaster
// sonner yang membaca tema.
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

export const metadata: Metadata = {
  title: "Rutina — Habit & Finance Tracker",
  description:
    "Rutina: pelacak habit dan keuangan pribadi. Bangun rutinitas, catat mood & energi, kelola budget, tabungan, dan tujuan.",
  applicationName: "Rutina",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <SWRegister />
        <Toaster />
      </body>
    </html>
  );
}
