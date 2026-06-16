import {
  STORAGE_PREFS_KEY,
  parseStoragePreferences,
  serializeStoragePreferences
} from '../../../shared/storage/prefs';
import type { StoragePreferences } from '../../../shared/storage/types';

export function loadStoragePreferences(): StoragePreferences {
  return parseStoragePreferences(localStorage.getItem(STORAGE_PREFS_KEY));
}

export function saveStoragePreferences(prefs: StoragePreferences): void {
  localStorage.setItem(STORAGE_PREFS_KEY, serializeStoragePreferences(prefs));
}
