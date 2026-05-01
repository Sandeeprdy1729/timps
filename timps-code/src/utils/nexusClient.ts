// ── TIMPS Code → NexusForge Server Integration ───
// Enables CLI coding agent to trigger server-side episodic memory evolution

const SERVER_URL = process.env.TIMPS_SERVER_URL || 'http://localhost:3000';

export interface NexusSignal {
  userId: number;
  projectId?: string;
  content: string;
  tags?: string[];
  confidence?: number;
  metadata?: Record<string, any>;
  sourceModule: string;
}

export async function sendToNexusForge(signal: NexusSignal): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/nexus/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signal),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function queryNexusForge(
  query: string,
  userId: number
): Promise<{ results: any[]; refusal: boolean; confidence: number }> {
  try {
    const res = await fetch(`${SERVER_URL}/api/nexus/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, userId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { results: [], refusal: true, confidence: 0 };
    }
    return res.json();
  } catch {
    return { results: [], refusal: true, confidence: 0 };
  }
}

export function createNexusSignal(
  content: string,
  sourceModule: string,
  userId: number = 1,
  tags: string[] = []
): NexusSignal {
  return {
    userId,
    content,
    tags,
    metadata: { source: 'timps-code' },
    sourceModule,
  };
}

// ── ChronosVeil (Temporal Apex Veil) Integration ─────────────────────────────

export interface ChronosSignal {
  content: string;
  sourceModule: string;
  tags?: string[];
  entity?: string;
  userId?: number;
  projectId?: string;
  metadata?: Record<string, any>;
}

export async function ingestToChronosVeil(signal: ChronosSignal): Promise<{ eventId?: string; layer?: string } | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/chronos/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: signal.content,
        sourceModule: signal.sourceModule,
        tags: signal.tags || [],
        entity: signal.entity,
        userId: signal.userId || 1,
        projectId: signal.projectId || 'default',
        metadata: signal.metadata || {},
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function queryChronosVeil(
  query: string,
  userId: number = 1,
  projectId: string = 'default',
  limit: number = 8
): Promise<{ resolvedEvents: any[]; conflicts: string[]; confidence: number } | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/chronos/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, userId, projectId, limit }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function detectCodingEntities(content: string): string[] {
  const tags: string[] = ['code'];
  const lower = content.toLowerCase();
  if (/bug|error|crash|exception|failed/.test(lower)) tags.push('bug');
  if (/debt|legacy|refactor|complex/.test(lower)) tags.push('tech-debt');
  if (/api|endpoint|webhook|route/.test(lower)) tags.push('api');
  if (/test|fail|pass|assert/.test(lower)) tags.push('testing');
  if (/security|vuln|xss|injection/.test(lower)) tags.push('security');
  if (/burnout|stress|tired|overwhelmed/.test(lower)) tags.push('burnout');
  if (/team|colleague|review|handoff/.test(lower)) tags.push('relationship');
  return tags;
}