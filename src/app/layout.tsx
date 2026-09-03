import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import ServiceWorkerRegister from "@/components/sw-register";
import ThemeProvider from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rutina",
  description: "Build daily routines, track your growth",
  icons: {
    // PNG icons are required for Android home screen + iOS apple-touch-icon.
    // The previous SVG data: URL emoji worked for desktop browser tabs but
    // was silently ignored by iOS Safari (which requires PNG for
    // apple-touch-icon) and not preferred by Android Chrome for home-screen
    // install. See worklog ICON-FIX-1.
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rutina",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover enables safe-area-inset env() variables for iOS notch
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider />
        <QueryProvider>
          {children}
        </QueryProvider>
        <ServiceWorkerRegister />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}