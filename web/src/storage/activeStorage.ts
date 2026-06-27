import type { LedgerStorageAdapter, EffectiveStorageInfo, StoragePreferences } from '../../../shared/storage/types';
import { isTursoConfigComplete } from '../../../shared/storage/prefs';
import { localAdapter } from './localAdapter';
import { createTursoAdapter } from './tursoAdapter';

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Decide which storage backend is actually usable right now.
 *
 * Turso is used only when it is the preferred mode, fully configured, AND the
 * browser is online. Otherwise we fall back to local storage so the app keeps
 * working offline. `isTursoFallback` marks the degraded case for the UI.
 */
export function resolveEffectiveStorage(prefs: StoragePreferences): EffectiveStorageInfo {
  const online = isOnline();
  const wantsTurso = prefs.mode === 'turso' && isTursoConfigComplete(prefs.turso);
  const tursoUsable = wantsTurso && online;

  const effectiveMode = tursoUsable ? 'turso' : 'local';
  return {
    preferredMode: prefs.mode,
    effectiveMode,
    /** Turso is selected but reads/writes are using the local cache right now. */
    isTursoFallback: wantsTurso && effectiveMode !== 'turso',
    isOnline: online
  };
}

/** Build the adapter for the resolved effective mode. */
export function getActiveAdapter(prefs: StoragePreferences, info: EffectiveStorageInfo): LedgerStorageAdapter {
  if (info.effectiveMode === 'turso') {
    return createTursoAdapter(prefs.turso);
  }
  return localAdapter;
}
