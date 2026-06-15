import { LOCAL_STORAGE_KEY, LedgerSnapshot, createDefaultLedger, parseStoredLedger } from '../../shared/ledgerStore';

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
