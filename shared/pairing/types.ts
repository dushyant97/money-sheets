import type { PAIRING_TYPE } from './constants';

/**
 * Plaintext that travels inside the encrypted QR. Mirrors the shape a user
 * would otherwise type by hand, plus timestamps for expiry checks.
 */
export type PairingPayload = {
  type: typeof PAIRING_TYPE;
  version: number;
  databaseUrl: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  /** Human label of the device that generated the QR, e.g. "Chrome Desktop". */
  deviceName: string;
};

/**
 * The encrypted, signed container that is base64url-encoded into the QR. All
 * binary fields are base64url strings.
 */
export type PairingEnvelope = {
  /** Schema version. */
  v: number;
  /** Cipher identifier (always `A256GCM` for v1). */
  alg: string;
  /** PBKDF2 salt used to derive the AES key from the PIN. */
  salt: string;
  /** AES-GCM nonce. */
  iv: string;
  /** AES-GCM ciphertext (includes the auth tag). */
  ct: string;
  /** Expiry in epoch milliseconds, duplicated here for a pre-decrypt fast reject. */
  exp: number;
  /** HMAC-SHA256 over the envelope fields, keyed by the app pepper. */
  sig: string;
};

export type PairingErrorCode =
  | 'invalid_format'
  | 'wrong_app'
  | 'unsupported_version'
  | 'expired'
  | 'bad_signature'
  | 'wrong_pin'
  | 'invalid_payload'
  | 'too_large';

/** Typed error so the UI can map each failure to friendly copy. */
export class PairingError extends Error {
  code: PairingErrorCode;

  constructor(code: PairingErrorCode, message: string) {
    super(message);
    this.name = 'PairingError';
    this.code = code;
  }
}
