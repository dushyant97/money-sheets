/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_WEB_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// File System Access API — `showSaveFilePicker`/`showOpenFilePicker` are not yet
// in the standard TS DOM lib. Minimal declarations for the export/import flows.
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
}
