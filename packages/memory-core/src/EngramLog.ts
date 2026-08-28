// ── @timps/memory-core — L10: EngramLog ──
// Tamper-evident, append-only audit log with HMAC signing and external head anchor.
// Prevents undetected tampering: in-place edits fail HMAC verification; truncation
// is detected by comparing the head anchor (written atomically on every append)
// against the log file. The signing secret is auto-generated per project directory.
//
// M50: The log formerly rewrote the ENTIRE log on every append through backend
// read-modify-write keys, giving O(N²) total I/O with no bound. The backend path
// now maintains the log as bounded _segments_: the active segment lives in one
// key (rewritten per append, capped at SEGMENT_CAP entries) and filled segments
// are rotated into `engram/engram.archive.{seq}.jsonl`. Per-append cost is bounded
// by SEGMENT_CAP, and every append re-derives the tail (index + previous hash)
// from the persisted head anchor instead of an in-memory cursor, so concurrent
// engines sharing one backend keep a single linear hash chain.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from './backends/types.js';

export type EngramOp =
  | 'store' | 'retrieve' | 'update' | 'delete'
  | 'contradict' | 'verify' | 'supersede' | 'archive';

export interface EngramEntry {
  index: number;
  timestamp: number;
  op: EngramOp;
  layerId: string;
  entryId: string;
  actorId: string;
  prevHash: string;
  payload: unknown;
  justification: string;
  hash: string;
}

/** Max entries held in the active segment. When exceeded, the segment rotates. */
export const ENGRAM_SEGMENT_CAP = 512;
const EMPTY_HASH = '0'.repeat(64);

const BACKEND_ANCHOR_KEY = 'engram/engram.head.json';
const BACKEND_CURRENT_KEY = 'engram/engram.log.jsonl';
const BACKEND_ARCHIVE_PREFIX = 'engram/engram.archive.';
const BACKEND_ARCHIVE_SUFFIX = '.json';

function archiveKey(seq: number): string {
  return `${BACKEND_ARCHIVE_PREFIX}${String(seq).padStart(6, '0')}${BACKEND_ARCHIVE_SUFFIX}`;
}

function readFileSafe(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

function writeAtomic(p: string, data: string): void {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, data, 'utf-8');
  fs.fsyncSync(fs.openSync(tmp, 'r'));
  fs.renameSync(tmp, p);
}

function createHmac(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

interface AnchorState {
  index: number;
  hash: string;
  archived: number;
}

function parseAnchor(raw: string | object | null | undefined): AnchorState | null {
  if (raw === null || raw === undefined) return null;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (obj === null || typeof obj !== 'object') return null;
  // Canonical shape: { index, hash, archived }
  if (typeof obj.index === 'number' && typeof obj.hash === 'string') {
    return { index: obj.index, hash: obj.hash, archived: typeof obj.archived === 'number' ? obj.archived : 0 };
  }
  // Legacy shape: { lastHash, lastIndex }
  if (typeof obj.lastIndex === 'number' && typeof obj.lastHash === 'string') {
    return { index: obj.lastIndex, hash: obj.lastHash, archived: 0 };
  }
  return null;
}

function isEntry(e: unknown): e is EngramEntry {
  return !!e && typeof (e as EngramEntry).index === 'number';
}

export class EngramLog {
  private _backend?: StorageBackend;
  private filePath: string;
  private headAnchorPath: string;
  private secretPath: string;
  private lastHash: string = EMPTY_HASH;
  private index: number = 0;
  private _secret: string;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.filePath = path.join(dir, 'engram.log.jsonl');
    this.headAnchorPath = path.join(dir, 'engram.head.json');
    this.secretPath = path.join(dir, 'engram.secret');
    this._secret = this._getOrCreateSecret();
    this.recover();
  }

  private _getOrCreateSecret(): string {
    if (this._backend) {
      const existing = this._backend.read('engram/engram.secret');
      if (typeof existing === 'string' && existing) return existing.trim();
      const secret = crypto.randomBytes(32).toString('hex');
      this._backend.write('engram/engram.secret', secret);
      return secret;
    }
    const existing = readFileSafe(this.secretPath);
    if (existing) return existing.trim();
    const secret = crypto.randomBytes(32).toString('hex');
    writeAtomic(this.secretPath, secret + '\n');
    return secret;
  }

  // ── Head anchor ──

  private _readAnchor(): AnchorState | null {
    if (this._backend) {
      return parseAnchor(this._backend.read(BACKEND_ANCHOR_KEY));
    }
    return parseAnchor(readFileSafe(this.headAnchorPath));
  }

  private _writeAnchor(state: AnchorState): void {
    const data = JSON.stringify(state);
    if (this._backend) {
      this._backend.write(BACKEND_ANCHOR_KEY, data);
    } else {
      writeAtomic(this.headAnchorPath, data);
    }
  }

  // ── Segment read/write (backend path) ──

  private _normalizeSegment(value: unknown): EngramEntry[] {
    if (value === null || value === undefined) return [];
    let parts: unknown[];
    if (Array.isArray(value)) {
      parts = value;
    } else if (typeof value === 'string') {
      const t = value.trim();
      if (!t) return [];
      parts = t.split('\n');
    } else {
      parts = [value];
    }
    const out: EngramEntry[] = [];
    for (const part of parts) {
      try {
        const e = typeof part === 'string' ? JSON.parse(part) : part;
        if (isEntry(e)) out.push(e);
      } catch { /* skip malformed line */ }
    }
    return out;
  }

  private _readSegment(key: string): EngramEntry[] {
    if (!this._backend) return [];
    return this._normalizeSegment(this._backend.read(key));
  }

  private _writeSegment(key: string, entries: EngramEntry[]): void {
    if (this._backend) this._backend.write(key, entries);
  }

  private _numArchived(): number {
    const st = this._readAnchor();
    if (st && st.archived > 0) return st.archived;
    if (!this._backend) return 0;
    const keys = (this._backend.list('engram/') as string[]) ?? [];
    let max = -1;
    for (const k of keys) {
      const m = /engram\.archive\.(\d+)\.json$/.exec(k);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }

  /** Oldest-first entries across archived segments + the active segment. */
  private _readAllSegments(): EngramEntry[] {
    if (!this._backend) return this._fileEntries();
    const out: EngramEntry[] = [];
    const archived = this._numArchived();
    for (let s = 0; s < archived; s++) out.push(...this._readSegment(archiveKey(s)));
    out.push(...this._readSegment(BACKEND_CURRENT_KEY));
    return out;
  }

  /** Newest-first entries (query order) across all segments. */
  private *_readSegmentsNewestFirst(): Generator<EngramEntry> {
    if (this._backend) {
      const archived = this._numArchived();
      const current = this._readSegment(BACKEND_CURRENT_KEY);
      for (let i = current.length - 1; i >= 0; i--) yield current[i];
      for (let s = archived - 1; s >= 0; s--) {
        const seg = this._readSegment(archiveKey(s));
        for (let i = seg.length - 1; i >= 0; i--) yield seg[i];
      }
      return;
    }
    const entries = this._fileEntries();
    for (let i = entries.length - 1; i >= 0; i--) yield entries[i];
  }

  // ── File (no-backend) helpers ──

  private _fileEntries(): EngramEntry[] {
    const content = readFileSafe(this.filePath);
    if (!content) return [];
    const trimmed = content.trim();
    if (!trimmed) return [];
    const out: EngramEntry[] = [];
    for (const line of trimmed.split('\n')) {
      try {
        const e = JSON.parse(line) as EngramEntry;
        if (isEntry(e)) out.push(e);
      } catch { /* skip malformed line */ }
    }
    return out;
  }

  /** Recover state from the persisted log + head anchor.
   *  If the anchor's hash/index doesn't match the log's last valid entry,
   *  the log may have been truncated — we still recover the best entry
   *  from the file itself (best-effort), but the mismatch is detectable
   *  via verifyChain(). */
  private recover(): void {
    const anchor = this._readAnchor();
    if (anchor) {
      this.lastHash = anchor.hash;
      this.index = anchor.index + 1;
      // One-time migration: an oversized legacy active segment gets rotated
      // into bounded archives so future appends stay O(SEGMENT_CAP).
      if (this._backend) this._splitOversizedSegment(anchor.archived);
      return;
    }
    const entries = this._readAllSegments();
    const tail = entries[entries.length - 1];
    if (tail) {
      this.lastHash = tail.hash;
      this.index = tail.index + 1;
    }
  }

  private _splitOversizedSegment(archivedBase: number): void {
    const cur = this._readSegment(BACKEND_CURRENT_KEY);
    if (cur.length <= ENGRAM_SEGMENT_CAP) return;
    let archived = archivedBase;
    let offset = 0;
    while (cur.length - offset > ENGRAM_SEGMENT_CAP) {
      const batch = cur.slice(offset, offset + ENGRAM_SEGMENT_CAP);
      this._writeSegment(archiveKey(archived), batch);
      archived++;
      offset += ENGRAM_SEGMENT_CAP;
    }
    const tail = cur.slice(offset);
    this._writeSegment(BACKEND_CURRENT_KEY, tail);
    const last = tail[tail.length - 1];
    if (last) this._writeAnchor({ index: last.index, hash: last.hash, archived });
  }

  /**
   * Derive the current head from the persisted anchor fresh (never from a
   * possibly-stale in-memory stamp), so concurrent engines sharing a backend
   * keep a single linear hash chain.
   */
  private _deriveHead(): AnchorState {
    const st = this._readAnchor();
    if (st) return st;
    const entries = this._readAllSegments();
    const tail = entries[entries.length - 1];
    if (tail) return { index: tail.index, hash: tail.hash, archived: this._numArchived() };
    return { index: -1, hash: EMPTY_HASH, archived: 0 };
  }

  append(input: Omit<EngramEntry, 'hash' | 'index' | 'prevHash'>): EngramEntry {
    const head = this._deriveHead();
    const body: Omit<EngramEntry, 'hash'> = {
      ...input,
      index: head.index + 1,
      prevHash: head.hash,
    };
    const hash = createHmac(this._secret, JSON.stringify(body));
    const entry: EngramEntry = { ...body, hash };

    if (this._backend) {
      let archived = head.archived;
      const current = this._readSegment(BACKEND_CURRENT_KEY);
      if (current.length >= ENGRAM_SEGMENT_CAP) {
        // Rotate: archive the full segment, start a fresh active segment.
        this._writeSegment(archiveKey(archived), current);
        archived += 1;
        this._writeSegment(BACKEND_CURRENT_KEY, [entry]);
      } else {
        current.push(entry);
        this._writeSegment(BACKEND_CURRENT_KEY, current);
      }
      this._writeAnchor({ index: entry.index, hash, archived });
    } else {
      fs.appendFileSync(this.filePath, JSON.stringify(entry) + '\n', 'utf-8');
      this._writeAnchor({ index: entry.index, hash, archived: 0 });
    }

    this.lastHash = hash;
    this.index = entry.index + 1;
    return entry;
  }

  /** Verify the hash chain integrity.
   *  Returns brokenAt = -1 when truncation is detected (head anchor mismatch).
   *  Returns brokenAt = entry.index when an entry fails HMAC or chain-link check. */
  verifyChain(): { valid: boolean; brokenAt?: number } {
    const entries = this._readAllSegments();
    let prev = EMPTY_HASH;
    let lastValidEntry: EngramEntry | null = null;
    for (const e of entries) {
      if (e.prevHash !== prev) return { valid: false, brokenAt: e.index };
      const { hash: _h, ...rest } = e;
      if (createHmac(this._secret, JSON.stringify(rest)) !== e.hash) return { valid: false, brokenAt: e.index };
      prev = e.hash;
      lastValidEntry = e;
    }
    // Truncation check: compare last entry against the head anchor
    const anchor = this._readAnchor();
    if (anchor && lastValidEntry) {
      if (lastValidEntry.hash !== anchor.hash || lastValidEntry.index !== anchor.index) {
        return { valid: false, brokenAt: -1 };
      }
    }
    return { valid: true };
  }

  query(filter: Partial<EngramEntry>, limit = 100): EngramEntry[] {
    const out: EngramEntry[] = [];
    for (const e of this._readSegmentsNewestFirst()) {
      if (Object.entries(filter).every(([k, v]) => e[k as keyof EngramEntry] === v)) {
        out.push(e);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  entryCount(): number {
    const st = this._readAnchor();
    if (st) return st.index + 1;
    return this._readAllSegments().length;
  }

  getLastHash(): string {
    return this.lastHash;
  }
}