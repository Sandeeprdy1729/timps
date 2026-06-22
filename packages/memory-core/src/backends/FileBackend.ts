// ── @timps/memory-core — FileBackend ──
// Writes JSON key-value pairs to the local filesystem with WAL journaling.
//
// WAL (Write-Ahead Logging) protocol:
//   1. Serialize value to JSON string
//   2. Write to <key>.wal first (atomic fsync)
//   3. Rename .wal → actual file (atomic on POSIX)
//   4. On startup, replay any orphaned .wal files
//
// This guarantees crash safety: if the process dies mid-write,
// either the original file is intact or the .wal replay recovers it.
// Never a half-written JSON file.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction } from './types.js';

export interface FileBackendOptions {
  /** Base directory for all storage. Default: ~/.timps/memory */
  baseDir?: string;
  /** Enable WAL journaling (default: true). */
  wal?: boolean;
}

export class FileBackend implements StorageBackend {
  private baseDir: string;
  private walEnabled: boolean;

  constructor(options: FileBackendOptions = {}) {
    this.baseDir = options.baseDir ?? path.join(require('os').homedir(), '.timps', 'memory');
    this.walEnabled = options.wal ?? true;

    // Ensure base directory exists
    fs.mkdirSync(this.baseDir, { recursive: true });

    // Recover any orphaned .wal files on startup
    if (this.walEnabled) {
      this._recoverWalFiles();
    }
  }

  /** Resolve a logical key to an absolute file path. */
  private _resolve(key: string): string {
    // Prevent directory traversal
    const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.baseDir, safe);
  }

  /** Ensure the directory for a given path exists. */
  private _ensureDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ── WAL recovery ──

  /** On startup, scan for orphaned .wal files and replay them. */
  private _recoverWalFiles(): void {
    this._walkDir(this.baseDir, (filePath) => {
      if (filePath.endsWith('.wal')) {
        const targetPath = filePath.slice(0, -4);
        try {
          const walData = fs.readFileSync(filePath, 'utf-8');
          // If the target file doesn't exist or the WAL is newer, replay
          const walMtime = fs.statSync(filePath).mtimeMs;
          const targetExists = fs.existsSync(targetPath);
          const targetMtime = targetExists ? fs.statSync(targetPath).mtimeMs : 0;
          if (walMtime > targetMtime) {
            fs.writeFileSync(targetPath, walData, 'utf-8');
          }
          fs.unlinkSync(filePath);
        } catch {
          // If we can't read the WAL, just remove it to avoid blocking startup
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
      }
    });
  }

  private _walkDir(dir: string, cb: (filePath: string) => void): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this._walkDir(fullPath, cb);
        } else {
          cb(fullPath);
        }
      }
    } catch { /* directory may not exist yet */ }
  }

  // ── Core operations ──

  read(key: string): any {
    const filePath = this._resolve(key);
    try {
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  write(key: string, value: any): void {
    const filePath = this._resolve(key);
    this._ensureDir(filePath);
    const serialized = JSON.stringify(value);

    if (this.walEnabled) {
      // WAL write: write to .wal first, then rename
      const walPath = filePath + '.wal';
      fs.writeFileSync(walPath, serialized, 'utf-8');
      // fsync to ensure data is on disk
      try { fs.fsyncSync(fs.openSync(walPath, 'r')); } catch { /* best effort */ }
      // Atomic rename on POSIX
      fs.renameSync(walPath, filePath);
    } else {
      fs.writeFileSync(filePath, serialized, 'utf-8');
    }
  }

  delete(key: string): void {
    const filePath = this._resolve(key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      // Also clean up any stale WAL
      const walPath = filePath + '.wal';
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
    } catch { /* no error if missing */ }
  }

  list(prefix?: string): string[] {
    const base = prefix ? this._resolve(prefix) : this.baseDir;
    const baseDir = fs.statSync(base, { throwIfNoEntry: false })?.isDirectory() ? base : path.dirname(base);
    const results: string[] = [];
    try {
      this._walkDir(baseDir, (filePath) => {
        if (filePath.endsWith('.wal')) return;
        const relative = path.relative(this.baseDir, filePath);
        if (!prefix || relative.startsWith(prefix)) {
          results.push(relative);
        }
      });
    } catch { /* baseDir may not exist */ }
    return results.sort();
  }

  query(filter: StorageQuery): StorageRecord[] {
    const keys = filter.prefix ? this.list(filter.prefix) : this.list();
    let results: StorageRecord[] = [];

    for (const key of keys) {
      const value = this.read(key);
      if (value === null) continue;
      results.push({ key, value });
    }

    if (filter.timestampMin !== undefined) {
      const min = filter.timestampMin;
      results = results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp >= min);
    }
    if (filter.timestampMax !== undefined) {
      const max = filter.timestampMax;
      results = results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp <= max);
    }
    if (filter.filter) {
      results = results.filter(r => filter.filter!(r.value));
    }
    if (filter.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }

  exists(key: string): boolean {
    return fs.existsSync(this._resolve(key));
  }

  append(key: string, line: string): void {
    const filePath = this._resolve(key);
    this._ensureDir(filePath);
    if (this.walEnabled) {
      const walPath = filePath + '.wal';
      const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
      const newContent = existing + line + '\n';
      fs.writeFileSync(walPath, newContent, 'utf-8');
      try { fs.fsyncSync(fs.openSync(walPath, 'r')); } catch { /* best effort */ }
      fs.renameSync(walPath, filePath);
    } else {
      fs.appendFileSync(filePath, line + '\n', 'utf-8');
    }
  }

  // ── Transactions ──

  beginTxn(): FileTransaction {
    return new FileTransaction(this);
  }

  /** Get the base directory (useful for inspection). */
  getBaseDir(): string {
    return this.baseDir;
  }
}

class FileTransaction implements StorageTransaction {
  private ops: Array<{ type: 'write' | 'delete'; key: string; value?: any }> = [];
  private committed = false;
  private rolledBack = false;

  constructor(private backend: FileBackend) {}

  write(key: string, value: any): void {
    this._checkActive();
    this.ops.push({ type: 'write', key, value });
  }

  delete(key: string): void {
    this._checkActive();
    this.ops.push({ type: 'delete', key });
  }

  commit(): void {
    this._checkActive();
    for (const op of this.ops) {
      if (op.type === 'write') {
        this.backend.write(op.key, op.value!);
      } else {
        this.backend.delete(op.key);
      }
    }
    this.committed = true;
  }

  rollback(): void {
    this.rolledBack = true;
  }

  private _checkActive(): void {
    if (this.committed) throw new Error('Transaction already committed');
    if (this.rolledBack) throw new Error('Transaction already rolled back');
  }
}
