'use client';

// AppLockGate — wraps the entire app and shows a lock screen when the app
// is locked.
//
// Behavior:
//  - If app lock is disabled OR not currently locked → render `children`.
//  - If locked → render a full-screen overlay (z-[200]) with:
//      * App logo + name + "Masukkan PIN untuk membuka"
//      * BiometricButton (only if WebAuthn is available AND a credential is
//        enrolled — auto-fires once when the lock screen appears)
//      * PinPad (always shown as the fallback)
//
// All PIN verification, biometric authentication, and rate-limiting are
// delegated to the lib helpers created by APPLOCK-LIB:
//   - verifyPin            from @/lib/app-lock/pin-hash
//   - authenticateBiometric, isBiometricAvailable from @/lib/app-lock/webauthn
//   - recordFailedAttempt, recordSuccessfulAttempt, getCurrentLockout
//                         from @/lib/app-lock/rate-limit
//   - getAppLockConfig     from @/lib/app-lock/storage
//
// The lock/unlock state itself lives in the `useAppLock` hook (also from
// APPLOCK-LIB), which exposes `{ isLocked, isEnabled, unlock }`.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppLock } from '@/hooks/use-app-lock';
import { PinPad } from './PinPad';
import { BiometricButton } from './BiometricButton';
import { verifyPin } from '@/lib/app-lock/pin-hash';
import {
  authenticateBiometric,
  isBiometricAvailable,
} from '@/lib/app-lock/webauthn';
import {
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getCurrentLockout,
} from '@/lib/app-lock/rate-limit';
import { getAppLockConfig } from '@/lib/app-lock/storage';
import { Sprout } from 'lucide-react';

export function AppLockGate({ children }: { children: ReactNode }) {
  const { isLocked, isEnabled, unlock } = useAppLock();
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [lockout, setLockout] = useState(getCurrentLockout());

  // Read config once per render. Storage is sync (localStorage) so this is
  // cheap. We re-read on every render to pick up changes from settings
  // (e.g. user enabled/disabled biometric) without needing a re-mount.
  const config = getAppLockConfig();

  // ── Actions ─────────────────────────────────────────────────────────────
  const tryBiometric = useCallback(async (): Promise<boolean> => {
    if (!config.webauthnCredentialId) return false;
    setVerifying(true);
    setError('');
    const success = await authenticateBiometric(config.webauthnCredentialId);
    setVerifying(false);
    if (success) {
      recordSuccessfulAttempt();
      unlock();
    }
    // On failure / cancel, do nothing — user falls through to PIN pad.
    // No error message: cancelling biometric is normal user behavior.
    return success;
  }, [config.webauthnCredentialId, unlock]);

  const handlePinSubmit = useCallback(
    async (pin: string): Promise<boolean> => {
      if (lockout.locked) return false;
      setVerifying(true);
      setError('');

      const correct = await verifyPin(
        pin,
        config.pinHash!,
        config.pinSalt!,
        config.pinIterations,
      );
      setVerifying(false);

      if (correct) {
        recordSuccessfulAttempt();
        setLockout({ locked: false, remainingMs: 0 });
        unlock();
        return true;
      }

      const result = recordFailedAttempt();
      setLockout(result);
      if (result.locked) {
        const secs = Math.ceil(result.remainingMs / 1000);
        setError(`Terlalu banyak percobaan. Coba lagi dalam ${secs}s`);
      } else {
        setError('PIN salah');
      }
      return false;
    },
    [config.pinHash, config.pinSalt, config.pinIterations, lockout.locked, unlock],
  );

  // ── Effects ─────────────────────────────────────────────────────────────
  // Check biometric availability on mount when locked.
  useEffect(() => {
    if (!isLocked) return;
    let cancelled = false;
    isBiometricAvailable().then((avail) => {
      if (!cancelled) setBiometricAvailable(avail);
    });
    return () => {
      cancelled = true;
    };
  }, [isLocked]);

  // Auto-fire biometric when lock screen shows (if available + enrolled +
  // not currently locked out). This matches iOS/Android pattern where the
  // OS prompts biometric immediately when an app comes to the foreground.
  const tryBiometricFiredRef = useRef(false);
  useEffect(() => {
    if (!isLocked) {
      tryBiometricFiredRef.current = false;
      return;
    }
    if (!biometricAvailable) return;
    if (!config.webauthnCredentialId) return;
    if (lockout.locked) return;
    if (tryBiometricFiredRef.current) return;
    tryBiometricFiredRef.current = true;
    void tryBiometric();
    // We intentionally fire biometric only once per lock-screen appearance
    // (guarded by `tryBiometricFiredRef`) — re-firing on every dependency
    // change would spam the user with prompts. `tryBiometric`, `config`, and
    // `lockout` are intentionally omitted from the dep array.
  }, [isLocked, biometricAvailable, tryBiometric]);

  // Poll lockout state so the countdown in PinPad can release when expired.
  useEffect(() => {
    if (!isLocked) return;
    if (!lockout.locked) return;
    const id = window.setInterval(() => {
      const next = getCurrentLockout();
      setLockout(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLocked, lockout.locked]);

  // If app lock is disabled or not locked → render children unchanged.
  if (!isEnabled || !isLocked) return <>{children}</>;

  // Lock screen
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background px-4">
      {/* App logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sprout className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Rutina</h1>
        <p className="text-sm text-muted-foreground">Masukkan PIN untuk membuka</p>
      </div>

      {/* Biometric button (if available + enrolled) */}
      {biometricAvailable && config.webauthnCredentialId ? (
        <div className="mb-6">
          <BiometricButton
            onAuthenticate={tryBiometric}
            disabled={verifying || lockout.locked}
          />
        </div>
      ) : null}

      {/* PIN pad */}
      <PinPad
        onSubmit={handlePinSubmit}
        title="Masukkan PIN"
        error={error}
        lockedUntil={lockout.locked ? Date.now() + lockout.remainingMs : undefined}
      />
    </div>
  );
}
