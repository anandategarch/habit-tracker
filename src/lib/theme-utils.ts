// lib/theme-utils.ts — preset warna tema (dipakai settings + use-theme-color).
export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'teal', name: 'Teal Aurora', primary: '#14b8a6', secondary: '#10b981' },
  { id: 'emerald', name: 'Emerald Forest', primary: '#10b981', secondary: '#84cc16' },
  { id: 'rose', name: 'Rose Sunset', primary: '#f43f5e', secondary: '#ec4899' },
  { id: 'amber', name: 'Amber Dusk', primary: '#f59e0b', secondary: '#f97316' },
  { id: 'violet', name: 'Violet Nebula', primary: '#8b5cf6', secondary: '#a78bfa' },
  { id: 'sky', name: 'Sky Lagoon', primary: '#0ea5e9', secondary: '#38bdf8' },
];

export const CURATED_THEME_PRESETS: ThemePreset[] = THEME_PRESETS;

/** Terapkan warna preset ke :root (CSS var --primary/--primary-foreground). */
export function applyThemeColors(presetId: string): void {
  if (typeof window === 'undefined') return;
  const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty('--primary', hexToOklch(preset.primary));
  root.style.setProperty('--primary-foreground', 'oklch(0.985 0.001 247)');
  root.dataset.themeColor = preset.id;
}

/** Terapkan mode tema (light/dark/system) pada <html class>. */
export function applyThemeMode(mode: 'light' | 'dark' | 'system'): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (mode === 'dark') root.classList.add('dark');
  else if (mode === 'light') root.classList.add('light');
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(prefersDark ? 'dark' : 'light');
  }
}

export function resetThemeColors(): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-foreground');
  delete root.dataset.themeColor;
}

function hexToOklch(hex: string): string {
  // Konversi cukup dekat untuk kebutuhan tint (nilai dipilih manual agar
  // kontras teks tetap aman; identitas warna tetap dari preset).
  const map: Record<string, string> = {
    '#14b8a6': 'oklch(0.70 0.11 178)',
    '#10b981': 'oklch(0.71 0.15 162)',
    '#f43f5e': 'oklch(0.65 0.2 15)',
    '#f59e0b': 'oklch(0.77 0.16 70)',
    '#8b5cf6': 'oklch(0.61 0.2 292)',
    '#0ea5e9': 'oklch(0.68 0.15 220)',
  };
  return map[hex.toLowerCase()] ?? 'oklch(0.70 0.11 178)';
}
