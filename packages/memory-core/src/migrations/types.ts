// ── @timps/memory-core — Migration types ──

import type { StorageBackend } from '../backends/types.js';

/**
 * Current on-disk schema version for memory directories.
 * Bump this when adding a new migration.
 * History:
 *   1 — Initial (JSONL episodes, no _meta anywhere)
 *   2 — episodes.jsonl → episodes.json JSON array format
 *   3 — _meta block added to all layer state files
 */
export const CURRENT_SCHEMA_VERSION = 3;

export interface Migration {
  /** The version this migration produces (after running). */
  version: number;
  /** Human-readable description. */
  description: string;
  /** Execute the migration. Receives backend and base directory path. */
  run(dir: string, backend: StorageBackend): void | Promise<void>;
}

export interface SchemaVersionFile {
  version: number;
  migratedAt: string;
}

/** Key used to store schema version in the backend. */
export const SCHEMA_VERSION_KEY = 'schema-version.json';
