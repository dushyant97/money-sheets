import {
  DEFAULT_STORAGE_PREFERENCES,
  type StorageMode,
  type StoragePreferences,
  type TursoConfig
} from './types';

/** localStorage key for the storage preference (separate from the ledger). */
export const STORAGE_PREFS_KEY = 'money-sheets-storage-prefs-v1';

/** True when the string looks like a usable Turso/libSQL endpoint. */
export function isValidTursoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^(libsql|https|wss):\/\/.+/i.test(trimmed);
}

/** A Turso config is usable only with both a valid URL and a non-empty token. */
export function isTursoConfigComplete(config: TursoConfig): boolean {
  return isValidTursoUrl(config.url) && config.authToken.trim().length > 0;
}

/** Parse raw localStorage JSON into validated preferences (never throws). */
export function parseStoragePreferences(raw: string | null): StoragePreferences {
  if (!raw) return { ...DEFAULT_STORAGE_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<StoragePreferences>;
    const mode: StorageMode = parsed.mode === 'turso' ? 'turso' : 'local';
    return {
      mode,
      turso: {
        url: parsed.turso?.url?.trim() ?? '',
        authToken: parsed.turso?.authToken ?? ''
      }
    };
  } catch {
    return { ...DEFAULT_STORAGE_PREFERENCES };
  }
}

export function serializeStoragePreferences(prefs: StoragePreferences): string {
  return JSON.stringify(prefs);
}

/** Mask a token for display, keeping only the first/last few characters. */
export function maskToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}
