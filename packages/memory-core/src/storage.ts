// ── @timps/memory-core — File Storage Layer ──
// Stores 3 layers of memory to ~/.timps/memory/<projectHash>/

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type { MemoryEntry, EpisodicEntry, WorkingState, MemoryScope } from './types.js';
import { getNative } from './native.js';

const TIMPS_DIR = path.join(os.homedir(), '.timps');
const MAX_SEMANTIC = 500;
const MAX_EPISODES = 100;
const MAX_WORKING_FILES = 20;
const MAX_WORKING_ERRORS = 10;
const MAX_WORKING_PATTERNS = 20;

export function projectHash(projectPath: string): string {
  // Node.js crypto is already native C++ — no benefit going through NAPI boundary here
  return crypto.createHash('sha256').update(path.resolve(projectPath)).digest('hex').slice(0, 12);
}

export function memoryDir(projectPath: string, scope?: MemoryScope): string {
  const hash = projectHash(projectPath);
  const scopeSeg = scope ? `_${scope.userId ?? ''}_${scope.teamId ?? ''}` : '';
  const dir = path.join(TIMPS_DIR, 'memory', `${hash}${scopeSeg}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function snapshotDir(projectPath: string): string {
  const dir = path.join(TIMPS_DIR, 'snapshots', projectHash(projectPath));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

// ── Working memory ──

export function loadWorking(dir: string): WorkingState {
  const n = getNative();
  if (n) return JSON.parse(n.loadWorking(dir)) as WorkingState;
  try {
    const f = path.join(dir, 'working.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8')) as WorkingState;
  } catch { /* ignore */ }
  return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
}

export function saveWorking(dir: string, state: WorkingState): void {
  const n = getNative();
  if (n) { n.saveWorking(dir, JSON.stringify(state, null, 2)); return; }
  fs.writeFileSync(path.join(dir, 'working.json'), JSON.stringify(state, null, 2), 'utf-8');
}

// ── Episodic memory (append-only JSONL) ──

export function appendEpisode(dir: string, episode: EpisodicEntry): void {
  const n = getNative();
  if (n) { n.appendEpisode(dir, JSON.stringify(episode)); return; }
  const file = path.join(dir, 'episodes.jsonl');
  fs.appendFileSync(file, JSON.stringify(episode) + '\n', 'utf-8');
  trimJsonl(file, MAX_EPISODES);
}

export function loadEpisodes(dir: string, count = 10): EpisodicEntry[] {
  const n = getNative();
  if (n) return JSON.parse(n.loadEpisodes(dir, count)) as EpisodicEntry[];
  try {
    const file = path.join(dir, 'episodes.jsonl');
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
    return lines
      .slice(-count)
      .map(l => { try { return JSON.parse(l) as EpisodicEntry; } catch { return null; } })
      .filter((e): e is EpisodicEntry => e !== null);
  } catch { return []; }
}

export function episodeCount(dir: string): number {
  try {
    const file = path.join(dir, 'episodes.jsonl');
    if (!fs.existsSync(file)) return 0;
    return fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean).length;
  } catch { return 0; }
}

// ── Semantic memory ──

export function loadSemantic(dir: string): MemoryEntry[] {
  const n = getNative();
  if (n) return JSON.parse(n.loadSemantic(dir)) as MemoryEntry[];
  try {
    const f = path.join(dir, 'semantic.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8')) as MemoryEntry[];
  } catch { /* ignore */ }
  return [];
}

export function saveSemantic(dir: string, entries: MemoryEntry[]): void {
  const n = getNative();
  if (n) { n.saveSemantic(dir, JSON.stringify(entries, null, 2)); return; }
  const trimmed = entries.length > MAX_SEMANTIC ? entries.slice(-MAX_SEMANTIC) : entries;
  fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify(trimmed, null, 2), 'utf-8');
}

// ── Working memory helpers ──

export function trackFile(state: WorkingState, filePath: string): WorkingState {
  if (state.activeFiles.includes(filePath)) return state;
  const activeFiles = [...state.activeFiles, filePath];
  return { ...state, activeFiles: activeFiles.length > MAX_WORKING_FILES ? activeFiles.slice(-MAX_WORKING_FILES) : activeFiles };
}

export function trackError(state: WorkingState, error: string): WorkingState {
  const recentErrors = [...state.recentErrors, error.slice(0, 200)];
  return { ...state, recentErrors: recentErrors.length > MAX_WORKING_ERRORS ? recentErrors.slice(-MAX_WORKING_ERRORS) : recentErrors };
}

export function trackPattern(state: WorkingState, pattern: string): WorkingState {
  if (state.discoveredPatterns.includes(pattern)) return state;
  const discoveredPatterns = [...state.discoveredPatterns, pattern];
  return { ...state, discoveredPatterns: discoveredPatterns.length > MAX_WORKING_PATTERNS ? discoveredPatterns.slice(-MAX_WORKING_PATTERNS) : discoveredPatterns };
}

// ── Utilities ──

function trimJsonl(file: string, maxLines: number): void {
  try {
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
    if (lines.length > maxLines) {
      fs.writeFileSync(file, lines.slice(-maxLines).join('\n') + '\n', 'utf-8');
    }
  } catch { /* ignore */ }
}

/** Jaccard similarity on word sets (0–1) */
export function jaccardSimilarity(a: string, b: string): number {
  const n = getNative();
  if (n) return n.jaccardSimilarity(a, b);
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / (setA.size + setB.size - inter);
}
