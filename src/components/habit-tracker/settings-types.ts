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

// BUGHUNT-ROUND3 SETTINGS-SECTION-1: SettingsSection now lives in the global
// app-store (lifted so the section survives main-tab switches). Re-exported
// here so settings.tsx keeps pulling everything from one place — no
// duplicate union to keep in sync.
export type { SettingsSection } from '@/store/app-store';
