import type { ClientHistoryEntry, CreateClientInput } from './services/clients';

export interface UpdaterStatusData {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode';
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  message?: string;
}

export interface UpdaterCheckResult {
  success: boolean;
  status?: string;
  currentVersion?: string;
  message?: string;
  error?: string;
  updateInfo?: {
    version: string;
    releaseDate?: string;
    releaseNotes?: string;
  };
}

declare global {
  interface Window {
    autoEcole?: {
      clients: {
        create(input: CreateClientInput & { history?: ClientHistoryEntry[] }): Promise<{ id: number }>;
      };
      updater?: {
        check(): Promise<UpdaterCheckResult>;
        download(): Promise<{ success: boolean; error?: string }>;
        install(): Promise<{ success: boolean; error?: string }>;
        getVersion(): Promise<string>;
        onStatus(callback: (data: UpdaterStatusData) => void): () => void;
      };
    };
  }
}

export {};
