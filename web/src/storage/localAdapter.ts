import { LOCAL_STORAGE_KEY, type LedgerSnapshot, createDefaultLedger, parseStoredLedger } from '../../../shared/ledgerStore';
import type { LedgerStorageAdapter } from '../../../shared/storage/types';

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

export const localAdapter: LedgerStorageAdapter = {
  load: loadLocalLedger,
  save: saveLocalLedger,
  clear: clearLocalLedger
};
