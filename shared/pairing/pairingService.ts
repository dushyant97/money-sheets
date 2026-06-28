import { isValidTursoUrl } from '../storage/prefs';
import type { TursoConfig } from '../storage/types';
import {
  PAIRING_ALG,
  PAIRING_CLOCK_SKEW_MS,
  PAIRING_MAX_QR_BYTES,
  PAIRING_QR_PREFIX,
  PAIRING_TYPE,
  PAIRING_VERSION
} from './constants';
import { decryptPayload, encryptPayload, randomPin, verifyEnvelope } from './crypto';
import { buildPairingPayload } from './payload';
import { PairingError, type PairingEnvelope, type PairingPayload } from './types';

const textEncoder = new TextEncoder();

/**
 * Serialize an envelope into the scannable `msp:v1:<salt>.<iv>.<exp>.<sig>.<ct>`
 * string. The five fields are already base64url, and `.` is outside that
 * alphabet, so a single join avoids the ~34% bloat of re-encoding JSON. `v` and
 * `alg` are implied by the `v1` prefix.
 */
export function encodeQrString(envelope: PairingEnvelope): string {
  return (
    PAIRING_QR_PREFIX +
    [envelope.salt, envelope.iv, envelope.exp, envelope.sig, envelope.ct].join('.')
  );
}

/** Byte length of an encoded QR string, used to gate against unscannable QRs. */
export function qrByteLength(qrString: string): number {
  return textEncoder.encode(qrString).length;
}

/** Parse a scanned string back into an envelope, rejecting foreign/old formats. */
export function decodeQrString(raw: string): PairingEnvelope {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(PAIRING_QR_PREFIX)) {
    throw new PairingError('wrong_app', 'This is not a Money Sheets pairing code.');
  }
  const parts = trimmed.slice(PAIRING_QR_PREFIX.length).split('.');
  if (parts.length !== 5) {
    throw new PairingError('invalid_format', 'This pairing code is damaged or incomplete.');
  }
  const [salt, iv, expRaw, sig, ct] = parts;
  const exp = Number(expRaw);
  if (!salt || !iv || !sig || !ct || !Number.isFinite(exp)) {
    throw new PairingError('invalid_format', 'This pairing code is damaged or incomplete.');
  }
  return { v: PAIRING_VERSION, alg: PAIRING_ALG, salt, iv, exp, sig, ct };
}

/** Throw `expired` when the timestamp is in the past (allowing for clock skew). */
export function validateExpiration(expiresAtMs: number, now: number = Date.now()): void {
  if (!Number.isFinite(expiresAtMs) || now > expiresAtMs + PAIRING_CLOCK_SKEW_MS) {
    throw new PairingError('expired', 'This pairing code has expired. Generate a new one.');
  }
}

/** Validate the decrypted payload's shape and embedded credentials. */
export function validatePayload(payload: PairingPayload, now: number = Date.now()): void {
  if (payload?.type !== PAIRING_TYPE) {
    throw new PairingError('wrong_app', 'This is not a Money Sheets pairing code.');
  }
  if (payload.version !== PAIRING_VERSION) {
    throw new PairingError(
      'unsupported_version',
      'This pairing code was made by a different app version. Update both devices.'
    );
  }
  if (!isValidTursoUrl(payload.databaseUrl) || payload.token.trim().length === 0) {
    throw new PairingError('invalid_payload', 'This pairing code is missing valid sync details.');
  }
  validateExpiration(new Date(payload.expiresAt).getTime(), now);
}

/**
 * Build a fresh pairing QR for the active credentials. Returns the PIN to show
 * separately and the expiry the UI counts down against. Throws `too_large` when
 * the credentials would produce an unscannable QR.
 */
export async function generatePairingQr(options: {
  credentials: TursoConfig;
  deviceName: string;
  pin?: string;
  now?: number;
}): Promise<{ qrString: string; pin: string; payload: PairingPayload; expiresAt: string }> {
  const pin = options.pin ?? randomPin();
  const payload = buildPairingPayload(options.credentials, options.deviceName, options.now);
  const envelope = await encryptPayload(payload, pin);
  const qrString = encodeQrString(envelope);
  if (qrByteLength(qrString) > PAIRING_MAX_QR_BYTES) {
    throw new PairingError(
      'too_large',
      'These credentials are too large for a QR code. Use Advanced setup on the other device.'
    );
  }
  return { qrString, pin, payload, expiresAt: payload.expiresAt };
}

/**
 * Full receive pipeline: verify integrity, check expiry, decrypt with the PIN
 * and validate the payload. The envelope should already come from
 * {@link decodeQrString} so format errors surface before the PIN prompt.
 */
export async function finishPairing(
  envelope: PairingEnvelope,
  pin: string,
  now: number = Date.now()
): Promise<PairingPayload> {
  await verifyEnvelope(envelope);
  validateExpiration(envelope.exp, now);
  const payload = await decryptPayload(envelope, pin);
  validatePayload(payload, now);
  return payload;
}

/** Convenience one-shot: decode a raw scan string and finish pairing with a PIN. */
export async function parseAndDecrypt(
  raw: string,
  pin: string,
  now: number = Date.now()
): Promise<PairingPayload> {
  return finishPairing(decodeQrString(raw), pin, now);
}

/** Credentials a successful pairing yields, ready for `applyStorageSettings`. */
export function credentialsFromPayload(payload: PairingPayload): TursoConfig {
  return { url: payload.databaseUrl, authToken: payload.token };
}
