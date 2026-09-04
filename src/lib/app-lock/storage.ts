// localStorage-backed app lock state for Rutina.
//
// All keys are prefixed with `rutina_` to avoid collisions with other apps
// that might share the same origin. Values are stored as strings; base64
// is used for binary data (PIN hash, salt, WebAuthn credential ID).
//
// SSR-safe: every accessor checks `typeof window !== 'undefined'` and returns
// a sensible default when running on the server.
//
// Cross-instance sync: every mutator (`setAppLockConfig`, `clearAppLockConfig`,
// `setLockoutState`) dispatches a `rutina:app-lock-config-changed` CustomEvent
// on `window` so that every `useAppLock` hook instance (AppLockGate +
// AppLockSection) can refresh its React state without a page reload. Without
// this, enabling app lock in Settings would not activate the lock screen until
// the next reload (the gate's `useAppLock` instance had a stale `enabled`
// flag).

export const APP_LOCK_CONFIG_EVENT = 'rutina:app-lock-config-changed';

function notifyConfigChange(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(APP_LOCK_CONFIG_EVENT));
  } catch {
    // CustomEvent may be unavailable in rare environments — fail silently.
  }
}

const KEYS = {
  ENABLED: 'rutina_app_lock_enabled',
  PIN_HASH: 'rutina_pin_hash', // base64 PBKDF2 output
  PIN_SALT: 'rutina_pin_salt', // base64 16-byte salt
  PIN_ITER: 'rutina_pin_iterations', // number (100000)
  WEBAUTHN_ID: 'rutina_webauthn_credential_id', // base64 credential ID
  AUTO_LOCK: 'rutina_auto_lock_timeout', // ms (0 = immediate, 60000 = 1min, etc)
  LOCKOUT: 'rutina_lockout_state', // JSON {attempts, nextAllowedAt}
  LAST_UNLOCK: 'rutina_last_unlocked_at', // timestamp
} as const;

export interface AppLockConfig {
  enabled: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  pinIterations: number;
  webauthnCredentialId: string | null;
  autoLockTimeout: number; // 0 = immediate, 60000 = 1min, etc.
}

export interface LockoutState {
  attempts: number;
  nextAllowedAt: number | null; // epoch ms when next attempt is allowed
}

const DEFAULT_CONFIG: AppLockConfig = {
  enabled: false,
  pinHash: null,
  pinSalt: null,
  pinIterations: 100000,
  webauthnCredentialId: null,
  autoLockTimeout: 0,
};

const DEFAULT_LOCKOUT: LockoutState = {
  attempts: 0,
  nextAllowedAt: null,
};

function readString(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode, quota). Fail silently — the
    // app-lock feature is best-effort and should not crash the UI.
  }
}

function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

export function getAppLockConfig(): AppLockConfig {
  const enabled = readString(KEYS.ENABLED) === 'true';
  const pinHash = readString(KEYS.PIN_HASH);
  const pinSalt = readString(KEYS.PIN_SALT);
  const pinIterRaw = readString(KEYS.PIN_ITER);
  const webauthnId = readString(KEYS.WEBAUTHN_ID);
  const autoLockRaw = readString(KEYS.AUTO_LOCK);

  const pinIterations = pinIterRaw ? parseInt(pinIterRaw, 10) : DEFAULT_CONFIG.pinIterations;
  const autoLockTimeout = autoLockRaw ? parseInt(autoLockRaw, 10) : DEFAULT_CONFIG.autoLockTimeout;

  return {
    enabled,
    pinHash: pinHash ?? null,
    pinSalt: pinSalt ?? null,
    pinIterations: Number.isFinite(pinIterations) ? pinIterations : DEFAULT_CONFIG.pinIterations,
    webauthnCredentialId: webauthnId ?? null,
    autoLockTimeout: Number.isFinite(autoLockTimeout) ? autoLockTimeout : DEFAULT_CONFIG.autoLockTimeout,
  };
}

export function setAppLockConfig(config: Partial<AppLockConfig>): void {
  let changed = false;
  if (config.enabled !== undefined) {
    writeString(KEYS.ENABLED, config.enabled ? 'true' : 'false');
    changed = true;
  }
  if (config.pinHash !== undefined) {
    if (config.pinHash === null) {
      removeKey(KEYS.PIN_HASH);
    } else {
      writeString(KEYS.PIN_HASH, config.pinHash);
    }
    changed = true;
  }
  if (config.pinSalt !== undefined) {
    if (config.pinSalt === null) {
      removeKey(KEYS.PIN_SALT);
    } else {
      writeString(KEYS.PIN_SALT, config.pinSalt);
    }
    changed = true;
  }
  if (config.pinIterations !== undefined) {
    writeString(KEYS.PIN_ITER, String(config.pinIterations));
    changed = true;
  }
  if (config.webauthnCredentialId !== undefined) {
    if (config.webauthnCredentialId === null) {
      removeKey(KEYS.WEBAUTHN_ID);
    } else {
      writeString(KEYS.WEBAUTHN_ID, config.webauthnCredentialId);
    }
    changed = true;
  }
  if (config.autoLockTimeout !== undefined) {
    writeString(KEYS.AUTO_LOCK, String(config.autoLockTimeout));
    changed = true;
  }
  if (changed) notifyConfigChange();
}

export function clearAppLockConfig(): void {
  removeKey(KEYS.ENABLED);
  removeKey(KEYS.PIN_HASH);
  removeKey(KEYS.PIN_SALT);
  removeKey(KEYS.PIN_ITER);
  removeKey(KEYS.WEBAUTHN_ID);
  removeKey(KEYS.AUTO_LOCK);
  removeKey(KEYS.LOCKOUT);
  removeKey(KEYS.LAST_UNLOCK);
  notifyConfigChange();
}

export function getLockoutState(): LockoutState {
  const raw = readString(KEYS.LOCKOUT);
  if (!raw) return { ...DEFAULT_LOCKOUT };
  try {
    const parsed = JSON.parse(raw) as Partial<LockoutState>;
    const attempts = typeof parsed.attempts === 'number' ? parsed.attempts : 0;
    const nextAllowedAt =
      typeof parsed.nextAllowedAt === 'number' ? parsed.nextAllowedAt : null;
    return { attempts, nextAllowedAt };
  } catch {
    return { ...DEFAULT_LOCKOUT };
  }
}

export function setLockoutState(state: LockoutState): void {
  writeString(KEYS.LOCKOUT, JSON.stringify(state));
}

export function isLockedOut(): boolean {
  const { nextAllowedAt } = getLockoutState();
  if (nextAllowedAt === null) return false;
  return Date.now() < nextAllowedAt;
}

export function getLockoutRemainingMs(): number {
  const { nextAllowedAt } = getLockoutState();
  if (nextAllowedAt === null) return 0;
  return Math.max(0, nextAllowedAt - Date.now());
}

export function setLastUnlockedAt(timestamp: number = Date.now()): void {
  writeString(KEYS.LAST_UNLOCK, String(timestamp));
}

export function getLastUnlockedAt(): number {
  const raw = readString(KEYS.LAST_UNLOCK);
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const APP_LOCK_STORAGE_KEYS = KEYS;
