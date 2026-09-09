'use client';

// hooks/use-theme-color.ts — warna tema aktif dari settings (sinkron dgn CSS var).
import { useQuery } from '@tanstack/react-query';
import type { AppSettings } from '@/lib/settings-types';

export function useThemeColor(): { themeColor: string; theme: string; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<AppSettings> => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Gagal memuat pengaturan');
      return res.json();
    },
    staleTime: 60_000,
  });
  return {
    themeColor: data?.themeColor ?? 'teal',
    theme: data?.theme ?? 'system',
    isLoading,
  };
}
