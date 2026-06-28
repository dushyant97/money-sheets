import type { TursoConfig } from '../storage/types';
import { PAIRING_TTL_MS, PAIRING_TYPE, PAIRING_VERSION } from './constants';
import type { PairingPayload } from './types';

/** Assemble the plaintext payload from live credentials and a device label. */
export function buildPairingPayload(
  credentials: TursoConfig,
  deviceName: string,
  now: number = Date.now()
): PairingPayload {
  return {
    type: PAIRING_TYPE,
    version: PAIRING_VERSION,
    databaseUrl: credentials.url.trim(),
    token: credentials.authToken.trim(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PAIRING_TTL_MS).toISOString(),
    deviceName
  };
}

/**
 * Pull a friendly database name out of a Turso URL for display, e.g.
 * `libsql://money-sheets-prod-user.turso.io` -> `money-sheets-prod`.
 * Falls back to the raw host when the shape is unexpected.
 */
export function dbNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'Unknown database';
  try {
    const normalized = trimmed.replace(/^libsql:\/\//i, 'https://');
    const host = new URL(normalized).hostname;
    const label = host.split('.')[0] ?? host;
    // Turso appends `-<org>` to the database name; drop the trailing org segment.
    return label.replace(/-[a-z0-9]+$/i, '') || label;
  } catch {
    return trimmed;
  }
}
