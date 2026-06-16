import NetInfo from '@react-native-community/netinfo';
import type { LedgerStorageAdapter, EffectiveStorageInfo, StoragePreferences } from '../../../shared/storage/types';
import { isTursoConfigComplete } from '../../../shared/storage/prefs';
import { localAdapter } from './localAdapter';
import { createTursoAdapter } from './tursoAdapter';

// NetInfo is event-based and async, but the resolver needs a synchronous answer
// (same shape as the web's `navigator.onLine`). We keep the latest connectivity
// in a module variable, updated by a single subscription started at boot.
let online = true;
let started = false;
type OnlineListener = (online: boolean) => void;
const listeners = new Set<OnlineListener>();

function setOnline(next: boolean) {
  if (next === online) return;
  online = next;
  for (const listener of listeners) listener(online);
}

function isReachable(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  // `isInternetReachable` is null while NetInfo is still probing; treat that as
  // online so the app doesn't flap to offline during the first second.
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

/** Begin listening for connectivity changes. Safe to call more than once. */
export function startNetworkMonitor(): void {
  if (started) return;
  started = true;
  NetInfo.addEventListener((state) => setOnline(isReachable(state)));
}

/** Fetch the current connectivity once and update the cached value. */
export async function refreshOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  setOnline(isReachable(state));
  return online;
}

/** Subscribe to online/offline transitions. Returns an unsubscribe function. */
export function subscribeOnline(listener: OnlineListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isOnline(): boolean {
  return online;
}

/**
 * Decide which storage backend is actually usable right now.
 *
 * Turso is used only when it is the preferred mode, fully configured, AND the
 * device is online. Otherwise we fall back to local storage so the app keeps
 * working offline. `isTursoFallback` marks the degraded case for the UI.
 */
export function resolveEffectiveStorage(prefs: StoragePreferences): EffectiveStorageInfo {
  const connected = isOnline();
  const wantsTurso = prefs.mode === 'turso' && isTursoConfigComplete(prefs.turso);
  const tursoUsable = wantsTurso && connected;

  return {
    preferredMode: prefs.mode,
    effectiveMode: tursoUsable ? 'turso' : 'local',
    isTursoFallback: wantsTurso && !connected,
    isOnline: connected
  };
}

/** Build the adapter for the resolved effective mode. */
export function getActiveAdapter(prefs: StoragePreferences, info: EffectiveStorageInfo): LedgerStorageAdapter {
  if (info.effectiveMode === 'turso') {
    return createTursoAdapter(prefs.turso);
  }
  return localAdapter;
}
