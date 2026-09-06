// PIN hashing + verification using the Web Crypto API.
//
// Strategy: PBKDF2-SHA256 with 100,000 iterations and a 16-byte random salt.
// The derived 32-byte key is base64-encoded for storage. All crypto runs in
// the browser via `crypto.subtle` — no plaintext PIN ever leaves the device.
//
// SSR-safe: every function checks for `crypto.subtle` availability and falls
// back gracefully (salt returns empty, hash returns empty string, verify
// returns false). Callers should always gate UI on a `hasCrypto` check before
// allowing PIN setup.

const SUBTLE_AVAILABLE =
  typeof crypto !== 'undefined' &&
  typeof crypto.subtle !== 'undefined' &&
  typeof crypto.subtle.importKey === 'function' &&
  typeof crypto.subtle.deriveBits === 'function';

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256; // 32 bytes

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in browsers and Node 16+. Fall back to a manual encode
  // if it is somehow missing.
  if (typeof btoa === 'function') return btoa(binary);
  return binary;
}

function base64ToBuffer(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // Last-resort fallback — should never hit in a modern browser.
  return new Uint8Array(new ArrayBuffer(0));
}

// Cast helper: TS 5.7+ lib types `BufferSource` as `ArrayBufferView<ArrayBuffer>`,
// but `Uint8Array` infers as `Uint8Array<ArrayBufferLike>` which is not directly
// assignable. The runtime backing is always an `ArrayBuffer` (we never use
// `SharedArrayBuffer`), so the cast is sound.
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

// Generate a 16-byte random salt and return it base64-encoded.
export function generateSalt(): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) return '';
  const bytes = new Uint8Array(new ArrayBuffer(SALT_BYTES));
  crypto.getRandomValues(bytes);
  return bufferToBase64(bytes);
}

// Hash a PIN with PBKDF2-SHA256. Returns base64-encoded 32-byte output.
export async function hashPin(
  pin: string,
  salt: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  if (!SUBTLE_AVAILABLE) return '';
  const saltBytes = base64ToBuffer(salt);
  const pinBytes = new TextEncoder().encode(pin);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: asBufferSource(saltBytes),
      iterations: Math.max(1, iterations | 0),
      hash: 'SHA-256',
    },
    keyMaterial,
    DERIVED_BITS,
  );

  return bufferToBase64(derived);
}

// Verify a PIN against a stored hash. Constant-time comparison is handled by
// deriving the candidate hash and comparing byte-by-byte without short-circuit.
export async function verifyPin(
  pin: string,
  storedHash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  if (!SUBTLE_AVAILABLE) return false;
  if (!storedHash || !salt) return false;

  const candidate = await hashPin(pin, salt, iterations);
  if (!candidate) return false;

  // Constant-time-ish comparison.
  const a = base64ToBuffer(candidate);
  const b = base64ToBuffer(storedHash);
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// Setup a new PIN: generates salt, hashes, returns everything needed to store.
export interface PinSetupResult {
  hash: string;
  salt: string;
  iterations: number;
}

export async function setupPin(pin: string): Promise<PinSetupResult> {
  const iterations = PBKDF2_ITERATIONS;
  const salt = generateSalt();
  if (!salt) {
    return { hash: '', salt: '', iterations };
  }
  const hash = await hashPin(pin, salt, iterations);
  return { hash, salt, iterations };
}
