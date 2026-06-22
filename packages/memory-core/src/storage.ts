// ── @timps/memory-core — File Storage Layer ──
// Stores 3 layers of memory to ~/.timps/memory/<projectHash>/
//
// All file I/O goes through the FileBackend for WAL-based crash safety.
// Forge layers should import StorageBackend and use it directly.

import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type { MemoryEntry, EpisodicEntry, WorkingState, MemoryScope } from './types.js';
import { getNative } from './native.js';
import { FileBackend, type StorageBackend } from './backends/index.js';

const TIMPS_DIR = path.join(os.homedir(), '.timps');
const MAX_SEMANTIC = 500;
const MAX_EPISODES = 100;
const MAX_WORKING_FILES = 20;
const MAX_WORKING_ERRORS = 10;
const MAX_WORKING_PATTERNS = 20;

/** Global FileBackend instances by base dir (shared across all forges) */
const _backends = new Map<string, StorageBackend>();

/** Get or create a FileBackend for a given base directory. */
export function getBackend(baseDir: string): StorageBackend {
  let backend = _backends.get(baseDir);
  if (!backend) {
    backend = new FileBackend({ baseDir });
    _backends.set(baseDir, backend);
  }
  return backend;
}

export function projectHash(projectPath: string): string {
  return crypto.createHash('sha256').update(path.resolve(projectPath)).digest('hex').slice(0, 12);
}

export function memoryDir(projectPath: string, scope?: MemoryScope): string {
  const hash = projectHash(projectPath);
  const scopeSeg = scope ? `_${scope.userId ?? ''}_${scope.teamId ?? ''}` : '';
  const dir = path.join(TIMPS_DIR, 'memory', `${hash}${scopeSeg}`);
  const backend = getBackend(dir);
  // Ensure directory exists (via a no-op write to a dummy key to trigger mkdir)
  backend.write('.init', true);
  return dir;
}

export function snapshotDir(projectPath: string): string {
  const dir = path.join(TIMPS_DIR, 'snapshots', projectHash(projectPath));
  const backend = getBackend(dir);
  backend.write('.init', true);
  return dir;
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

// ── Working memory ──

export function loadWorking(dir: string): WorkingState {
  const backend = getBackend(dir);
  return backend.read('working.json') ?? { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
}

export function saveWorking(dir: string, state: WorkingState): void {
  const backend = getBackend(dir);
  backend.write('working.json', state);
}

// ── Episodic memory (JSON array) ──

export function appendEpisode(dir: string, episode: EpisodicEntry): void {
  const backend = getBackend(dir);
  const episodes: EpisodicEntry[] = backend.read('episodes.json') ?? [];
  episodes.push(episode);
  const trimmed = episodes.length > MAX_EPISODES ? episodes.slice(-MAX_EPISODES) : episodes;
  backend.write('episodes.json', trimmed);
}

export function loadEpisodes(dir: string, count = 10): EpisodicEntry[] {
  const backend = getBackend(dir);
  const episodes: EpisodicEntry[] = backend.read('episodes.json') ?? [];
  return episodes.slice(-count);
}

export function episodeCount(dir: string): number {
  const backend = getBackend(dir);
  const episodes: EpisodicEntry[] = backend.read('episodes.json') ?? [];
  return episodes.length;
}

// ── Semantic memory ──

export function loadSemantic(dir: string): MemoryEntry[] {
  const backend = getBackend(dir);
  return backend.read('semantic.json') ?? [];
}

export function saveSemantic(dir: string, entries: MemoryEntry[]): void {
  const trimmed = entries.length > MAX_SEMANTIC ? entries.slice(-MAX_SEMANTIC) : entries;
  const backend = getBackend(dir);
  backend.write('semantic.json', trimmed);
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
