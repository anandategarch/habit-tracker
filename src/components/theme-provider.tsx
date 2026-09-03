'use client';

import { useEffect, useRef } from 'react';
import {
  applyThemeColors,
  applyThemeMode,
  resetThemeColors,
} from '@/lib/theme-utils';

interface SettingsData {
  theme?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Resolve a theme value to a concrete dark/light boolean.
 * BUGHUNT-OTHER-1 BUG-L1: previously only 'dark' was treated as dark; the
 * schema-allowed 'system' value was ignored (treated as light). Now
 * 'system' resolves via `prefers-color-scheme` and stays in sync when the
 * OS preference changes.
 */
function resolveIsDark(theme: string | undefined): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  // 'system' or any unknown → follow OS preference.
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

/**
 * ThemeProvider — runs early, fetches settings, applies theme colors & dark mode.
 * Listens for 'rutina:theme-change' custom events to re-apply.
 */
export default function ThemeProvider() {
  const appliedRef = useRef(false);
  // Track the dark mq listener so we can clean it up.
  const darkMqRef = useRef<MediaQueryList | null>(null);

  const applySettings = (data: SettingsData) => {
    const isDark = resolveIsDark(data.theme);
    const primary = data.primaryColor || '#22c55e';
    const secondary = data.secondaryColor || '#10b981';

    applyThemeMode(isDark);

    // If using default emerald green, reset to CSS defaults (cleaner oklch colors)
    if (
      primary.toLowerCase() === '#22c55e' &&
      secondary.toLowerCase() === '#10b981'
    ) {
      resetThemeColors();
    } else {
      applyThemeColors(primary, secondary, isDark);
    }
  };

  useEffect(() => {
    // Prevent flash: check sessionStorage for cached settings
    const cached = sessionStorage.getItem('rutina_settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        applySettings(parsed);
        appliedRef.current = true;
        // Notify chart components (useThemeColor) to re-read CSS variables
        window.dispatchEvent(new CustomEvent('rutina:theme-change', { detail: parsed }));
      } catch {
        // ignore
      }
    }

    // Fetch latest settings from API
    fetch('/api/settings')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        // Cache in sessionStorage for next load
        sessionStorage.setItem('rutina_settings', JSON.stringify(data));
        applySettings(data);
        appliedRef.current = true;
        // Notify chart components (useThemeColor) to re-read CSS variables
        window.dispatchEvent(new CustomEvent('rutina:theme-change', { detail: data }));
      })
      .catch(() => {
        // BUGHUNT-OTHER-1 BUG-L2: previously this fell back to a never-set
        // `localStorage['rutina_theme']` value (dead code). If the fetch
        // failed AND we never applied cached settings, fall back to the OS
        // preference via resolveIsDark('system'). This keeps the page
        // usable (with a sensible theme) when the API is unreachable.
        if (!appliedRef.current) {
          applySettings({ theme: 'system' });
        }
      });

    // Listen for theme changes from Settings page
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        applySettings(detail);
        // Update cache
        sessionStorage.setItem('rutina_settings', JSON.stringify(detail));
      } else {
        // No detail — re-fetch from API
        fetch('/api/settings')
          .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
          .then((data) => {
            sessionStorage.setItem('rutina_settings', JSON.stringify(data));
            applySettings(data);
          });
      }
    };
    window.addEventListener('rutina:theme-change', handler);

    // BUGHUNT-OTHER-1 BUG-L1: when theme is 'system', react to OS changes.
    // We don't know the user's choice until settings load, so register the
    // listener unconditionally and re-apply on change (cheap no-op when
    // theme is hard-coded light/dark).
    let mq: MediaQueryList | null = null;
    let mqHandler: (() => void) | null = null;
    if (typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      darkMqRef.current = mq;
      mqHandler = () => {
        // Re-apply using the most recently cached settings (which contain
        // the user's theme choice). If 'system', this will pick up the new
        // OS preference; if hard-coded light/dark, this is a no-op.
        const cachedSettings = sessionStorage.getItem('rutina_settings');
        if (cachedSettings) {
          try {
            applySettings(JSON.parse(cachedSettings));
          } catch {
            // ignore
          }
        }
      };
      // addEventListener is the modern API; addListener is the Safari < 14 fallback.
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', mqHandler);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(mqHandler);
      }
    }

    return () => {
      window.removeEventListener('rutina:theme-change', handler);
      if (mq && mqHandler) {
        if (typeof mq.removeEventListener === 'function') {
          mq.removeEventListener('change', mqHandler);
        } else if (typeof mq.removeListener === 'function') {
          mq.removeListener(mqHandler);
        }
      }
    };
  }, []);

  return null; // No UI
}