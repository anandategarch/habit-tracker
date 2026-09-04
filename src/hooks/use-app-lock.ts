'use client';

// React hook for app-lock state management.
//
// Responsibilities:
//   - Track `isLocked` state in React
//   - Auto-lock on:
//       * page visibility change (app backgrounded) — immediately if
//         `autoLockTimeout === 0`, else on next foreground if elapsed > timeout
//       * inactivity (mouse / keyboard / touch) for `autoLockTimeout` ms
//       * initial mount, if the last unlock was longer ago than the timeout
//   - Expose `lock()`, `unlock()`, `refreshConfig()` to the UI
//
// SSR-safe: the initial config is read from `getAppLockConfig()` which itself
// returns defaults on the server; the visibility/inactivity listeners are only
// attached in a `useEffect`, so they never run during SSR.

import { useState, useEffect, useCallback } from 'react';
import {
  APP_LOCK_CONFIG_EVENT,
  getAppLockConfig,
  getLastUnlockedAt,
  setLastUnlockedAt,
  type AppLockConfig,
} from '@/lib/app-lock/storage';

export interface UseAppLockResult {
  isLocked: boolean;
  isEnabled: boolean;
  config: AppLockConfig;
  lock: () => void;
  unlock: () => void;
  refreshConfig: () => void;
}

// Compute the initial lock state from persisted data. Called once during the
// first render via the `useState` initializer so we never call `setState`
// synchronously inside an effect (which would trigger cascading renders).
function computeInitialLockState(config: AppLockConfig): boolean {
  // App lock is disabled / no PIN configured → never lock.
  if (!config.enabled || !config.pinHash) return false;

  const lastUnlock = getLastUnlockedAt();
  // First run (never unlocked before) — don't lock the user out of setup.
  if (lastUnlock === 0) return false;

  if (config.autoLockTimeout === 0) return true;
  const elapsed = Date.now() - lastUnlock;
  return elapsed > config.autoLockTimeout;
}

export function useAppLock(): UseAppLockResult {
  const [config, setConfig] = useState<AppLockConfig>(() => getAppLockConfig());
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const initialConfig = getAppLockConfig();
    return computeInitialLockState(initialConfig);
  });

  const isEnabled = config.enabled && !!config.pinHash;

  const lock = useCallback(() => {
    if (isEnabled) setIsLocked(true);
  }, [isEnabled]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    setLastUnlockedAt(Date.now());
  }, []);

  const refreshConfig = useCallback(() => {
    setConfig(getAppLockConfig());
  }, []);

  // Cross-instance sync: when another `useAppLock` instance (or the Settings
  // panel) mutates the app-lock config via `setAppLockConfig` /
  // `clearAppLockConfig`, a `rutina:app-lock-config-changed` CustomEvent is
  // dispatched on `window`. Subscribe here so this instance picks up the
  // change without a page reload. Without this, enabling app lock in
  // Settings would not activate AppLockGate's lock screen until reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => refreshConfig();
    window.addEventListener(APP_LOCK_CONFIG_EVENT, handler);
    return () => window.removeEventListener(APP_LOCK_CONFIG_EVENT, handler);
  }, [refreshConfig]);

  // Auto-lock on visibility change + inactivity.
  useEffect(() => {
    if (!isEnabled) return;

    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    const clearInactivity = () => {
      if (inactivityTimer !== null) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
    };

    const resetInactivity = () => {
      clearInactivity();
      if (config.autoLockTimeout > 0) {
        inactivityTimer = setTimeout(() => lock(), config.autoLockTimeout);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        // App backgrounded — lock immediately if timeout is 0, else rely on
        // the elapsed-time check when the app returns to the foreground.
        if (config.autoLockTimeout === 0) lock();
      } else {
        // App returned to foreground — check elapsed time against last unlock.
        const lastUnlock = getLastUnlockedAt();
        const elapsed = Date.now() - lastUnlock;
        if (config.autoLockTimeout === 0 || elapsed > config.autoLockTimeout) {
          lock();
        } else {
          // Restart inactivity timer with remaining budget.
          resetInactivity();
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('mousemove', resetInactivity);
    document.addEventListener('keydown', resetInactivity);
    document.addEventListener('touchstart', resetInactivity);

    // Kick off the inactivity timer if a timeout is configured and we're not
    // already locked on mount.
    if (config.autoLockTimeout > 0 && !isLocked) {
      resetInactivity();
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('mousemove', resetInactivity);
      document.removeEventListener('keydown', resetInactivity);
      document.removeEventListener('touchstart', resetInactivity);
      clearInactivity();
    };
  }, [isEnabled, config.autoLockTimeout, lock, isLocked]);

  return { isLocked, isEnabled, config, lock, unlock, refreshConfig };
}
