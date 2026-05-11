// TIMPS Code — Settings Sync Types
// Types for cross-device settings synchronization

export interface UserSyncContent {
  entries: Record<string, string>;
}

export interface UserSyncData {
  userId: string;
  version: number;
  lastModified: string;
  checksum: string;
  content: UserSyncContent;
}

export interface SettingsSyncFetchResult {
  success: boolean;
  data?: UserSyncData;
  isEmpty?: boolean;
  error?: string;
  skipRetry?: boolean;
}

export interface SettingsSyncUploadResult {
  success: boolean;
  checksum?: string;
  lastModified?: string;
  error?: string;
}

export const SYNC_KEYS = {
  USER_SETTINGS: '~/.timps/settings.json',
  USER_MEMORY: '~/.timps/CLAUDE.md',
  projectSettings: (projectId: string) => `projects/${projectId}/.timps/settings.local.json`,
  projectMemory: (projectId: string) => `projects/${projectId}/CLAUDE.local.md`,
} as const;

export const SETTINGS_SYNC_TIMEOUT_MS = 10000;
export const MAX_FILE_SIZE_BYTES = 500 * 1024;
export const DEFAULT_MAX_RETRIES = 3;