import { describe, expect, it } from 'vitest';
import { PAIRING_PIN_LENGTH } from './constants';
import {
  base64urlToBytes,
  bytesToBase64url,
  decryptPayload,
  encryptPayload,
  randomPin,
  verifyEnvelope
} from './crypto';
import { buildPairingPayload } from './payload';
import { PairingError } from './types';

const credentials = {
  url: 'libsql://money-sheets-prod-acme.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.payload.signature'
};

function makePayload() {
  return buildPairingPayload(credentials, 'Chrome Desktop', Date.parse('2026-06-28T12:00:00.000Z'));
}

describe('base64url', () => {
  it('round-trips arbitrary bytes without padding chars', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 63, 62]);
    const encoded = bytesToBase64url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(base64urlToBytes(encoded))).toEqual(Array.from(bytes));
  });
});

describe('randomPin', () => {
  it('returns a zero-padded numeric PIN of the configured length', () => {
    for (let i = 0; i < 50; i += 1) {
      const pin = randomPin();
      expect(pin).toHaveLength(PAIRING_PIN_LENGTH);
      expect(pin).toMatch(/^\d+$/);
    }
  });
});

describe('encrypt/decrypt round-trip', () => {
  it('recovers the original payload with the correct PIN', async () => {
    const payload = makePayload();
    const env = await encryptPayload(payload, '482917');
    await verifyEnvelope(env);
    const decoded = await decryptPayload(env, '482917');
    expect(decoded).toEqual(payload);
  });

  it('rejects a wrong PIN with wrong_pin', async () => {
    const env = await encryptPayload(makePayload(), '482917');
    await expect(decryptPayload(env, '000000')).rejects.toMatchObject({
      code: 'wrong_pin'
    } satisfies Partial<PairingError>);
  });
});

describe('verifyEnvelope', () => {
  it('passes for an untampered envelope', async () => {
    const env = await encryptPayload(makePayload(), '482917');
    await expect(verifyEnvelope(env)).resolves.toBeUndefined();
  });

  it('throws bad_signature when the ciphertext is tampered', async () => {
    const env = await encryptPayload(makePayload(), '482917');
    const bytes = base64urlToBytes(env.ct);
    bytes[0] ^= 0xff;
    await expect(verifyEnvelope({ ...env, ct: bytesToBase64url(bytes) })).rejects.toMatchObject({
      code: 'bad_signature'
    });
  });

  it('throws bad_signature when the signature is tampered', async () => {
    const env = await encryptPayload(makePayload(), '482917');
    const bytes = base64urlToBytes(env.sig);
    bytes[0] ^= 0xff;
    await expect(verifyEnvelope({ ...env, sig: bytesToBase64url(bytes) })).rejects.toMatchObject({
      code: 'bad_signature'
    });
  });
});
