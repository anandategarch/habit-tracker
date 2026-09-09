'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { applyThemeColors } from '@/lib/theme-utils';
import type { AppSettings } from '@/lib/settings-types';

/**
 * QueryClient global dengan konfigurasi standar Rutina.
 * ThemeProvider (next-themes) memakai class strategy agar sinkron dengan
 * token .dark di globals.css — sekaligus memperbaiki toast sonner yang
 * membaca useTheme() (dulu tanpa provider → selalu "system").
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ThemeBoot />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * FIX THEME-BOOT: tema tersimpan kini diterapkan saat app start.
 * Dulu applyThemeMode/applyThemeColors hanya dipanggil dari preview
 * settings — setelah reload tema kembali ke default (dark mode mati).
 * Boot ini subscribe query settings lalu:
 *  - menerapkan mode ke <html class> VIA next-themes (setTheme) supaya
 *    toast/sonner ikut tema app;
 *  - menerapkan warna preset ke CSS var --primary.
 */
function ThemeBoot() {
  const { setTheme } = useTheme();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<AppSettings> => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Gagal memuat pengaturan');
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!settings) return;
    setTheme(settings.theme);
    applyThemeColors(settings.themeColor);
  }, [settings, setTheme]);

  return null;
}
