import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_STORAGE_KEY, LedgerSnapshot, createDefaultLedger, parseStoredLedger } from '../../shared/ledgerStore';

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
