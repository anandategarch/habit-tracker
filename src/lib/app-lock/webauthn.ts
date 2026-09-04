// WebAuthn biometric registration + authentication.
//
// This is a LOCAL biometric gate for the app-lock feature, not a true
// authentication scheme: we do not verify the challenge server-side because
// there is no server involved. The flow exists solely to ensure the user
// physically interacts with a platform authenticator (fingerprint, face, etc.)
// before the app unlocks.
//
// Target: Android Chrome PWA. Uses platform authenticators only
// (`authenticatorAttachment: 'platform'`, `userVerification: 'required'`).
//
// All public functions are wrapped in try/catch and return `false`/`null` on
// any error so the UI can gracefully fall back to PIN entry.

// ---- base64url helpers ------------------------------------------------------

function base64ToUint8Array(b64: string): Uint8Array {
  // WebAuthn stores credential IDs as base64url. Normalize to base64 then decode.
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary =
    typeof atob === 'function'
      ? atob(padded)
      : '';
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Cast helper: TS 5.7+ lib types `BufferSource` as `ArrayBufferView<ArrayBuffer>`,
// but `Uint8Array` infers as `Uint8Array<ArrayBufferLike>` which is not directly
// assignable. We never use `SharedArrayBuffer`, so the runtime backing is
// always an `ArrayBuffer` and the cast is sound.
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : binary;
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomChallenge(byteLength: number = 32): Uint8Array {
  const bytes = new Uint8Array(new ArrayBuffer(byteLength));
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return bytes;
}

// ---- Environment checks ----------------------------------------------------

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function hasPublicKeyCredential(): boolean {
  return isBrowser() && 'PublicKeyCredential' in window;
}

// Check if a biometric (platform, user-verifying) authenticator is available.
export async function isBiometricAvailable(): Promise<boolean> {
  if (!hasPublicKeyCredential()) return false;
  try {
    const pkc = window.PublicKeyCredential;
    if (typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    return await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Register a new biometric credential. Returns the base64url credential ID or
// null on failure / cancellation.
export async function registerBiometric(): Promise<string | null> {
  if (!isBrowser() || typeof navigator === 'undefined' || !navigator.credentials?.create) {
    return null;
  }
  try {
    const challenge = randomChallenge(32);
    const userId = randomChallenge(16);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: asBufferSource(challenge),
      rp: {
        id: window.location.hostname,
        name: 'Rutina',
      },
      user: {
        id: asBufferSource(userId),
        name: 'user',
        displayName: 'Rutina User',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256 fallback
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
        requireResidentKey: false,
      },
      timeout: 60_000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    if (!credential) return null;

    const rawId = new Uint8Array(credential.rawId);
    return uint8ArrayToBase64Url(rawId);
  } catch {
    return null;
  }
}

// Authenticate using a previously registered biometric credential.
// Returns `true` on success, `false` on failure / cancellation / error.
export async function authenticateBiometric(credentialId: string): Promise<boolean> {
  if (!isBrowser() || typeof navigator === 'undefined' || !navigator.credentials?.get) {
    return false;
  }
  if (!credentialId) return false;

  try {
    const challenge = randomChallenge(32);
    const allowCredentials: PublicKeyCredentialDescriptor[] = [
      {
        type: 'public-key',
        id: asBufferSource(base64ToUint8Array(credentialId)),
      },
    ];

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: asBufferSource(challenge),
      timeout: 60_000,
      userVerification: 'required',
      allowCredentials,
    };

    const assertion = await navigator.credentials.get({ publicKey });
    return assertion !== null && assertion !== undefined;
  } catch {
    return false;
  }
}
