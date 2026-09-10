// lib/settings-types.ts — mirror bentuk API /api/settings (AppSettings DB).
export interface AppSettings {
  userName: string;
  theme: 'light' | 'dark' | 'system';
  themeColor: string;
  weekStart: number; // 0 = Minggu, 1 = Senin
  language: string; // kolom DB tetap; UI selalu Indonesia
  targetCompletion: number;
  updatedAt?: string;
}
