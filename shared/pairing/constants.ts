/**
 * Device-pairing protocol constants. The pairing flow lets a user move their
 * Turso credentials from one device to another by scanning a short-lived,
 * encrypted QR code instead of typing a long URL + JWT by hand.
 *
 * There is no backend: security rests on (1) physical proximity, (2) a short
 * time-to-live, and (3) AES-GCM encryption keyed by a 6-digit PIN shown next to
 * the QR (never inside it).
 */

/** Prefix that marks a Money Sheets pairing string. Also acts as a namespace. */
export const PAIRING_QR_PREFIX = 'msp:v1:';

/** `type` field stored inside the decrypted payload. */
export const PAIRING_TYPE = 'money-sheets-pair';

/** Payload/envelope schema version. Bump on breaking changes (msp:v2:...). */
export const PAIRING_VERSION = 1;

/** How long a generated QR stays valid. */
export const PAIRING_TTL_MS = 5 * 60 * 1000;

/** Tolerance for clock differences between the two devices. */
export const PAIRING_CLOCK_SKEW_MS = 30 * 1000;

/** Symmetric cipher identifier embedded in the envelope. */
export const PAIRING_ALG = 'A256GCM';

/** PBKDF2 work factor for deriving the AES key from the PIN. */
export const PBKDF2_ITERATIONS = 100_000;

/** Number of digits in the out-of-band pairing PIN. */
export const PAIRING_PIN_LENGTH = 6;

/**
 * Namespacing pepper for the envelope HMAC. This is NOT a secret — it ships in
 * the client bundle. It only lets us cheaply reject data that was not produced
 * by Money Sheets and detect transit tampering before attempting decryption.
 * Real confidentiality comes from the PIN-derived AES key.
 */
export const PAIRING_APP_PEPPER = 'money-sheets/pairing/v1/4f8a2c9d';

/**
 * Soft ceiling for the encoded QR string. Beyond this a phone camera struggles
 * to scan the dense QR, so we steer the user to Advanced manual setup instead.
 */
export const PAIRING_MAX_QR_BYTES = 1800;
