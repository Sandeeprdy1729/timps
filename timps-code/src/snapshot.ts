// ── File Snapshot & Undo System ──
// Takes snapshots of files before changes so you can rollback anything

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSnapshotDir } from './config.js';
import type { FileSnapshot } from './types.js';
import { generateId } from './utils.js';

const MAX_SNAPSHOTS = 50;

export class SnapshotManager {
  private dir: string;
  private indexFile: string;

  constructor(projectPath: string) {
    this.dir = getSnapshotDir(projectPath);
    this.indexFile = path.join(this.dir, 'index.json');
  }

  /**
   * Take a snapshot of the given files before modifying them.
   */
  capture(filePaths: string[], description: string): string {
    const id = generateId('snap');
    const snapshot: FileSnapshot = {
      id,
      timestamp: Date.now(),
      description,
      files: filePaths.map(fp => {
        try {
          const content = fs.readFileSync(fp, 'utf-8');
          return { path: fp, content, existed: true };
        } catch {
          return { path: fp, content: '', existed: false };
        }
      }),
    };

    // Save snapshot data
    fs.writeFileSync(path.join(this.dir, `${id}.json`), JSON.stringify(snapshot), 'utf-8');

    // Update index
    const index = this.loadIndex();
    index.push({ id, timestamp: snapshot.timestamp, description, fileCount: snapshot.files.length });
    if (index.length > MAX_SNAPSHOTS) {
      const removed = index.shift()!;
      try { fs.unlinkSync(path.join(this.dir, `${removed.id}.json`)); } catch { /* ok */ }
    }
    this.saveIndex(index);

    return id;
  }

  /**
   * Restore files from a snapshot.
   */
  restore(id: string): { restored: string[]; errors: string[] } {
    const snapshotPath = path.join(this.dir, `${id}.json`);
    if (!fs.existsSync(snapshotPath)) {
      return { restored: [], errors: [`Snapshot ${id} not found`] };
    }

    const snapshot: FileSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const restored: string[] = [];
    const errors: string[] = [];

    for (const file of snapshot.files) {
      try {
        if (file.existed) {
          fs.mkdirSync(path.dirname(file.path), { recursive: true });
          fs.writeFileSync(file.path, file.content, 'utf-8');
          restored.push(file.path);
        } else {
          // File didn't exist before — remove it
          try { fs.unlinkSync(file.path); } catch { /* ok */ }
          restored.push(`${file.path} (deleted)`);
        }
      } catch (e) {
        errors.push(`${file.path}: ${(e as Error).message}`);
      }
    }

    return { restored, errors };
  }

  /**
   * Undo the last N snapshots.
   */
  undoLast(count = 1): { restored: string[]; errors: string[] } {
    const index = this.loadIndex();
    const allRestored: string[] = [];
    const allErrors: string[] = [];

    for (let i = 0; i < count && index.length > 0; i++) {
      const last = index[index.length - 1];
      const result = this.restore(last.id);
      allRestored.push(...result.restored);
      allErrors.push(...result.errors);
      // Remove from index after successful restore
      index.pop();
    }

    this.saveIndex(index);
    return { restored: allRestored, errors: allErrors };
  }

  /**
   * List recent snapshots.
   */
  list(count = 10): { id: string; timestamp: number; description: string; fileCount: number }[] {
    return this.loadIndex().slice(-count).reverse();
  }

  // ── Private ──

  private loadIndex(): { id: string; timestamp: number; description: string; fileCount: number }[] {
    try {
      if (fs.existsSync(this.indexFile)) {
        return JSON.parse(fs.readFileSync(this.indexFile, 'utf-8'));
      }
    } catch { /* ignore */ }
    return [];
  }

  private saveIndex(index: { id: string; timestamp: number; description: string; fileCount: number }[]): void {
    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
  }
}
