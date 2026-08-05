'use client';

import { useEffect, useState } from 'react';

/**
 * Convert any CSS color string (oklch, hsl, rgb, hex) to a hex string.
 * Uses a temporary DOM element + getComputedStyle to let the browser
 * do the conversion. Returns '#22c55e' as fallback.
 */
function toHex(cssColor: string): string {
  if (typeof window === 'undefined') return '#22c55e';
  try {
    const el = document.createElement('div');
    el.style.color = cssColor;
    el.style.display = 'none';
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    // getComputedStyle always returns rgb() or rgba()
    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
    }
    return '#22c55e';
  } catch {
    return '#22c55e';
  }
}

/**
 * useThemeColor — reads a CSS custom property from :root and returns its
 * value as a HEX string. Re-reads when the theme changes.
 *
 * Always returns hex (#rrggbb) so it's safe to use with:
 * - recharts fill/stroke attributes
 * - inline style gradients (e.g. `linear-gradient(${color}, ${color}99)`)
 * - Any string concatenation
 *
 * @param varName CSS variable name without the leading '--' (default: 'primary')
 * @returns Hex color string (e.g. "#8b5cf6")
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
      if (val) {
        // Convert to hex — oklch/hsl/rgb all break string concatenation
        // (e.g. "oklch(0.5 0.15 142)99" is invalid CSS).
        setColor(toHex(val));
      }
    };

    readColor();

    window.addEventListener('rutina:theme-change', readColor);
    window.addEventListener('focus', readColor);

    return () => {
      window.removeEventListener('rutina:theme-change', readColor);
      window.removeEventListener('focus', readColor);
    };
  }, [varName]);

  return color;
}

/**
 * useThemeColors — reads multiple CSS variables at once as hex strings.
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
        if (val) next[name] = toHex(val);
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
