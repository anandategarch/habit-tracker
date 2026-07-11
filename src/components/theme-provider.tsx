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
 * ThemeProvider — runs early, fetches settings, applies theme colors & dark mode.
 * Listens for 'rutina:theme-change' custom events to re-apply.
 */
export default function ThemeProvider() {
  const appliedRef = useRef(false);

  const applySettings = (data: SettingsData) => {
    const isDark = data.theme === 'dark';
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
      })
      .catch(() => {
        // On fetch failure, at least apply dark mode preference from localStorage
        if (!appliedRef.current) {
          const pref = localStorage.getItem('rutina_theme');
          if (pref === 'dark') applyThemeMode(true);
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
    return () => window.removeEventListener('rutina:theme-change', handler);
  }, []);

  return null; // No UI
}