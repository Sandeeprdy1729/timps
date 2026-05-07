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
for (let i = 0; i < 50; i++) {
  fs.appendFileSync(
    path.join(tmpDir, 'episodes.jsonl'),
    JSON.stringify({ id: `ep_${i}`, timestamp: Date.now(), summary: `session ${i}`, outcome: 'success' }) + '\n',
  );
}

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
    const f = path.join(dir, 'episodes.jsonl');
    if (!fs.existsSync(f)) return [];
    const lines = fs.readFileSync(f, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.slice(-count).map(l => JSON.parse(l)).reverse();
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

// ── Try native ──
interface NativeCore {
  projectHash(p: string): string;
  loadSemantic(dir: string): string;
  loadEpisodes(dir: string, count: number): string;
  jaccardSimilarity(a: string, b: string): number;
  searchEntries(json: string, query: string, limit: number): string;
}

let native: NativeCore | null = null;

const candidatePaths = [
  path.join(__dirname, '..', `memory-core-rs.darwin-${process.arch === 'arm64' ? 'arm64' : 'x64'}.node`),
  path.join(__dirname, '..', `memory-core-rs.linux-${process.arch}-gnu.node`),
  path.join(__dirname, '..', `memory-core-rs.win32-x64-msvc.node`),
];

for (const p of candidatePaths) {
  try {
    native = _require(p) as NativeCore;
    console.log(`  ✓ Loaded native addon: ${path.basename(p)}\n`);
    break;
  } catch { /* try next */ }
}

if (!native) {
  console.log('  ⚠️  Native addon not yet built.');
  console.log('     Run:  cd packages/memory-core-rs && npm run build');
  console.log('     Then re-run this benchmark to see the speedup.\n');
} else {
  const entriesJson = JSON.stringify(entries);
  const A = 'TypeScript React hooks async state';
  const B = 'hooks state async TypeScript patterns';

  console.log('┌─ Rust native addon ────────────────────────────────────────┐');
  const rsHash   = bench('projectHash', ITERS * 4, () => native!.projectHash(tmpDir));
  const rsLoad   = bench(`loadSemantic (${ENTRY_COUNT} entries)`, ITERS, () => native!.loadSemantic(tmpDir));
  const rsEp     = bench('loadEpisodes (50 lines)', ITERS, () => native!.loadEpisodes(tmpDir, 20));
  const rsJacc   = bench('jaccardSimilarity', ITERS * 4, () => native!.jaccardSimilarity(A, B));
  const rsSearch = bench(`searchEntries (${ENTRY_COUNT} entries)`, ITERS, () =>
    native!.searchEntries(entriesJson, QUERY, 10));
  console.log('└────────────────────────────────────────────────────────────┘\n');

  const spd = (ts: number, rs: number) => (ts / rs).toFixed(1) + '×';
  console.log('┌─ Speedup ──────────────────────────────────────────────────┐');
  console.log(`  projectHash:        ${spd(tsHash, rsHash).padStart(6)}`);
  console.log(`  loadSemantic:       ${spd(tsLoad, rsLoad).padStart(6)}`);
  console.log(`  loadEpisodes:       ${spd(tsEp, rsEp).padStart(6)}`);
  console.log(`  jaccardSimilarity:  ${spd(tsJacc, rsJacc).padStart(6)}`);
  console.log(`  searchEntries:      ${spd(tsSearch, rsSearch).padStart(6)}`);
  console.log('└────────────────────────────────────────────────────────────┘\n');
}

// Cleanup
fs.rmSync(tmpDir, { recursive: true });
console.log('✓ Benchmark complete\n');
