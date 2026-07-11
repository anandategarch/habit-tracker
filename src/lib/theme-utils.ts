/**
 * Theme utility functions for runtime color application.
 * Converts hex colors to CSS variables and handles light/dark mode.
 */

/** Convert hex (#rrggbb) to { r, g, b } (0-255) */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

/** Calculate relative luminance (0-1) per WCAG 2.1 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Return appropriate foreground color (light or dark) based on background luminance */
export function getContrastForeground(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lum = getLuminance(r, g, b);
  // If background is light, use dark text; if dark, use light text
  return lum > 0.4 ? '#0a0a0a' : '#fafafa';
}

/** Lighten a hex color by mixing with white */
export function lightenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Darken a hex color by mixing with black */
export function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c * (1 - amount));
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Generate a very light tint of the color (for backgrounds, secondary, accent) */
export function tintColor(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  // Mix with white at given opacity
  const mix = (c: number) => Math.round(c * opacity + 255 * (1 - opacity));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Apply theme colors as CSS custom properties on :root */
export function applyThemeColors(
  primaryHex: string,
  secondaryHex: string,
  isDark: boolean
): void {
  const root = document.documentElement;
  const fg = getContrastForeground(primaryHex);
  const primaryLight = isDark ? lightenHex(primaryHex, 0.15) : primaryHex;
  const secondaryTint = tintColor(secondaryHex, isDark ? 0.15 : 0.92);

  // Set CSS variables
  root.style.setProperty('--primary', primaryLight);
  root.style.setProperty('--primary-foreground', fg);
  root.style.setProperty('--secondary', secondaryTint);
  root.style.setProperty('--secondary-foreground', isDark ? '#fafafa' : '#1a1a1a');
  root.style.setProperty('--ring', primaryLight);
  root.style.setProperty('--accent', secondaryTint);
  root.style.setProperty('--accent-foreground', isDark ? '#fafafa' : '#1a1a1a');

  // Sidebar
  root.style.setProperty('--sidebar-primary', primaryLight);
  root.style.setProperty('--sidebar-primary-foreground', fg);
  root.style.setProperty('--sidebar-accent', secondaryTint);
  root.style.setProperty('--sidebar-accent-foreground', isDark ? '#fafafa' : '#1a1a1a');
  root.style.setProperty('--sidebar-ring', primaryLight);

  // Chart colors
  root.style.setProperty('--chart-1', primaryLight);
}

/** Toggle dark/light mode by adding/removing .dark class */
export function applyThemeMode(isDark: boolean): void {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/** Remove all inline theme CSS variables (reset to stylesheet defaults) */
export function resetThemeColors(): void {
  const root = document.documentElement;
  const vars = [
    '--primary', '--primary-foreground',
    '--secondary', '--secondary-foreground',
    '--ring', '--accent', '--accent-foreground',
    '--sidebar-primary', '--sidebar-primary-foreground',
    '--sidebar-accent', '--sidebar-accent-foreground',
    '--sidebar-ring', '--chart-1',
  ];
  vars.forEach((v) => root.style.removeProperty(v));
}

/** Dispatch a custom event so ThemeProvider can react to settings changes */
export function dispatchThemeChange(): void {
  window.dispatchEvent(new CustomEvent('rutina:theme-change'));
}

/** Preset theme definitions */
export interface ThemePreset {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  emoji: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Emerald', primaryColor: '#22c55e', secondaryColor: '#10b981', emoji: '🌿' },
  { name: 'Ocean', primaryColor: '#0ea5e9', secondaryColor: '#06b6d4', emoji: '🌊' },
  { name: 'Violet', primaryColor: '#8b5cf6', secondaryColor: '#a78bfa', emoji: '🔮' },
  { name: 'Rose', primaryColor: '#f43f5e', secondaryColor: '#fb7185', emoji: '🌹' },
  { name: 'Amber', primaryColor: '#f59e0b', secondaryColor: '#fbbf24', emoji: '⚡' },
  { name: 'Slate', primaryColor: '#64748b', secondaryColor: '#94a3b8', emoji: '🪨' },
  { name: 'Teal', primaryColor: '#14b8a6', secondaryColor: '#2dd4bf', emoji: '🔱' },
  { name: 'Crimson', primaryColor: '#dc2626', secondaryColor: '#ef4444', emoji: '❤️' },
];