import {
  PAIRING_ALG,
  PAIRING_APP_PEPPER,
  PAIRING_PIN_LENGTH,
  PAIRING_VERSION,
  PBKDF2_ITERATIONS
} from './constants';
import { PairingError, type PairingEnvelope, type PairingPayload } from './types';

const subtle = globalThis.crypto.subtle;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Copy a view into a standalone ArrayBuffer. Web Crypto's `BufferSource`
 * expects an `ArrayBuffer`-backed view; this sidesteps the `Uint8Array` generic
 * buffer typing introduced in recent TypeScript lib definitions. The buffers
 * involved are tiny, so the copy cost is irrelevant.
 */
function ab(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

/** Generate a zero-padded numeric PIN using a CSPRNG. */
export function randomPin(): string {
  const max = 10 ** PAIRING_PIN_LENGTH;
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return String(buf[0] % max).padStart(PAIRING_PIN_LENGTH, '0');
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Derive a 256-bit AES-GCM key from the PIN and a per-QR salt via PBKDF2. */
async function deriveAesKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await subtle.importKey('raw', ab(textEncoder.encode(pin)), 'PBKDF2', false, [
    'deriveKey'
  ]);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: ab(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** HMAC key derived from the (non-secret) app pepper for envelope integrity. */
async function pepperHmacKey(): Promise<CryptoKey> {
  return subtle.importKey(
    'raw',
    ab(textEncoder.encode(PAIRING_APP_PEPPER)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Canonical string the HMAC signs. Order is fixed and must never change for v1. */
function signingInput(env: Omit<PairingEnvelope, 'sig'>): Uint8Array {
  return textEncoder.encode([env.v, env.alg, env.salt, env.iv, env.ct, env.exp].join('.'));
}

/**
 * Encrypt (AES-256-GCM) and sign a payload into a transportable envelope. The
 * PIN never leaves the generating device inside the QR.
 */
export async function encryptPayload(payload: PairingPayload, pin: string): Promise<PairingEnvelope> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(pin, salt);

  const plain = textEncoder.encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: ab(iv) }, key, ab(plain)));

  const unsigned: Omit<PairingEnvelope, 'sig'> = {
    v: PAIRING_VERSION,
    alg: PAIRING_ALG,
    salt: bytesToBase64url(salt),
    iv: bytesToBase64url(iv),
    ct: bytesToBase64url(cipher),
    exp: new Date(payload.expiresAt).getTime()
  };
  const hmacKey = await pepperHmacKey();
  const sig = new Uint8Array(await subtle.sign('HMAC', hmacKey, ab(signingInput(unsigned))));
  return { ...unsigned, sig: bytesToBase64url(sig) };
}

/**
 * Verify the pepper HMAC. This detects transit tampering and most wrong-app
 * data before we spend effort (or a PIN) on decryption.
 */
export async function verifyEnvelope(env: PairingEnvelope): Promise<void> {
  const hmacKey = await pepperHmacKey();
  const ok = await subtle.verify(
    'HMAC',
    hmacKey,
    ab(base64urlToBytes(env.sig)),
    ab(signingInput(env))
  );
  if (!ok) throw new PairingError('bad_signature', "Couldn't verify this pairing code.");
}

/** Decrypt an envelope back into the payload using the PIN. */
export async function decryptPayload(env: PairingEnvelope, pin: string): Promise<PairingPayload> {
  const key = await deriveAesKey(pin, base64urlToBytes(env.salt));
  let plain: Uint8Array;
  try {
    const buffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: ab(base64urlToBytes(env.iv)) },
      key,
      ab(base64urlToBytes(env.ct))
    );
    plain = new Uint8Array(buffer);
  } catch {
    // GCM auth-tag mismatch: almost always a wrong PIN (or corrupted ciphertext).
    throw new PairingError('wrong_pin', 'Incorrect pairing code. Check the 6 digits and try again.');
  }
  try {
    return JSON.parse(textDecoder.decode(plain)) as PairingPayload;
  } catch {
    throw new PairingError('invalid_payload', 'This pairing code is not readable.');
  }
}
