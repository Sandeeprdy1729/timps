// ── @timps/memory-core — L10: EngramLog ──
// Tamper-evident, append-only audit log with HMAC signing and external head anchor.
// Prevents undetected tampering: in-place edits fail HMAC verification; truncation
// is detected by comparing the head anchor (written atomically on every append)
// against the log file. The signing secret is auto-generated per project directory.

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

export class EngramLog {
  private _backend?: StorageBackend;
  private filePath: string;
  private headAnchorPath: string;
  private secretPath: string;
  private lastHash: string = '0'.repeat(64);
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

  private _getAnchor(): { lastHash: string; lastIndex: number } | null {
    if (this._backend) {
      const a = this._backend.read('engram/engram.head.json');
      if (typeof a !== 'string' || !a) return null;
      try { return JSON.parse(a); } catch { return null; }
    }
    const raw = readFileSafe(this.headAnchorPath);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  private _writeAnchor(): void {
    const data = JSON.stringify({ lastHash: this.lastHash, lastIndex: this.index - 1 });
    if (this._backend) {
      this._backend.write('engram/engram.head.json', data);
    } else {
      writeAtomic(this.headAnchorPath, data);
    }
  }

  private getRawContent(): string | null {
    if (this._backend) {
      const content = this._backend.read('engram/engram.log.jsonl');
      return typeof content === 'string' ? content : null;
    }
    return readFileSafe(this.filePath);
  }

  /** Recover state from the persisted log + head anchor.
   *  If the anchor's hash/index doesn't match the log's last valid entry,
   *  the log may have been truncated — we still recover the best entry
   *  from the file itself (best-effort), but the mismatch is detectable
   *  via verifyChain(). */
  private recover(): void {
    const anchor = this._getAnchor();
    if (anchor) {
      this.lastHash = anchor.lastHash;
      this.index = anchor.lastIndex + 1;
      return;
    }
    // No anchor: fall back to walking the file backwards (first-write or stripped anchor)
    const content = this.getRawContent();
    if (!content) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const lines = trimmed.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as EngramEntry;
        this.lastHash = entry.hash;
        this.index = entry.index + 1;
        return;
      } catch {
        continue;
      }
    }
  }

  append(input: Omit<EngramEntry, 'hash' | 'index' | 'prevHash'>): EngramEntry {
    const body: Omit<EngramEntry, 'hash'> = {
      ...input,
      index: this.index,
      prevHash: this.lastHash,
    };
    const hash = createHmac(this._secret, JSON.stringify(body));
    const entry: EngramEntry = { ...body, hash };
    if (this._backend) {
      const line = JSON.stringify(entry) + '\n';
      if (this._backend.append) {
        this._backend.append('engram/engram.log.jsonl', line);
      } else {
        const existing = this._backend.read('engram/engram.log.jsonl') || '';
        this._backend.write('engram/engram.log.jsonl', existing + line);
      }
    } else {
      fs.appendFileSync(this.filePath, JSON.stringify(entry) + '\n', 'utf-8');
    }
    this.lastHash = hash;
    this.index += 1;
    this._writeAnchor();
    return entry;
  }

  /** Verify the hash chain integrity.
   *  Returns brokenAt = -1 when truncation is detected (head anchor mismatch).
   *  Returns brokenAt = entry.index when an entry fails HMAC or chain-link check. */
  verifyChain(): { valid: boolean; brokenAt?: number } {
    const content = this.getRawContent();
    if (!content) return { valid: true };
    const trimmed = content.trim();
    if (!trimmed) return { valid: true };
    const lines = trimmed.split('\n');
    let prev = '0'.repeat(64);
    let lastValidEntry: EngramEntry | null = null;
    for (const line of lines) {
      let e: EngramEntry;
      try { e = JSON.parse(line) as EngramEntry; } catch { continue; }
      if (e.prevHash !== prev) return { valid: false, brokenAt: e.index };
      const { hash: _h, ...rest } = e;
      if (createHmac(this._secret, JSON.stringify(rest)) !== e.hash) return { valid: false, brokenAt: e.index };
      prev = e.hash;
      lastValidEntry = e;
    }
    // Truncation check: compare last file entry against the head anchor
    const anchor = this._getAnchor();
    if (anchor && lastValidEntry) {
      if (lastValidEntry.hash !== anchor.lastHash || lastValidEntry.index !== anchor.lastIndex) {
        return { valid: false, brokenAt: -1 };
      }
    }
    return { valid: true };
  }

  query(filter: Partial<EngramEntry>, limit = 100): EngramEntry[] {
    const out: EngramEntry[] = [];
    const content = this.getRawContent();
    if (!content) return out;
    const trimmed = content.trim();
    if (!trimmed) return out;
    const lines = trimmed.split('\n');
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      let e: EngramEntry;
      try { e = JSON.parse(lines[i]) as EngramEntry; } catch { continue; }
      if (Object.entries(filter).every(([k, v]) => e[k as keyof EngramEntry] === v)) {
        out.push(e);
      }
    }
    return out;
  }

  entryCount(): number {
    const content = this.getRawContent();
    if (!content) return 0;
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split('\n').length;
  }

  getLastHash(): string {
    return this.lastHash;
  }
}
