import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOCAL_STORAGE_KEY,
  type LedgerSnapshot,
  createDefaultLedger,
  parseStoredLedger
} from '../../../shared/ledgerStore';
import type { LedgerStorageAdapter } from '../../../shared/storage/types';

export async function loadLocalLedger(): Promise<LedgerSnapshot> {
  const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
  return parseStoredLedger(raw);
}

export async function saveLocalLedger(snapshot: LedgerSnapshot): Promise<void> {
  await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
}

export async function clearLocalLedger(): Promise<LedgerSnapshot> {
  const fresh = createDefaultLedger();
  await saveLocalLedger(fresh);
  return fresh;
}

/** Whether the device already has a saved ledger (used to detect "has data"). */
export async function localLedgerExists(): Promise<boolean> {
  return (await AsyncStorage.getItem(LOCAL_STORAGE_KEY)) !== null;
}

export const localAdapter: LedgerStorageAdapter = {
  load: loadLocalLedger,
  save: saveLocalLedger,
  clear: clearLocalLedger
};
