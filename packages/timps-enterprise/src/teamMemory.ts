/**
 * timps-enterprise — shared memory store (in-process, file-backed).
 *
 * In a production deployment, replace this with a PostgreSQL or Redis backend.
 * The MemoryEntry interface is compatible with timps-memory's SemanticEntry.
 */

export interface MemoryEntry {
  key: string;
  value: string;
  importance: number;
  tags: string[];
  createdBy: string;   // user ID of creator
  teamId: string;
  updatedAt: string;
}

/** In-memory store keyed by teamId → key → MemoryEntry */
const store = new Map<string, Map<string, MemoryEntry>>();

function teamMap(teamId: string): Map<string, MemoryEntry> {
  if (!store.has(teamId)) store.set(teamId, new Map());
  return store.get(teamId)!;
}

export function upsertMemory(entry: MemoryEntry): void {
  teamMap(entry.teamId).set(entry.key, { ...entry, updatedAt: new Date().toISOString() });
}

export function getMemory(teamId: string, key: string): MemoryEntry | undefined {
  return teamMap(teamId).get(key);
}

export function listMemory(teamId: string, tags?: string[]): MemoryEntry[] {
  const entries = [...teamMap(teamId).values()];
  if (!tags || tags.length === 0) return entries;
  return entries.filter((e) => tags.some((t) => e.tags.includes(t)));
}

export function deleteMemory(teamId: string, key: string): boolean {
  return teamMap(teamId).delete(key);
}

// ── Episodic feed ──────────────────────────────────────────────────────────

export interface EpisodicEvent {
  id: string;
  teamId: string;
  userId: string;
  action: string;
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const episodes: EpisodicEvent[] = [];

export function appendEpisode(event: Omit<EpisodicEvent, 'timestamp'>): EpisodicEvent {
  const full: EpisodicEvent = { ...event, timestamp: new Date().toISOString() };
  episodes.push(full);
  return full;
}

export function getTeamFeed(teamId: string, limit = 50): EpisodicEvent[] {
  return episodes.filter((e) => e.teamId === teamId).slice(-limit);
}
