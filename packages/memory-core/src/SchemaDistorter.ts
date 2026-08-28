// ── @timps/memory-core — L21: SchemaDistorter ──
// Detects when memory has been reconstructed to fit an existing schema
// rather than reflecting the original observation. Implements the Bartlett
// "War of the Ghosts" insight: memory bends to fit worldview.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from './backends/types.js';

export interface SchemaEntry {
  id: string;
  pattern: string;
  exampleCount: number;
  firstSeen: number;
  lastSeen: number;
}

export interface DistortionCheck {
  entryId: string;
  originalContent: string;
  schemaPattern: string;
  distortionScore: number;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
}

export class SchemaDistorter {
  private _backend?: StorageBackend;
  private schemas: SchemaEntry[] = [];
  private schemaFile: string;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.schemaFile = path.join(dir, 'schema-patterns.json');
    this.load();
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read('schema/distorter.json');
        if (data) this.schemas = data;
      } else if (fs.existsSync(this.schemaFile)) {
        this.schemas = JSON.parse(fs.readFileSync(this.schemaFile, 'utf-8'));
      }
    } catch { this.schemas = []; }
  }

  private save(): void {
    if (this._backend) {
      this._backend.write('schema/distorter.json', this.schemas);
    } else {
      fs.writeFileSync(this.schemaFile, JSON.stringify(this.schemas, null, 2), 'utf-8');
    }
  }

  learn(content: string): void {
    const pattern = this.extractPattern(content);
    if (!pattern) return;

    const existing = this.schemas.find(s => s.pattern === pattern);
    if (existing) {
      existing.exampleCount++;
      existing.lastSeen = Date.now();
    } else {
      this.schemas.push({
        id: crypto.randomBytes(6).toString('hex'),
        pattern,
        exampleCount: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      });
    }
    if (this.schemas.length > 100) this.schemas = this.schemas.slice(-100);
    this.save();
  }

  check(content: string): DistortionCheck | null {
    const pattern = this.extractPattern(content);
    if (!pattern) return null;

    for (const schema of this.schemas) {
      if (schema.pattern === pattern && schema.exampleCount > 2) {
        const schemaWords = schema.pattern.split(/\s+/).length;
        const overlap = pattern.split(/\s+/).filter(w => schema.pattern.includes(w)).length;
        const distortionScore = schemaWords > 0 ? overlap / schemaWords : 0;

        if (distortionScore > 0.6) {
          const severity: 'low' | 'medium' | 'high' =
            distortionScore > 0.85 ? 'high' : distortionScore > 0.7 ? 'medium' : 'low';
          return {
            entryId: crypto.randomBytes(6).toString('hex'),
            originalContent: content.slice(0, 200),
            schemaPattern: schema.pattern,
            distortionScore,
            severity,
            explanation: `Memory matches schema "${schema.pattern.slice(0, 60)}" (${schema.exampleCount} examples) with ${(distortionScore * 100).toFixed(0)}% overlap`,
          };
        }
      }
    }
    return null;
  }

  private extractPattern(content: string): string | null {
    const words = content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 8);
    if (words.length < 3) return null;
    return words.join(' ');
  }

  getSchemas(): SchemaEntry[] {
    return [...this.schemas];
  }

  prune(minExamples = 1, maxAgeDays = 180): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const before = this.schemas.length;
    this.schemas = this.schemas.filter(s => s.exampleCount >= minExamples && s.lastSeen >= cutoff);
    this.save();
    return before - this.schemas.length;
  }
}
