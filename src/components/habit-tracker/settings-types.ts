// components/habit-tracker/settings-types.ts — tipe UI settings.
//
// - AppSettings di-re-export dari lib/settings-types (mirror API/DB —
//   single source of truth, kolom language/targetCompletion tetap ada di
//   DB tapi TIDAK dipakai form Gel 1, lihat worklog 9-b).
// - SettingsSection di-re-export dari store (fix 6-d SETTINGS-SECTION-1:
//   sub-section diangkat ke store supaya survive pergantian tab).

export type { AppSettings } from '@/lib/settings-types';
export type { SettingsSection } from '@/store/app-store';

/** State form Settings versi Gel 1 (tanpa Bahasa & Target Penyelesaian). */
export interface SettingsFormState {
  userName: string;
  theme: 'light' | 'dark' | 'system';
  /** id preset warna ('teal' | 'emerald' | ... — kolom AppSettings.themeColor). */
  themeColor: string;
  /** 0 = Minggu, 1 = Senin. */
  weekStart: number;
}
