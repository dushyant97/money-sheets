import { describe, expect, it } from 'vitest';
import { PAIRING_MAX_QR_BYTES, PAIRING_QR_PREFIX } from './constants';
import {
  credentialsFromPayload,
  decodeQrString,
  finishPairing,
  generatePairingQr,
  parseAndDecrypt,
  qrByteLength,
  validateExpiration,
  validatePayload
} from './pairingService';
import { buildPairingPayload } from './payload';

const credentials = {
  url: 'libsql://money-sheets-prod-acme.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSJ9.short.sig'
};
const T0 = Date.parse('2026-06-28T12:00:00.000Z');

describe('generate + scan round-trip', () => {
  it('pairs end to end with the matching PIN', async () => {
    const { qrString, pin } = await generatePairingQr({
      credentials,
      deviceName: 'Chrome Desktop',
      pin: '482917',
      now: T0
    });
    expect(qrString.startsWith(PAIRING_QR_PREFIX)).toBe(true);

    const payload = await parseAndDecrypt(qrString, pin, T0 + 1000);
    expect(credentialsFromPayload(payload)).toEqual(credentials);
    expect(payload.deviceName).toBe('Chrome Desktop');
  });

  it('generates a random PIN when none is supplied', async () => {
    const { pin } = await generatePairingQr({ credentials, deviceName: 'Phone', now: T0 });
    expect(pin).toMatch(/^\d{6}$/);
  });
});

describe('QR size budget', () => {
  it('keeps a realistic long-token QR within the scannable budget', async () => {
    const longToken = `eyJhbGciOiJFZERTQSJ9.${'a'.repeat(560)}.${'b'.repeat(86)}`;
    const { qrString } = await generatePairingQr({
      credentials: { url: 'libsql://money-sheets-prod-acme.turso.io', authToken: longToken },
      deviceName: 'Chrome on Windows',
      now: T0
    });
    expect(qrByteLength(qrString)).toBeLessThanOrEqual(PAIRING_MAX_QR_BYTES);
  });

  it('rejects a token too large to fit in a QR', async () => {
    await expect(
      generatePairingQr({
        credentials: { url: 'libsql://db.turso.io', authToken: 'x'.repeat(4000) },
        deviceName: 'Chrome',
        now: T0
      })
    ).rejects.toMatchObject({ code: 'too_large' });
  });
});

describe('decodeQrString', () => {
  it('rejects strings without the Money Sheets prefix', () => {
    expect(() => decodeQrString('https://example.com')).toThrowError(/not a Money Sheets/i);
  });

  it('rejects damaged base64 payloads', () => {
    expect(() => decodeQrString(`${PAIRING_QR_PREFIX}@@@not-base64@@@`)).toThrow();
  });
});

describe('expiration', () => {
  it('rejects a code scanned after it expired', async () => {
    const { qrString, pin } = await generatePairingQr({
      credentials,
      deviceName: 'Chrome',
      pin: '111111',
      now: T0
    });
    await expect(parseAndDecrypt(qrString, pin, T0 + 6 * 60 * 1000)).rejects.toMatchObject({
      code: 'expired'
    });
  });

  it('tolerates small clock skew', () => {
    expect(() => validateExpiration(T0, T0 + 10_000)).not.toThrow();
    expect(() => validateExpiration(T0, T0 + 60_000)).toThrow();
  });
});

describe('validatePayload', () => {
  it('rejects a payload with a bad database URL', () => {
    const payload = buildPairingPayload({ url: 'not-a-url', authToken: 'x' }, 'Dev', T0);
    expect(() => validatePayload(payload, T0)).toThrowError(/valid sync details/i);
  });
});

describe('finishPairing', () => {
  it('rejects a wrong PIN before reaching credentials', async () => {
    const { qrString } = await generatePairingQr({
      credentials,
      deviceName: 'Chrome',
      pin: '424242',
      now: T0
    });
    const envelope = decodeQrString(qrString);
    await expect(finishPairing(envelope, '000000', T0 + 1000)).rejects.toMatchObject({
      code: 'wrong_pin'
    });
  });
});
