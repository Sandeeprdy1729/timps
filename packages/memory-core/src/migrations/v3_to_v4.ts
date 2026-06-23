// ── @timps/memory-core — Migration v3 → v4 ──
// Adds org-scope awareness to stored memory data.
// For layer state files (which already have _meta), adds _meta.orgScope.
// Core data files (episodes.json, semantic.json, working.json) get a sidecar
// .org-scope.json file rather than being modified directly (their format is
// raw arrays, not _meta-wrapped objects).
//
// Existing data without an org scope is assigned to a default org ("default")
// with project_id derived from the storage directory name (the old project hash).
// This preserves backward compat — all old data is visible under the default org.

import type { Migration } from './types.js';
import type { StorageBackend } from '../backends/types.js';

// Keys that should NOT get orgScope metadata
const SKIP_KEYS = new Set([
  'schema-version.json',
  '.init',
  '.org-scope.json',
  'session-profiles.json',
]);

// Core data files — must NOT be wrapped; they get a sidecar scope file instead
const DATA_FILES = new Set([
  'episodes.json',
  'semantic.json',
  'working.json',
]);

export const v3_to_v4: Migration = {
  version: 4,
  description: 'Add org-scope awareness to all stored memory data',
  run(_dir: string, backend: StorageBackend): void {
    const allKeys = (backend.list() as string[]);
    const now = new Date().toISOString();

    // Determine the default scope from the directory name
    const dirName = _dir.split('/').pop() ?? 'default';
    const defaultScope = {
      orgId: 'default',
      projectId: dirName,
    };

    // Write sidecar scope file for core data
    if (!allKeys.includes('.org-scope.json')) {
      backend.write('.org-scope.json', {
        defaultScope,
        migratedAt: now,
        migrationVersion: 4,
      });
    }

    for (const key of allKeys) {
      if (SKIP_KEYS.has(key)) continue;
      if (DATA_FILES.has(key)) continue; // Not wrapped — uses sidecar
      if (key.endsWith('.wal')) continue;

      const raw = backend.read(key) as Record<string, unknown> | null;
      if (!raw || typeof raw !== 'object') continue;

      // Only process files that already have _meta (layer state files)
      if (raw._meta && typeof raw._meta === 'object') {
        const meta = raw._meta as Record<string, unknown>;
        if (!meta.orgScope) {
          (raw._meta as Record<string, unknown>).orgScope = { ...defaultScope };
          (raw._meta as Record<string, unknown>).migratedAt = now;
          (raw._meta as Record<string, unknown>).migrationVersion = 4;
          backend.write(key, raw);
        }
      }
    }
  },
};
