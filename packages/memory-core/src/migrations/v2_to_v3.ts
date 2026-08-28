// ── @timps/memory-core — Migration v2 → v3 ──
// Adds _meta block to all layer state files found in the backend.
// _meta contains { schemaVersion, layerName, createdAt, migratedAt }.
// Files that already have _meta are skipped.
//
// This gives every file a forward-compat contract — future code can inspect
// _meta.schemaVersion to decide how to parse the rest of the file.

import type { Migration } from './types.js';
import type { StorageBackend } from '../backends/types.js';
import { isPromiseLike } from './async.js';

/** Known layer prefixes → human-readable layer names. */
const LAYER_NAMES: Record<string, string> = {
  echo: 'echo',
  chronos: 'chronos',
  resonance: 'resonance',
  harmonic: 'harmonic_sheaf',
  aether: 'aether_erl',
  eclipse: 'eclipse',
  qptw: 'qptw',
  titanic: 'titanic',
  qerw: 'qerw',
  qisrd: 'qisrd',
  qitrl: 'qitrl',
  causal_sheaf: 'causal_sheaf_flux',
  engram: 'engram_log',
  consolidation: 'consolidation',
  synaptic: 'synaptic_pruner',
  provenance: 'provenance',
  spaced_rep: 'spaced_repetition',
  constitutional: 'constitutional_guard',
  audit: 'audit_forge',
  prospective: 'prospective_trigger',
  bias: 'bias_revealer',
  rehearsal: 'rehearsal',
  context: 'context_vector',
  schema: 'schema_distorter',
  confidence: 'confidence_calibrator',
  contradiction: 'contradiction',
  burnout: 'burnout',
  regret: 'regret',
  tech_debt: 'tech_debt',
  bug_pattern: 'bug_pattern',
  api: 'api',
  velocity: 'velocity',
  architecture: 'architecture',
  pattern: 'pattern_learner',
  meeting: 'meeting_ghost',
  dead_reckoning: 'dead_reckoning',
  manifesto: 'living_manifesto',
  relationship: 'relationship',
  skill: 'skill_shadow',
  curriculum: 'curriculum',
  anthropologist: 'codebase_anthropologist',
  institutional: 'institutional_memory',
};

function inferLayerName(key: string): string {
  for (const [prefix, name] of Object.entries(LAYER_NAMES)) {
    if (key.startsWith(prefix)) return name;
  }
  return 'unknown';
}

/** Keys that should NOT get _meta (core config files). */
const SKIP_KEYS = new Set([
  'schema-version.json',
  '.init',
  'episodes.json',
  'semantic.json',
  'working.json',
  'session-profiles.json',
]);

/** Adds a _meta block to a single layer state file if eligible. */
function transformKey(
  key: string,
  raw: unknown,
  now: string,
): Record<string, unknown> | null {
  if (SKIP_KEYS.has(key)) return null;
  if (key.endsWith('.wal')) return null;

  // Only process files matching a known layer prefix
  const layerName = inferLayerName(key);
  if (layerName === 'unknown') return null;

  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  // Skip if _meta already exists
  if (obj._meta && typeof obj._meta === 'object') return null;

  const meta = {
    schemaVersion: 3,
    layerName,
    createdAt: obj.createdAt ?? obj.created_at ?? now,
    migratedAt: now,
  };

  return { _meta: meta, ...obj };
}

export const v2_to_v3: Migration = {
  version: 3,
  description: 'Add _meta block to all layer state files',
  run(_dir: string, backend: StorageBackend): void | Promise<void> {
    const now = new Date().toISOString();
    const listResult = backend.list();

    if (isPromiseLike(listResult)) {
      return listResult.then(async (allKeys) => {
        for (const key of allKeys) {
          const raw = await backend.read(key);
          const next = transformKey(key, raw, now);
          if (next) await backend.write(key, next);
        }
      });
    }

    for (const key of listResult) {
      const raw = backend.read(key);
      const next = transformKey(key, raw, now);
      if (next) backend.write(key, next);
    }
  },
};
