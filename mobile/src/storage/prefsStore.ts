import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STORAGE_PREFS_KEY,
  parseStoragePreferences,
  serializeStoragePreferences
} from '../../../shared/storage/prefs';
import { DEFAULT_STORAGE_PREFERENCES, type StoragePreferences } from '../../../shared/storage/types';

// Cache the last-loaded prefs so the resolver can read them synchronously while
// connectivity changes are evaluated. Hydrated once during boot.
let cached: StoragePreferences = { ...DEFAULT_STORAGE_PREFERENCES };

export function cachedStoragePreferences(): StoragePreferences {
  return cached;
}

export async function loadStoragePreferences(): Promise<StoragePreferences> {
  const raw = await AsyncStorage.getItem(STORAGE_PREFS_KEY);
  cached = parseStoragePreferences(raw);
  return cached;
}

export async function saveStoragePreferences(prefs: StoragePreferences): Promise<void> {
  cached = prefs;
  await AsyncStorage.setItem(STORAGE_PREFS_KEY, serializeStoragePreferences(prefs));
}
