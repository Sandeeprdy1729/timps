export interface RankedResult {
  id: string;
  score: number;
  rank: number;
  source: string;
}

export interface FusableEntry {
  id: string;
  score?: number;
}

const DEFAULT_K = 60;

export function rrfFuse(
  lists: FusableEntry[][],
  k = DEFAULT_K,
): RankedResult[] {
  const acc = new Map<string, { sum: number; sources: string[] }>();

  for (let listIdx = 0; listIdx < lists.length; listIdx++) {
    const list = lists[listIdx];
    const sourceName = `source_${listIdx}`;
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const existing = acc.get(item.id);
      const rrfScore = 1 / (k + rank + 1);
      if (existing) {
        existing.sum += rrfScore;
        existing.sources.push(sourceName);
      } else {
        acc.set(item.id, { sum: rrfScore, sources: [sourceName] });
      }
    }
  }

  return Array.from(acc.entries())
    .map(([id, { sum, sources }]) => ({
      id,
      score: sum,
      rank: 0,
      source: sources.join('+'),
    }))
    .sort((a, b) => b.score - a.score);
}

export function rrfFuseWithNames(
  lists: Array<{ name: string; entries: FusableEntry[] }>,
  k = DEFAULT_K,
): RankedResult[] {
  const acc = new Map<string, { sum: number; sources: string[] }>();

  for (const { name, entries } of lists) {
    for (let rank = 0; rank < entries.length; rank++) {
      const item = entries[rank];
      const existing = acc.get(item.id);
      const rrfScore = 1 / (k + rank + 1);
      if (existing) {
        existing.sum += rrfScore;
        if (!existing.sources.includes(name)) existing.sources.push(name);
      } else {
        acc.set(item.id, { sum: rrfScore, sources: [name] });
      }
    }
  }

  return Array.from(acc.entries())
    .map(([id, { sum, sources }]) => ({
      id,
      score: sum,
      rank: 0,
      source: sources.join('+'),
    }))
    .sort((a, b) => b.score - a.score);
}
