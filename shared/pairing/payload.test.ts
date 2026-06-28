import { describe, expect, it } from 'vitest';
import { PAIRING_TTL_MS, PAIRING_TYPE, PAIRING_VERSION } from './constants';
import { buildPairingPayload, dbNameFromUrl } from './payload';

describe('buildPairingPayload', () => {
  it('captures trimmed credentials, device name and a TTL window', () => {
    const now = Date.parse('2026-06-28T12:00:00.000Z');
    const payload = buildPairingPayload(
      { url: '  libsql://db.turso.io  ', authToken: '  token-123  ' },
      'iPhone PWA',
      now
    );
    expect(payload).toEqual({
      type: PAIRING_TYPE,
      version: PAIRING_VERSION,
      databaseUrl: 'libsql://db.turso.io',
      token: 'token-123',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PAIRING_TTL_MS).toISOString(),
      deviceName: 'iPhone PWA'
    });
  });
});

describe('dbNameFromUrl', () => {
  it('extracts the database name and drops the org suffix', () => {
    expect(dbNameFromUrl('libsql://money-sheets-prod-acme.turso.io')).toBe('money-sheets-prod');
  });

  it('accepts https URLs', () => {
    expect(dbNameFromUrl('https://my-db-org.turso.io')).toBe('my-db');
  });

  it('falls back gracefully for empty or malformed input', () => {
    expect(dbNameFromUrl('')).toBe('Unknown database');
    expect(dbNameFromUrl('not a url')).toBe('not a url');
  });
});
