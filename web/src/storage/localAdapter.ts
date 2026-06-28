import { LOCAL_STORAGE_KEY, type LedgerSnapshot, createDefaultLedger, parseStoredLedger } from '../../../shared/ledgerStore';
import type { LedgerStorageAdapter } from '../../../shared/storage/types';

/**
 * Showcase/demo data lives in its own key so enabling showcase mode never
 * touches the user's real ledger. A separate marker records whether a showcase
 * session is currently active so it can survive a reload and be unwound on exit.
 */
const SHOWCASE_STORAGE_KEY = 'money-sheets-showcase-v1';
const SHOWCASE_ACTIVE_KEY = 'money-sheets-showcase-active';

export async function loadLocalLedger(): Promise<LedgerSnapshot> {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  return parseStoredLedger(raw);
}

export async function saveLocalLedger(snapshot: LedgerSnapshot): Promise<void> {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
}

export async function clearLocalLedger(): Promise<LedgerSnapshot> {
  const fresh = createDefaultLedger();
  await saveLocalLedger(fresh);
  return fresh;
}

/** Whether the device already has a saved ledger (used to detect "has data"). */
export function localLedgerExists(): boolean {
  return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
}

// ---------- Showcase (demo) session — isolated from the real ledger ----------

export async function loadShowcaseLedger(): Promise<LedgerSnapshot> {
  const raw = localStorage.getItem(SHOWCASE_STORAGE_KEY);
  return parseStoredLedger(raw);
}

export async function saveShowcaseLedger(snapshot: LedgerSnapshot): Promise<void> {
  localStorage.setItem(SHOWCASE_STORAGE_KEY, JSON.stringify(snapshot));
}

/** Remove the demo data entirely (called when leaving showcase mode). */
export function clearShowcaseLedger(): void {
  localStorage.removeItem(SHOWCASE_STORAGE_KEY);
}

/** Whether a showcase session is currently active on this device. */
export function showcaseSessionActive(): boolean {
  return localStorage.getItem(SHOWCASE_ACTIVE_KEY) === '1';
}

export function setShowcaseSessionActive(active: boolean): void {
  if (active) localStorage.setItem(SHOWCASE_ACTIVE_KEY, '1');
  else localStorage.removeItem(SHOWCASE_ACTIVE_KEY);
}

export const localAdapter: LedgerStorageAdapter = {
  load: loadLocalLedger,
  save: saveLocalLedger,
  clear: clearLocalLedger
};
