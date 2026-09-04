// Rate limiting for failed PIN attempts.
//
// Progressive lockout schedule:
//   - After 5 failed attempts   → 30 second lockout
//   - After 10 failed attempts  → 5 minute lockout
//   - After 15 failed attempts  → 1 hour lockout
//
// Failed-attempt counter resets to 0 on a successful unlock. Lockout state is
// persisted in localStorage (via `storage.ts`) so it survives app reloads and
// backgrounding.

import {
  getLockoutState,
  setLockoutState,
} from './storage';

export interface LockoutInfo {
  locked: boolean;
  remainingMs: number;
}

interface Threshold {
  attempts: number;
  lockoutMs: number;
}

const THRESHOLDS: Threshold[] = [
  { attempts: 5, lockoutMs: 30_000 }, // 30 seconds
  { attempts: 10, lockoutMs: 300_000 }, // 5 minutes
  { attempts: 15, lockoutMs: 3_600_000 }, // 1 hour
];

// Pick the longest lockout that the current attempt count qualifies for.
function lockoutForAttempts(attempts: number): number {
  let ms = 0;
  for (const t of THRESHOLDS) {
    if (attempts >= t.attempts) ms = Math.max(ms, t.lockoutMs);
  }
  return ms;
}

export function getCurrentLockout(): LockoutInfo {
  const state = getLockoutState();
  if (state.nextAllowedAt === null) {
    return { locked: false, remainingMs: 0 };
  }
  const remaining = state.nextAllowedAt - Date.now();
  if (remaining <= 0) {
    // Lockout expired — clear it but keep the attempt counter so the next
    // failure can re-trigger a longer lockout if attempts keep climbing.
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: remaining };
}

export function recordFailedAttempt(): LockoutInfo {
  const state = getLockoutState();

  // If a lockout is currently active and not yet expired, do not advance the
  // counter — the user should not be punished for UI attempts while locked.
  if (state.nextAllowedAt !== null && state.nextAllowedAt > Date.now()) {
    const remaining = state.nextAllowedAt - Date.now();
    return { locked: true, remainingMs: remaining };
  }

  const attempts = state.attempts + 1;
  const lockoutMs = lockoutForAttempts(attempts);
  const nextAllowedAt = lockoutMs > 0 ? Date.now() + lockoutMs : null;

  setLockoutState({ attempts, nextAllowedAt });

  return {
    locked: nextAllowedAt !== null,
    remainingMs: lockoutMs,
  };
}

export function recordSuccessfulAttempt(): void {
  setLockoutState({ attempts: 0, nextAllowedAt: null });
}
