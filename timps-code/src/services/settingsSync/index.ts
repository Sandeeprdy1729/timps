// TIMPS Code — Settings Sync Service
// Cross-device settings and memory synchronization

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import { loadConfig, saveConfig } from '../../config/config.js';
import { getOAuthConfig } from '../oauth/index.js';
import type {
  UserSyncData,
  SettingsSyncFetchResult,
  SettingsSyncUploadResult,
  UserSyncContent,
} from './types.js';

const SETTINGS_SYNC_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;

function getSettingsSyncEndpoint(): string {
  const config = getOAuthConfig();
  return `${config.AUTHORIZE_URL.replace('/oauth/authorize', '')}/api/timps/settings`;
}

function getAuthHeaders(): { headers: Record<string, string>; error?: string } {
  const cfg = loadConfig();
  if (cfg.apiKey) {
    return {
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }
  return { headers: {}, error: 'No API key available' };
}

async function tryReadFileForSync(filePath: string): Promise<string | null> {
  try {
    const expandedPath = expandPath(filePath);
    if (!fs.existsSync(expandedPath)) return null;
    const stats = fs.statSync(expandedPath);
    if (stats.size > 500 * 1024) return null;
    const content = fs.readFileSync(expandedPath, 'utf-8');
    if (!content || /^\s*$/.test(content)) return null;
    return content;
  } catch {
    return null;
  }
}

async function writeFileForSync(filePath: string, content: string): Promise<boolean> {
  try {
    const expandedPath = expandPath(filePath);
    const dir = path.dirname(expandedPath);
    if (dir && dir !== '.') {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(expandedPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

async function fetchUserSettingsOnce(): Promise<SettingsSyncFetchResult> {
  try {
    const authHeaders = getAuthHeaders();
    if (authHeaders.error) {
      return { success: false, error: authHeaders.error, skipRetry: true };
    }

    const endpoint = getSettingsSyncEndpoint();
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: authHeaders.headers,
      signal: AbortSignal.timeout(SETTINGS_SYNC_TIMEOUT_MS),
    });

    if (response.status === 404) {
      return { success: true, isEmpty: true };
    }

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Not authorized', skipRetry: true };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as UserSyncData;
    return { success: true, data, isEmpty: false };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function fetchUserSettings(maxRetries = DEFAULT_MAX_RETRIES): Promise<SettingsSyncFetchResult> {
  let lastResult: SettingsSyncFetchResult | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    lastResult = await fetchUserSettingsOnce();

    if (lastResult.success) {
      return lastResult;
    }

    if (lastResult.skipRetry) {
      return lastResult;
    }

    if (attempt > maxRetries) {
      return lastResult;
    }

    const delayMs = getRetryDelay(attempt);
    await sleep(delayMs);
  }

  return lastResult!;
}

async function uploadUserSettings(entries: Record<string, string>): Promise<SettingsSyncUploadResult> {
  try {
    const authHeaders = getAuthHeaders();
    if (authHeaders.error) {
      return { success: false, error: authHeaders.error };
    }

    const endpoint = getSettingsSyncEndpoint();
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: authHeaders.headers,
      body: JSON.stringify({ entries }),
      signal: AbortSignal.timeout(SETTINGS_SYNC_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as { checksum?: string; lastModified?: string };
    return { success: true, checksum: data.checksum, lastModified: data.lastModified };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function getUserSettingsPath(): string {
  return path.join(os.homedir(), '.timps', 'settings.json');
}

function getUserMemoryPath(): string {
  return path.join(os.homedir(), '.timps', 'CLAUDE.md');
}

async function buildEntriesFromLocalFiles(): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};

  const userSettingsPath = getUserSettingsPath();
  const userSettingsContent = await tryReadFileForSync(userSettingsPath);
  if (userSettingsContent) {
    entries['settings'] = userSettingsContent;
  }

  const userMemoryPath = getUserMemoryPath();
  const userMemoryContent = await tryReadFileForSync(userMemoryPath);
  if (userMemoryContent) {
    entries['memory'] = userMemoryContent;
  }

  return entries;
}

async function applyRemoteEntriesToLocal(entries: Record<string, string>): Promise<number> {
  let appliedCount = 0;

  const userSettingsContent = entries['settings'];
  if (userSettingsContent) {
    const userSettingsPath = getUserSettingsPath();
    if (await writeFileForSync(userSettingsPath, userSettingsContent)) {
      appliedCount++;
    }
  }

  const userMemoryContent = entries['memory'];
  if (userMemoryContent) {
    const userMemoryPath = getUserMemoryPath();
    if (await writeFileForSync(userMemoryPath, userMemoryContent)) {
      appliedCount++;
    }
  }

  return appliedCount;
}

let downloadPromise: Promise<boolean> | null = null;

export function downloadUserSettings(): Promise<boolean> {
  if (downloadPromise) {
    return downloadPromise;
  }
  downloadPromise = doDownloadUserSettings();
  return downloadPromise;
}

export function redownloadUserSettings(): Promise<boolean> {
  downloadPromise = doDownloadUserSettings(0);
  return downloadPromise;
}

async function doDownloadUserSettings(maxRetries = DEFAULT_MAX_RETRIES): Promise<boolean> {
  try {
    const result = await fetchUserSettings(maxRetries);
    if (!result.success || result.isEmpty) {
      return false;
    }

    if (result.data?.content?.entries) {
      const appliedCount = await applyRemoteEntriesToLocal(result.data.content.entries);
      console.log(`[settings-sync] Applied ${appliedCount} settings from remote`);
      return appliedCount > 0;
    }

    return false;
  } catch (error) {
    console.error('[settings-sync] Download error:', error);
    return false;
  }
}

export async function uploadUserSettingsInBackground(): Promise<void> {
  try {
    const localEntries = await buildEntriesFromLocalFiles();
    const changedEntries = localEntries;

    if (Object.keys(changedEntries).length === 0) {
      console.log('[settings-sync] No settings to upload');
      return;
    }

    const result = await uploadUserSettings(changedEntries);
    if (result.success) {
      console.log(`[settings-sync] Uploaded ${Object.keys(changedEntries).length} settings`);
    } else {
      console.warn(`[settings-sync] Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('[settings-sync] Upload error:', error);
  }
}

export function isSettingsSyncEnabled(): boolean {
  const cfg = loadConfig();
  return Boolean(cfg.apiKey);
}

export async function syncSettings(): Promise<{ uploaded: boolean; downloaded: boolean }> {
  let uploaded = false;
  let downloaded = false;

  if (isSettingsSyncEnabled()) {
    await uploadUserSettingsInBackground();
    uploaded = true;

    const downloadResult = await downloadUserSettings();
    downloaded = downloadResult;
  }

  return { uploaded, downloaded };
}