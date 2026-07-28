'use client';

import { useEffect, useState } from 'react';

/**
 * useThemeColor — reads a CSS custom property from :root and returns its
 * computed value. Re-reads when the theme changes (listens for the
 * 'rutina:theme-change' custom event dispatched by applyThemeColors).
 *
 * This is needed because recharts SVG attributes (fill, stroke) don't
 * support CSS variables directly — we must pass a concrete color string.
 *
 * @param varName CSS variable name without the leading '--' (default: 'primary')
 * @returns The computed color value (hex, oklch, rgb — whatever was set), or a fallback.
 *
 * @example
 * const primary = useThemeColor('primary'); // "#8b5cf6" or "oklch(...)"
 * <Bar fill={primary} />
 */
export function useThemeColor(varName = 'primary'): string {
  const fallback = varName === 'primary' ? '#22c55e' : '#64748b';
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    const readColor = () => {
      if (typeof window === 'undefined') return;
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue(`--${varName}`)
        .trim();
      if (val) setColor(val);
    };

    // Read once on mount.
    readColor();

    // Re-read when theme changes (custom event from settings).
    window.addEventListener('rutina:theme-change', readColor);
    // Also re-read on window focus (in case theme was changed in another tab).
    window.addEventListener('focus', readColor);

    return () => {
      window.removeEventListener('rutina:theme-change', readColor);
      window.removeEventListener('focus', readColor);
    };
  }, [varName]);

  return color;
}

/**
 * useThemeColors — reads multiple CSS variables at once.
 * Returns an object with the requested variable names as keys.
 *
 * @param varNames Array of CSS variable names without '--' prefix.
 * @returns Object mapping names to computed values.
 *
 * @example
 * const { primary, chart1 } = useThemeColors(['primary', 'chart-1']);
 */
export function useThemeColors(varNames: string[]): Record<string, string> {
  const [colors, setColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const readColors = () => {
      if (typeof window === 'undefined') return;
      const next: Record<string, string> = {};
      for (const name of varNames) {
        const val = getComputedStyle(document.documentElement)
          .getPropertyValue(`--${name}`)
          .trim();
        if (val) next[name] = val;
      }
      setColors(next);
    };

    readColors();
    window.addEventListener('rutina:theme-change', readColors);
    window.addEventListener('focus', readColors);

    return () => {
      window.removeEventListener('rutina:theme-change', readColors);
      window.removeEventListener('focus', readColors);
    };
  }, [varNames.join(',')]);

  return colors;
}
