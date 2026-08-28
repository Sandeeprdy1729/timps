// ── @timps/memory-core — Phase 4c: ArchiveBackend ──
// Cold storage for archived memories. Stores entries as compressed JSON
// files, organized by archive batch. Not indexed in Qdrant — entries here
// are not searchable via vector recall, only restorable.

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import type { MemoryEntry } from '../types.js';
import type { ArchiveManifest, ArchiveEntry, CompactionConfig } from './types.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class ArchiveBackend {
  private archiveDir: string;

  constructor(dir: string) {
    this.archiveDir = path.join(dir, 'archive');
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
  }

  /**
   * Archive a batch of memory entries. Returns the manifest for the batch.
   */
  async archiveBatch(entries: MemoryEntry[], config: CompactionConfig): Promise<ArchiveManifest> {
    const timestamp = Date.now();
    const archiveEntries: ArchiveEntry[] = entries.map(e => ({
      id: e.id,
      content: e.content,
      type: e.type,
      tags: e.tags,
      timestamp: e.timestamp,
      layer: 'L3',
      importance: 0.5,
      originalSize: Buffer.byteLength(JSON.stringify(e), 'utf-8'),
    }));

    const manifest: ArchiveManifest = {
      version: 1,
      archivedAt: timestamp,
      totalArchived: archiveEntries.length,
      totalSize: archiveEntries.reduce((s, e) => s + e.originalSize, 0),
      compressedSize: 0,
      entries: archiveEntries,
    };

    // Write as compressed JSON
    const jsonStr = JSON.stringify(manifest);
    const compressed = await gzip(Buffer.from(jsonStr, 'utf-8'));
    manifest.compressedSize = compressed.length;

    const filename = `archive_${timestamp}.json.gz`;
    const filepath = path.join(this.archiveDir, filename);
    fs.writeFileSync(filepath, compressed);

    // Update manifest on disk (without full entries) for quick listing
    this._updateIndex(manifest);

    return manifest;
  }

  /**
   * Archive a single memory entry.
   */
  async archiveOne(entry: MemoryEntry): Promise<string> {
    const manifest = await this.archiveBatch([entry], {
      archiveAfterDays: 0, warmImportanceThreshold: 0, coldImportanceThreshold: 0,
      warmRecallThreshold: 0, clusterMinSize: 0, clusterMaxSize: 0,
      deleteAfterConsolidationDays: 0, clusterEmbedDim: 0, clusterCount: 0,
      constitutionalGuardrails: false,
    });
    return manifest.entries[0]?.id ?? '';
  }

  /**
   * List all archive batches with summary info.
   */
  listArchives(): ArchiveManifest[] {
    const indexFile = path.join(this.archiveDir, 'index.json');
    if (!fs.existsSync(indexFile)) return [];
    try {
      return JSON.parse(fs.readFileSync(indexFile, 'utf-8')) as ArchiveManifest[];
    } catch {
      return [];
    }
  }

  /**
   * Restore all entries from an archive batch by timestamp.
   */
  async restoreBatch(archiveTimestamp: number): Promise<MemoryEntry[]> {
    const filename = `archive_${archiveTimestamp}.json.gz`;
    const filepath = path.join(this.archiveDir, filename);
    if (!fs.existsSync(filepath)) return [];

    const compressed = fs.readFileSync(filepath);
    const jsonStr = (await gunzip(compressed)).toString('utf-8');
    const manifest = JSON.parse(jsonStr) as ArchiveManifest;

    return manifest.entries.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      type: e.type as MemoryEntry['type'],
      content: e.content,
      tags: e.tags,
    }));
  }

  /**
   * Restore all archived entries across all batches.
   */
  async restoreAll(): Promise<MemoryEntry[]> {
    const manifests = this.listArchives();
    const all: MemoryEntry[] = [];
    for (const m of manifests) {
      const entries = await this.restoreBatch(m.archivedAt);
      all.push(...entries);
    }
    return all;
  }

  /**
   * Delete an archive batch by timestamp.
   */
  deleteBatch(archiveTimestamp: number): boolean {
    const filename = `archive_${archiveTimestamp}.json.gz`;
    const filepath = path.join(this.archiveDir, filename);
    if (!fs.existsSync(filepath)) return false;
    fs.unlinkSync(filepath);
    this._rebuildIndex();
    return true;
  }

  /**
   * Delete all archived entries older than the given timestamp.
   * Returns count of batches deleted.
   */
  deleteOlderThan(timestamp: number): number {
    const manifests = this.listArchives();
    let deleted = 0;
    for (const m of manifests) {
      if (m.archivedAt < timestamp) {
        if (this.deleteBatch(m.archivedAt)) deleted++;
      }
    }
    return deleted;
  }

  /**
   * Total number of archived entries across all batches.
   */
  totalArchived(): number {
    return this.listArchives().reduce((s, m) => s + m.totalArchived, 0);
  }

  /**
   * Total compressed size of all archive batches (bytes).
   */
  totalSize(): number {
    return this.listArchives().reduce((s, m) => s + m.compressedSize, 0);
  }

  /**
   * Update the index file with a new manifest.
   */
  private _updateIndex(manifest: ArchiveManifest): void {
    const indexFile = path.join(this.archiveDir, 'index.json');
    const existing = this.listArchives();
    existing.push(manifest);
    // Write index without full entries to keep it small
    const strippedManifests = existing.map(m => ({
      ...m,
      entries: [], // don't store full entries in index
    }));
    fs.writeFileSync(indexFile, JSON.stringify(strippedManifests, null, 2));
  }

  /**
   * Rebuild the index by scanning archive files on disk.
   */
  private _rebuildIndex(): void {
    const indexFile = path.join(this.archiveDir, 'index.json');
    if (!fs.existsSync(this.archiveDir)) {
      if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);
      return;
    }

    const files = fs.readdirSync(this.archiveDir)
      .filter(f => f.startsWith('archive_') && f.endsWith('.json.gz'));

    const manifests: ArchiveManifest[] = [];
    for (const file of files) {
      const filepath = path.join(this.archiveDir, file);
      try {
        const compressed = fs.readFileSync(filepath);
        const jsonStr = zlib.gunzipSync(compressed).toString('utf-8');
        const m = JSON.parse(jsonStr) as ArchiveManifest;
        manifests.push({ ...m, entries: [] });
      } catch {
        // Skip corrupted archives
      }
    }

    fs.writeFileSync(indexFile, JSON.stringify(manifests, null, 2));
  }
}
