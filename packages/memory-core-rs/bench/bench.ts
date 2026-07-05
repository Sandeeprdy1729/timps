#!/usr/bin/env node
// ── TIMPS memory-core-rs — Native Rust vs TypeScript Micro-Benchmark ──
// Usage:
//   Build native first:  cd packages/memory-core-rs && npm run build
//   Then run:            npx tsx bench/bench.ts   (from packages/memory-core-rs/)

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _require = createRequire(import.meta.url);

// ── Synthetic memory entries ──
// Use 500 = production max (semantic.json is trimmed to 500 entries in both TS and Rust)
const ENTRY_COUNT = parseInt(process.env['BENCH_ENTRIES'] ?? '500', 10);
const entries = Array.from({ length: ENTRY_COUNT }, (_, i) => ({
  id: `fact_${i}`,
  timestamp: Date.now() - i * 1000,
  type: (['fact', 'pattern', 'error', 'architecture'] as const)[i % 4],
  content: `Memory entry ${i}: TypeScript React hooks patterns best practices for ${
    ['hooks', 'async', 'state', 'performance'][i % 4]
  } development workflow`,
  tags: [`tag${i % 10}`, `category${i % 5}`, `type${i % 3}`],
  score: Math.random(),
}));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timps-bench-'));
fs.writeFileSync(path.join(tmpDir, 'semantic.json'), JSON.stringify(entries, null, 2));
const benchEpisodes: any[] = [];
for (let i = 0; i < 50; i++) {
  benchEpisodes.push({ id: `ep_${i}`, timestamp: Date.now(), summary: `session ${i}`, outcome: 'success' });
}
fs.writeFileSync(path.join(tmpDir, 'episodes.json'), JSON.stringify(benchEpisodes));

const QUERY = 'TypeScript async hooks patterns';
const ITERS = 500;

// ── Benchmark runner ──
function bench(label: string, iters: number, fn: () => unknown): number {
  for (let i = 0; i < 20; i++) fn(); // warmup
  const start = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const elapsed = performance.now() - start;
  const usPerOp = (elapsed / iters) * 1000;
  const marker = usPerOp < 10 ? '🟢' : usPerOp < 100 ? '🟡' : '🔴';
  console.log(`  ${marker} ${label.padEnd(44)} ${iters}× → ${elapsed.toFixed(1).padStart(7)}ms  (${usPerOp.toFixed(1)}µs/op)`);
  return elapsed;
}

// ── TypeScript implementations (mirrors memory-core) ──
function tsProjectHash(p: string): string {
  return crypto.createHash('sha256').update(path.resolve(p)).digest('hex').slice(0, 12);
}

function tsLoadSemantic(dir: string): unknown[] {
  try {
    const f = path.join(dir, 'semantic.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8')) as unknown[];
  } catch { /* */ }
  return [];
}

function tsLoadEpisodes(dir: string, count: number): unknown[] {
  try {
    const f = path.join(dir, 'episodes.json');
    if (!fs.existsSync(f)) return [];
    const all = JSON.parse(fs.readFileSync(f, 'utf-8')) as unknown[];
    return all.slice(-count).reverse();
  } catch { return []; }
}

function tsJaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / (setA.size + setB.size - inter);
}

function tsSearchEntries(pool: unknown[], query: string, limit: number): unknown[] {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return pool.slice(0, limit);
  const scored = pool.map(e => {
    const entry = e as { content: string; tags: string[]; type: string };
    let score = 0;
    const content = entry.content.toLowerCase();
    for (const w of words) {
      score += (content.match(new RegExp(w, 'g'))?.length ?? 0) * 2;
      for (const t of entry.tags) if (t.toLowerCase().includes(w)) score += 1;
      if (entry.type.toLowerCase().includes(w)) score += 0.5;
    }
    return { score, entry: e };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(x => x.entry);
}

// ── Run benchmarks ──
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  TIMPS memory-core-rs — Native Rust vs TypeScript Benchmark');
console.log('══════════════════════════════════════════════════════════════\n');
console.log(`  Entries: ${ENTRY_COUNT}  |  Iterations: ${ITERS}  |  Query: "${QUERY}"\n`);

console.log('┌─ TypeScript (baseline) ────────────────────────────────────┐');
const tsHash = bench('projectHash', ITERS * 4, () => tsProjectHash(tmpDir));
const tsLoad = bench(`loadSemantic (${ENTRY_COUNT} entries)`, ITERS, () => tsLoadSemantic(tmpDir));
const tsEp   = bench('loadEpisodes (50 lines)', ITERS, () => tsLoadEpisodes(tmpDir, 20));
const tsJacc = bench('jaccardSimilarity', ITERS * 4, () =>
  tsJaccard('TypeScript React hooks async state', 'hooks state async TypeScript patterns'));
const tsSearch = bench(`searchEntries (${ENTRY_COUNT} entries)`, ITERS, () =>
  tsSearchEntries(entries, QUERY, 10));
console.log('└────────────────────────────────────────────────────────────┘\n');

// ── Native addon ──
// Storage/search native benchmarks (projectHash, loadSemantic, loadEpisodes,
// jaccardSimilarity, searchEntries) were removed because the Rust addon
// doesn't export them — only computeBatchSimilarity, kmeansClusterFlat,
// eigenmodeWarmStart and RustLsh are implemented (see H18 audit).
// Re-add native benchmarks here once the storage/search functions are
// implemented in Rust, with corresponding TS baselines above.
console.log('  ⚠️  No native benchmarks — Rust addon only exposes compute/LSH functions.\n');

// Cleanup
fs.rmSync(tmpDir, { recursive: true });
console.log('✓ Benchmark complete\n');
