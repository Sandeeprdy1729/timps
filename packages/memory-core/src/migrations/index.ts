// ── @timps/memory-core — Migrations barrel export ──

export { MigrationEngine } from './MigrationEngine.js';
export { CURRENT_SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './types.js';
export type { Migration, SchemaVersionFile } from './types.js';

import type { Migration } from './types.js';
import { v1_to_v2 } from './v1_to_v2.js';
import { v2_to_v3 } from './v2_to_v3.js';
import { v3_to_v4 } from './v3_to_v4.js';

/**
 * Ordered list of all available migrations.
 * Sorted by version — always add new ones at the end.
 */
export const ALL_MIGRATIONS: Migration[] = [
  v1_to_v2,
  v2_to_v3,
  v3_to_v4,
];
