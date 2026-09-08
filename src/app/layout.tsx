import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import ServiceWorkerRegister from "@/components/sw-register";
import ThemeProvider from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { AppLockGate } from "@/components/app-lock/AppLockGate";
// FIX-TIER2 / Fix 4: LazyMotion + domAnimation removed. All framer-motion
// `m.*` usages in the loaders kit + page-transition.tsx have been
// converted to pure CSS keyframes (see globals.css `.css-*` classes) +
// the local usePrefersReducedMotion hook. framer-motion is no longer
// imported anywhere in the First Load bundle (the few remaining
// framer-motion users, if any, are dynamically-imported components).

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
    { media: "(prefers-color-scheme: light)", color: "#f5f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#101513" },
  ],
};

// BUGHUNT-OTHER-1 BUG-M15: inline before-paint script that reads cached
// theme settings from sessionStorage and applies the `dark` class + CSS
// variables BEFORE React hydrates. This prevents the flash-of-light-theme
// (FOUC) that occurred because ThemeProvider's useEffect runs only AFTER
// hydration. The script is tiny (just enough to set the dark class and
// the primary/secondary CSS vars) — the full ThemeProvider effect still
// runs later to fetch fresh settings + register listeners.
//
// We use `dangerouslySetInnerHTML` because Next.js escapes inline JS in
// normal children, and we need this script to execute synchronously in
// <head> before the body paints.
const themeBootstrap = `(function(){
  try {
    var raw = sessionStorage.getItem('rutina_settings');
    if (!raw) return;
    var s = JSON.parse(raw);
    var theme = s.theme || 'light';
    var isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia &&
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) root.classList.add('dark'); else root.classList.remove('dark');
    var primary = (s.primaryColor || '#22c55e').toLowerCase();
    var secondary = (s.secondaryColor || '#10b981').toLowerCase();
    // Only apply custom colors when NOT the default emerald preset (the
    // stylesheet handles defaults cleanly via oklch).
    if (!(primary === '#22c55e' && secondary === '#10b981')) {
      function hexToRgb(h){h=h.replace('#','');return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};}
      function lum(c){var r=c.r/255,g=c.g/255,b=c.b/255;function x(v){return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}return 0.2126*x(r)+0.7152*x(g)+0.0722*x(b);}
      function fg(c){return lum(c)>0.4?'#0a0a0a':'#fafafa';}
      function lighten(c,a){return {r:Math.round(c.r+(255-c.r)*a),g:Math.round(c.g+(255-c.g)*a),b:Math.round(c.b+(255-c.b)*a)};}
      function toHex(c){return '#'+[c.r,c.g,c.b].map(function(v){return ('0'+v.toString(16)).slice(-2);}).join('');}
      function tint(c,o){return 'rgb('+Math.round(c.r*o+255*(1-o))+','+Math.round(c.g*o+255*(1-o))+','+Math.round(c.b*o+255*(1-o))+')';}
      var pc=hexToRgb(primary), sc=hexToRgb(secondary);
      var pLight = isDark ? toHex(lighten(pc,0.15)) : primary;
      var sTint = isDark ? tint(sc,0.15) : tint(sc,0.92);
      var pFg = fg(pc);
      root.style.setProperty('--primary', pLight);
      root.style.setProperty('--primary-foreground', pFg);
      root.style.setProperty('--secondary', sTint);
      root.style.setProperty('--secondary-foreground', isDark ? '#fafafa' : '#1a1a1a');
      root.style.setProperty('--ring', pLight);
      root.style.setProperty('--accent', sTint);
      root.style.setProperty('--accent-foreground', isDark ? '#fafafa' : '#1a1a1a');
      root.style.setProperty('--sidebar-primary', pLight);
      root.style.setProperty('--sidebar-primary-foreground', pFg);
      root.style.setProperty('--sidebar-accent', sTint);
      root.style.setProperty('--sidebar-accent-foreground', isDark ? '#fafafa' : '#1a1a1a');
      root.style.setProperty('--sidebar-ring', pLight);
      root.style.setProperty('--chart-1', pLight);
    }
  } catch (e) { /* ignore — ThemeProvider will handle fallback */ }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider />
        <QueryProvider>
          <AppLockGate>{children}</AppLockGate>
        </QueryProvider>
        <ServiceWorkerRegister />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}