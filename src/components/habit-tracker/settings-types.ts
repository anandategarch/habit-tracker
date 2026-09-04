// Extracted from settings.tsx — types specific to the settings page.
//
// AppSettings lives in the shared `@/lib/settings-types` module because
// calendar-view.tsx (and other future consumers) also need it. We re-export
// it from here so settings.tsx can pull everything from one place.

export type { AppSettings } from '@/lib/settings-types';

/** Local form state shape — what the Settings page edits before saving. */
export interface SettingsFormState {
  userName: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  weekStart: string;
  language: string;
  targetCompletion: number;
}

export type SettingsSection = 'umum' | 'habits' | 'data';
