// ── TIMPS VSCode → SynapseMetabolon Server Integration ───
// Enables VSCode extension to trigger spreading activation metabolic graph queries

const SERVER_URL = process.env.TIMPS_SERVER_URL || 'http://localhost:3000';

export interface MetabolicSignal {
  userId: number;
  projectId?: string;
  content: string;
  tags?: string[];
  entity?: string;
  confidence?: number;
  outcomeScore?: number;
  metadata?: Record<string, any>;
  sourceModule: string;
}

export async function sendToSynapseMetabolon(signal: MetabolicSignal): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/synapse/ingest`, {
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

export async function querySynapseMetabolon(
  query: string,
  userId: number,
  projectId?: string
): Promise<{ summary: string; activatedNodes: any[]; confidence: number; refusal?: boolean; auditLog: string[] }> {
  try {
    const res = await fetch(`${SERVER_URL}/api/synapse/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, userId, projectId: projectId || 'default' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { summary: '', activatedNodes: [], confidence: 0, refusal: true, auditLog: [] };
    }
    return res.json() as Promise<any>;
  } catch {
    return { summary: '', activatedNodes: [], confidence: 0, refusal: true, auditLog: [] };
  }
}

export async function getSynapseStats(userId: number, projectId?: string): Promise<any> {
  try {
    const res = await fetch(`${SERVER_URL}/api/synapse/stats/${userId}?projectId=${projectId || 'default'}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getSynapseGraph(userId: number, limit: number = 50): Promise<any> {
  try {
    const res = await fetch(`${SERVER_URL}/api/synapse/graph/${userId}?limit=${limit}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function runConsolidationCycle(userId: number, projectId?: string): Promise<any> {
  try {
    const res = await fetch(`${SERVER_URL}/api/synapse/consolidate/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId || 'default' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function createMetabolicSignal(
  content: string,
  sourceModule: string,
  userId: number = 1,
  tags: string[] = []
): MetabolicSignal {
  return {
    userId,
    content,
    tags,
    metadata: { source: 'timps-vscode' },
    sourceModule,
  };
}
