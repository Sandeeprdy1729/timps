// ── @timps/memory-core — MigrationEngine ──
// Reads the on-disk schema version, runs pending migrations in order,
// and updates schema-version.json when done.
//
// Called once at MemoryEngine startup, before any forge loads.

import type { StorageBackend } from '../backends/types.js';
import type { Migration, SchemaVersionFile } from './types.js';
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './types.js';
import { isPromiseLike } from './async.js';

export class MigrationEngine {
  private pending: Migration[] = [];
  private _available: Migration[] = [];
  private _deferred = false;
  private _currentVersion = 0;

  constructor(
    private dir: string,
    private backend: StorageBackend,
    availableMigrations: Migration[],
  ) {
    // Sort by version ascending
    this._available = [...availableMigrations].sort((a, b) => a.version - b.version);
    this._currentVersion = this._readVersion();
    // On async backends (Postgres/Redis/Qdrant) the version read returns a
    // Promise and the real value is only known once startup() awaits it.
    // Defer pending computation to the async startup path.
    if (!this._deferred) {
      this.pending = this._available.filter(m => m.version > this._currentVersion && m.version <= CURRENT_SCHEMA_VERSION);
    }
  }

  /** Are there migrations waiting to run? */
  get hasPending(): boolean {
    if (this._deferred) return true;
    return this.pending.length > 0;
  }

  /** Run all pending migrations in sequence. */
  startup(): void | Promise<void> {
    if (this._deferred) return this._startupAsync();
    for (const migration of this.pending) {
      try {
        migration.run(this.dir, this.backend);
      } catch (err) {
        console.error(`[memory-core] migration v${migration.version} failed:`, err);
        continue;
      }
      this._writeVersion(migration.version);
    }
    this.pending = [];
  }

  /** The current on-disk schema version. */
  currentVersion(): number {
    return this._currentVersion;
  }

  private async _startupAsync(): Promise<void> {
    let currentVersion = 0;
    try {
      const sv = (await this.backend.read(SCHEMA_VERSION_KEY)) as SchemaVersionFile | null;
      if (sv && typeof sv.version === 'number') currentVersion = sv.version;
    } catch { /* treat missing/invalid as version 0 */ }
    this._currentVersion = currentVersion;

    const pending = this._available.filter(m => m.version > currentVersion && m.version <= CURRENT_SCHEMA_VERSION);
    for (const migration of pending) {
      try {
        const result = migration.run(this.dir, this.backend);
        if (isPromiseLike(result)) await result;
      } catch (err) {
        console.error(`[memory-core] migration v${migration.version} failed:`, err);
        continue;
      }
      await this._writeVersionAsync(migration.version);
    }
    this.pending = [];
    this._deferred = false;
  }

  private _readVersion(): number {
    try {
      const sv = this.backend.read(SCHEMA_VERSION_KEY);
      if (isPromiseLike(sv)) {
        // Async backend — the real version is read in _startupAsync().
        this._deferred = true;
        void (sv as PromiseLike<unknown>).then(undefined, () => { /* swallow */ });
        return 0;
      }
      const file = sv as SchemaVersionFile | null;
      if (file && typeof file.version === 'number') return file.version;
    } catch { /* treat missing/invalid as version 0 */ }
    return 0;
  }

  private _writeVersion(version: number): void {
    this._currentVersion = version;
    const sv: SchemaVersionFile = {
      version,
      migratedAt: new Date().toISOString(),
    };
    this.backend.write(SCHEMA_VERSION_KEY, sv);
  }

  private async _writeVersionAsync(version: number): Promise<void> {
    this._currentVersion = version;
    const sv: SchemaVersionFile = {
      version,
      migratedAt: new Date().toISOString(),
    };
    await this.backend.write(SCHEMA_VERSION_KEY, sv);
  }
}
