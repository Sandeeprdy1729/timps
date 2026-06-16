// ── @timps/memory-core — L10: EngramLog ──
// Immutable, hash-chained audit log for every memory operation.
// Prevents reconsolidation corruption by making all writes append-only and verifiable.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from './storage.js';

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

export class EngramLog {
  private filePath: string;
  private lastHash: string = '0'.repeat(64);
  private index: number = 0;

  constructor(private dir: string) {
    this.filePath = path.join(dir, 'engram.log.jsonl');
    this.recover();
  }

  private recover(): void {
    if (!fs.existsSync(this.filePath)) return;
    const content = fs.readFileSync(this.filePath, 'utf-8').trim();
    if (!content) return;
    const lines = content.split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as EngramEntry;
    this.lastHash = last.hash;
    this.index = last.index + 1;
  }

  append(input: Omit<EngramEntry, 'hash' | 'index' | 'prevHash'>): EngramEntry {
    const body: Omit<EngramEntry, 'hash'> = {
      ...input,
      index: this.index,
      prevHash: this.lastHash,
    };
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    const entry: EngramEntry = { ...body, hash };
    fs.appendFileSync(this.filePath, JSON.stringify(entry) + '\n', 'utf-8');
    this.lastHash = hash;
    this.index += 1;
    return entry;
  }

  verifyChain(): { valid: boolean; brokenAt?: number } {
    if (!fs.existsSync(this.filePath)) return { valid: true };
    const content = fs.readFileSync(this.filePath, 'utf-8').trim();
    if (!content) return { valid: true };
    const lines = content.split('\n');
    let prev = '0'.repeat(64);
    for (const line of lines) {
      const e = JSON.parse(line) as EngramEntry;
      if (e.prevHash !== prev) return { valid: false, brokenAt: e.index };
      const { hash: _h, ...rest } = e;
      const recomputed = crypto
        .createHash('sha256')
        .update(JSON.stringify(rest))
        .digest('hex');
      if (recomputed !== e.hash) return { valid: false, brokenAt: e.index };
      prev = e.hash;
    }
    return { valid: true };
  }

  query(filter: Partial<EngramEntry>, limit = 100): EngramEntry[] {
    const out: EngramEntry[] = [];
    if (!fs.existsSync(this.filePath)) return out;
    const content = fs.readFileSync(this.filePath, 'utf-8').trim();
    if (!content) return out;
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      const e = JSON.parse(lines[i]) as EngramEntry;
      if (Object.entries(filter).every(([k, v]) => e[k as keyof EngramEntry] === v)) {
        out.push(e);
      }
    }
    return out;
  }

  entryCount(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    const content = fs.readFileSync(this.filePath, 'utf-8').trim();
    if (!content) return 0;
    return content.split('\n').length;
  }

  getLastHash(): string {
    return this.lastHash;
  }
}
