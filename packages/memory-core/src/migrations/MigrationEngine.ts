// ── @timps/memory-core — MigrationEngine ──
// Reads the on-disk schema version, runs pending migrations in order,
// and updates schema-version.json when done.
//
// Called once at MemoryEngine startup, before any forge loads.

import type { StorageBackend } from '../backends/types.js';
import type { Migration, SchemaVersionFile } from './types.js';
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './types.js';

export class MigrationEngine {
  private pending: Migration[] = [];

  constructor(
    private dir: string,
    private backend: StorageBackend,
    availableMigrations: Migration[],
  ) {
    // Sort by version ascending
    const sorted = [...availableMigrations].sort((a, b) => a.version - b.version);
    const currentVersion = this._readVersion();
    this.pending = sorted.filter(m => m.version > currentVersion && m.version <= CURRENT_SCHEMA_VERSION);
  }

  /** Are there migrations waiting to run? */
  get hasPending(): boolean {
    return this.pending.length > 0;
  }

  /** Run all pending migrations in sequence. */
  startup(): void {
    for (const migration of this.pending) {
      migration.run(this.dir, this.backend);
      this._writeVersion(migration.version);
    }
    this.pending = [];
  }

  /** The current on-disk schema version. */
  currentVersion(): number {
    return this._readVersion();
  }

  private _readVersion(): number {
    try {
      const sv = this.backend.read(SCHEMA_VERSION_KEY) as SchemaVersionFile | null;
      if (sv && typeof sv.version === 'number') return sv.version;
    } catch { /* treat missing/invalid as version 0 */ }
    return 0;
  }

  private _writeVersion(version: number): void {
    const sv: SchemaVersionFile = {
      version,
      migratedAt: new Date().toISOString(),
    };
    this.backend.write(SCHEMA_VERSION_KEY, sv);
  }
}
