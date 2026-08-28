// ── @timps/memory-core — Migration v1 → v2 ──
// Converts episodes.jsonl (newline-delimited JSON) → episodes.json (JSON array).
// This addresses the format divergence introduced by the Rust native addon in
// Phase 1b — the TS backend writes JSON arrays, but the native addon wrote JSONL.
// Existing users with episodes.jsonl on disk get their data converted.
//
// Also cleans up stale .wal files for episodes and removes episodes.jsonl.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Migration } from './types.js';
import type { StorageBackend } from '../backends/types.js';

export const v1_to_v2: Migration = {
  version: 2,
  description: 'episodes JSONL → JSON array, cleanup stale files',
  run(dir: string, _backend: StorageBackend): void {
    const jsonlPath = path.join(dir, 'episodes.jsonl');
    const jsonPath = path.join(dir, 'episodes.json');

    // Read JSONL, convert to JSON array
    if (fs.existsSync(jsonlPath)) {
      try {
        const content = fs.readFileSync(jsonlPath, 'utf-8').trim();
        const episodes: any[] = content
          ? content.split('\n')
            .filter(l => l.trim())
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean)
          : [];

        // Merge with any existing episodes.json (from backend writes)
        if (fs.existsSync(jsonPath)) {
          try {
            const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            if (Array.isArray(existing)) {
              existing.push(...episodes);
              const trimmed = existing.length > 100 ? existing.slice(-100) : existing;
              fs.writeFileSync(jsonPath, JSON.stringify(trimmed), 'utf-8');
              fs.rmSync(jsonlPath, { force: true });
              return;
            }
          } catch { /* ignore corrupt json */ }
        }

        // Write as JSON array (even if empty)
        const trimmed = episodes.length > 100 ? episodes.slice(-100) : episodes;
        fs.writeFileSync(jsonPath, JSON.stringify(trimmed), 'utf-8');
        fs.rmSync(jsonlPath, { force: true });
      } catch { /* best effort — don't block startup */ }
    }

    // Clean up any stale .wal files
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.wal')) {
          fs.rmSync(path.join(dir, entry.name), { force: true });
        }
      }
    } catch { /* ignore */ }
  },
};
