/** resonanceForge.ts — Server-side ResonanceForge (PostgreSQL-backed) */

import { query as pgQuery, execute as pgExecute } from '../db/postgres.js';

export type ResonanceDomain = 'burnout' | 'relationship' | 'decision' | 'code_pattern' | 'contradiction' | 'goal' | 'general';

export interface ResonanceNode {
  id: string; userId: number; projectId: string; content: string;
  domain: ResonanceDomain; embedding: Record<number, number>;
  validFrom: number; validTo: number | null; invalidAt: number | null;
  causalParentId: string | null; amplitude: number; frequency: number;
  phase: number; retrievalCount: number; tags: string[]; createdAt: number;
}

export interface ResonanceCausalEdge {
  fromId: string; toId: string; weight: number;
  edgeType: 'causes' | 'supersedes' | 'contradicts' | 'correlates';
  createdAt: number;
}

export interface HarmonicPattern {
  nodeIds: string[]; interferenceType: 'constructive' | 'destructive';
  combinedAmplitude: number; domain: ResonanceDomain; summary: string;
}

export interface ResonanceWeaveResult {
  nodeId: string; supersededIds: string[];
  detectedContradictions: string[]; triggeredPatterns: HarmonicPattern[];
}

export interface ResonancePrediction {
  domain: ResonanceDomain; riskScore: number; riskLevel: 'high' | 'medium' | 'low';
  trajectory: number[]; drivingNodeIds: string[];
  explanation: string; confidence: number;
}

export interface ResonanceQueryResult {
  nodes: ResonanceNode[]; scores: number[]; predictions?: ResonancePrediction[];
}

export interface ResonanceTemporalQueryResult {
  nodes: ResonanceNode[]; pointInTime: number;
  causalChain: string[]; predictions?: ResonancePrediction[];
}

export interface HarmonicConsolidationReport {
  quenched: number; retained: number; crystallised: number; patternsDetected: number;
}

const STABILITY_MS = 14 * 24 * 60 * 60 * 1000;
const RETRIEVAL_BOOST = 0.08;
const CRYSTALLISATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_QUENCH_THRESHOLD = 0.04;
const SUPERSESSION_THRESHOLD = 0.82;
const CONTRADICTION_THRESHOLD = 0.45;
const MAX_TRAJECTORY_STEPS = 12;
const EMBED_DIM = 64;
const DEFAULT_TOP_K = 8;

const _adjOut = new Map<string, ResonanceCausalEdge[]>();
const _adjIn  = new Map<string, ResonanceCausalEdge[]>();

function addEdge(edge: ResonanceCausalEdge): void {
  if (!_adjOut.has(edge.fromId)) _adjOut.set(edge.fromId, []);
  _adjOut.get(edge.fromId)!.push(edge);
  if (!_adjIn.has(edge.toId)) _adjIn.set(edge.toId, []);
  _adjIn.get(edge.toId)!.push(edge);
}

function murmurhash(str: string): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x9e3779b9);
    h ^= h >>> 16;
  }
  return Math.abs(h);
}

function embed(text: string): Record<number, number> {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
  if (tokens.length === 0) return {};
  const tf: Record<number, number> = {};
  for (const tok of tokens) { const d = murmurhash(tok) % EMBED_DIM; tf[d] = (tf[d] ?? 0) + 1; }
  for (const k of Object.keys(tf)) tf[Number(k)] /= tokens.length;
  const norm = Math.sqrt(Object.values(tf).reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (const k of Object.keys(tf)) tf[Number(k)] /= norm;
  return tf;
}

function dotProduct(a: Record<number, number>, b: Record<number, number>): number {
  const [sm, lg] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let s = 0;
  for (const k of Object.keys(sm)) { const n = Number(k); if (n in lg) s += (sm[n] ?? 0) * (lg[n] ?? 0); }
  return s;
}

function jaccardSimilarity(a: string, b: string): number {
  const clean = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(t=>t.length>1));
  const A = clean(a); const B = clean(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function effectiveAmplitude(node: ResonanceNode, nowMs: number): number {
  const dt = Math.max(0, nowMs - node.createdAt);
  return Math.min(1, node.amplitude * Math.exp(-dt / STABILITY_MS) * (1 + node.retrievalCount * RETRIEVAL_BOOST));
}

/**
 * Server-side ResonanceForge — PostgreSQL-backed causal resonance field engine.
 *
 * Stores nodes in resonance_nodes table and edges in resonance_edges table.
 * Maintains an in-process adjacency graph for fast wave-interference simulation.
 *
 * @example
 * ```ts
 * const forge = new ResonanceForge();
 * await forge.weave(1, 'proj', 'Feeling burnt out', { domain: 'burnout' });
 * const { nodes, predictions } = await forge.query(1, 'proj', 'stress', { predict: true });
 * ```
 */
export class ResonanceForge {

  async weave(
    userId: number, projectId: string, content: string,
    opts: { domain?: ResonanceDomain; causalParentId?: string | null;
            tags?: string[]; validFrom?: number; validTo?: number | null; amplitude?: number } = {}
  ): Promise<ResonanceWeaveResult> {
    const nowMs = Date.now();
    const domain: ResonanceDomain = opts.domain ?? 'general';
    const nodeId = this._genId('rn');
    const embedding = embed(content);
    const supersededIds: string[] = [];
    const detectedContradictions: string[] = [];

    const candidates = await this._q<{ id: string; content: string }>(
      `SELECT id, content FROM resonance_nodes
       WHERE user_id=$1 AND project_id=$2 AND domain=$3
         AND invalid_at IS NULL AND (valid_to IS NULL OR valid_to > $4)`,
      [userId, projectId, domain, nowMs]
    );

    for (const c of candidates) {
      const ov = jaccardSimilarity(content, c.content);
      if (ov >= SUPERSESSION_THRESHOLD) {
        await this._x(`UPDATE resonance_nodes SET invalid_at=$1,valid_to=$1 WHERE id=$2`,[nowMs,c.id]);
        supersededIds.push(c.id);
        const e: ResonanceCausalEdge = {fromId:nodeId,toId:c.id,weight:ov,edgeType:'supersedes',createdAt:nowMs};
        addEdge(e); await this._persistEdge(e);
      } else if (ov >= CONTRADICTION_THRESHOLD) {
        detectedContradictions.push(c.id);
        const e: ResonanceCausalEdge = {fromId:nodeId,toId:c.id,weight:ov,edgeType:'contradicts',createdAt:nowMs};
        addEdge(e); await this._persistEdge(e);
      }
    }

    const weekAgo = nowMs - 7 * 86_400_000;
    const cntRows = await this._q<{cnt:string}>(
      `SELECT COUNT(*) as cnt FROM resonance_nodes WHERE user_id=$1 AND project_id=$2 AND domain=$3 AND created_at_ms>$4`,
      [userId,projectId,domain,weekAgo]
    );
    const frequency = Math.min(1, parseInt(cntRows[0]?.cnt ?? '0', 10) / 20);

    let phase = Math.random() * 2 * Math.PI;
    if (opts.causalParentId) {
      const pr = await this._q<{phase:number}>(`SELECT phase FROM resonance_nodes WHERE id=$1 LIMIT 1`,[opts.causalParentId]);
      if (pr[0]) phase = (pr[0].phase + (Math.random()-0.5)*0.4) % (2*Math.PI);
    }

    await this._x(
      `INSERT INTO resonance_nodes
         (id,user_id,project_id,content,domain,embedding,valid_from,valid_to,invalid_at,
          causal_parent_id,amplitude,frequency,phase,retrieval_count,tags,created_at_ms)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NULL,$9,$10,$11,$12,0,$13,$14) ON CONFLICT DO NOTHING`,
      [nodeId,userId,projectId,content,domain,JSON.stringify(embedding),
       opts.validFrom??nowMs,opts.validTo??null,opts.causalParentId??null,
       opts.amplitude??0.7,frequency,phase,opts.tags??[],nowMs]
    );

    if (opts.causalParentId) {
      const e: ResonanceCausalEdge = {fromId:opts.causalParentId,toId:nodeId,weight:0.9,edgeType:'causes',createdAt:nowMs};
      addEdge(e); await this._persistEdge(e);
    }

    return { nodeId, supersededIds, detectedContradictions, triggeredPatterns: [] };
  }

  async query(
    userId: number, projectId: string, queryText: string,
    opts: { topK?: number; domain?: ResonanceDomain; predict?: boolean; atTime?: number } = {}
  ): Promise<ResonanceQueryResult> {
    const nowMs = opts.atTime ?? Date.now();
    const topK = opts.topK ?? DEFAULT_TOP_K;
    const queryEmb = embed(queryText);
    const dFilter = opts.domain ? `AND domain = '${opts.domain}'` : '';
    const rows = await this._q<any>(
      `SELECT id,content,domain,embedding,valid_from,valid_to,invalid_at,causal_parent_id,
              amplitude,frequency,phase,retrieval_count,tags,created_at_ms
       FROM resonance_nodes
       WHERE user_id=$1 AND project_id=$2 AND invalid_at IS NULL
         AND (valid_to IS NULL OR valid_to > $3) ${dFilter} LIMIT 200`,
      [userId,projectId,nowMs]
    );
    const nodes = rows.map((r: any) => this._toNode(r,userId,projectId));
    const scored = nodes
      .map((n: ResonanceNode) => ({ n, score: dotProduct(queryEmb,n.embedding)*effectiveAmplitude(n,nowMs)*((Math.cos(n.phase)+1)/2) }))
      .sort((a: any,b: any) => b.score-a.score)
      .slice(0,topK);
    if (scored.length > 0) {
      await this._x(`UPDATE resonance_nodes SET retrieval_count=retrieval_count+1 WHERE id=ANY($1::text[])`,
        [scored.map((s: any)=>s.n.id)]);
    }
    let predictions: ResonancePrediction[] | undefined;
    if (opts.predict && scored.length > 0) {
      const dom = opts.domain ?? this._inferDomain(scored.map((s: any)=>s.n));
      predictions = [this._simulate(dom, scored.map((s: any)=>s.n), nowMs)];
    }
    return { nodes: scored.map((s: any)=>s.n), scores: scored.map((s: any)=>s.score), predictions };
  }

  async queryAt(
    userId: number, projectId: string, atTime: number,
    opts: { domain?: ResonanceDomain; limit?: number; predict?: boolean } = {}
  ): Promise<ResonanceTemporalQueryResult> {
    const limit = opts.limit ?? DEFAULT_TOP_K;
    const dFilter = opts.domain ? `AND domain = '${opts.domain}'` : '';
    const rows = await this._q<any>(
      `SELECT id,content,domain,embedding,valid_from,valid_to,invalid_at,causal_parent_id,
              amplitude,frequency,phase,retrieval_count,tags,created_at_ms
       FROM resonance_nodes
       WHERE user_id=$1 AND project_id=$2
         AND valid_from<=$3 AND (valid_to IS NULL OR valid_to>=$3)
         AND (invalid_at IS NULL OR invalid_at>$3) ${dFilter}
       ORDER BY amplitude DESC LIMIT $4`,
      [userId,projectId,atTime,limit]
    );
    const nodes = rows.map((r: any) => this._toNode(r,userId,projectId));
    const causalChain: string[] = [];
    if (nodes.length > 0) {
      let cursor: string | null = nodes[0].causalParentId;
      let d = 0;
      while (cursor && d < 8) {
        causalChain.push(cursor);
        const pr = await this._q<{causal_parent_id:string|null}>(
          `SELECT causal_parent_id FROM resonance_nodes WHERE id=$1 LIMIT 1`,[cursor]);
        cursor = pr[0]?.causal_parent_id ?? null; d++;
      }
    }
    let predictions: ResonancePrediction[] | undefined;
    if (opts.predict && nodes.length > 0) {
      const dom = opts.domain ?? this._inferDomain(nodes);
      predictions = [this._simulate(dom, nodes, atTime)];
    }
    return { nodes, pointInTime: atTime, causalChain, predictions };
  }

  async simulateResonance(
    userId: number, projectId: string, domain: ResonanceDomain,
    opts: { steps?: number; lookbackDays?: number } = {}
  ): Promise<ResonancePrediction> {
    const nowMs = Date.now();
    const steps = Math.min(opts.steps ?? MAX_TRAJECTORY_STEPS, MAX_TRAJECTORY_STEPS);
    const lb = (opts.lookbackDays ?? 30) * 86_400_000;
    const rows = await this._q<any>(
      `SELECT id,content,domain,embedding,valid_from,valid_to,invalid_at,causal_parent_id,
              amplitude,frequency,phase,retrieval_count,tags,created_at_ms
       FROM resonance_nodes
       WHERE user_id=$1 AND project_id=$2 AND domain=$3
         AND invalid_at IS NULL AND created_at_ms>$4 LIMIT 30`,
      [userId,projectId,domain,nowMs-lb]
    );
    if (rows.length === 0) {
      return { domain, riskScore:0, riskLevel:'low', trajectory:Array(steps).fill(0),
               drivingNodeIds:[], explanation:`No recent ${domain} signals.`, confidence:0.2 };
    }
    return this._simulate(domain, rows.map((r: any)=>this._toNode(r,userId,projectId)), nowMs, steps);
  }

  async consolidate(
    userId: number, projectId: string,
    quenchThreshold = DEFAULT_QUENCH_THRESHOLD
  ): Promise<HarmonicConsolidationReport> {
    const nowMs = Date.now();
    const rows = await this._q<{id:string;amplitude:number;retrieval_count:number;created_at_ms:number}>(
      `SELECT id,amplitude,retrieval_count,created_at_ms FROM resonance_nodes
       WHERE user_id=$1 AND project_id=$2 AND invalid_at IS NULL LIMIT 500`,
      [userId,projectId]
    );
    let quenched=0, retained=0, crystallised=0;
    for (const r of rows) {
      const dt = Math.max(0, nowMs - r.created_at_ms);
      const amp = Math.min(1, r.amplitude * Math.exp(-dt/STABILITY_MS) * (1 + r.retrieval_count * RETRIEVAL_BOOST));
      const out = (_adjOut.get(r.id) ?? []).length;
      if (amp < quenchThreshold && out === 0) {
        await this._x(`UPDATE resonance_nodes SET invalid_at=$1,valid_to=$1 WHERE id=$2`,[nowMs,r.id]);
        quenched++;
      } else {
        retained++;
        if (nowMs-r.created_at_ms >= CRYSTALLISATION_AGE_MS && amp >= 0.5 && r.retrieval_count >= 3) {
          await this._x(`UPDATE resonance_nodes SET amplitude=LEAST(1.0,amplitude*1.25) WHERE id=$1`,[r.id]);
          crystallised++;
        }
      }
    }
    return { quenched, retained, crystallised, patternsDetected:0 };
  }

  async warmGraph(userId: number): Promise<number> {
    const cutoff = Date.now() - 90*86_400_000;
    const rows = await this._q<{from_id:string;to_id:string;weight:number;edge_type:string;created_at:number}>(
      `SELECT from_id,to_id,weight,edge_type,created_at FROM resonance_edges WHERE created_at>$1 LIMIT 5000`,[cutoff]);
    for (const r of rows) addEdge({fromId:r.from_id,toId:r.to_id,weight:r.weight,
      edgeType:r.edge_type as ResonanceCausalEdge['edgeType'],createdAt:r.created_at});
    return rows.length;
  }

  private _simulate(
    domain: ResonanceDomain, nodes: ResonanceNode[], nowMs: number, steps = MAX_TRAJECTORY_STEPS
  ): ResonancePrediction {
    if (!nodes.length) return { domain, riskScore:0, riskLevel:'low', trajectory:Array(steps).fill(0),
      drivingNodeIds:[], explanation:`No nodes in '${domain}'.`, confidence:0.2 };
    const amps = nodes.map(n => effectiveAmplitude(n, nowMs));
    let fs = amps.reduce((s,a)=>s+a,0) / amps.length;
    let cBoost = 0, dDamp = 0;
    for (const n of nodes) {
      for (const e of (_adjOut.get(n.id)??[])) {
        if (nodes.some(m=>m.id===e.toId)) {
          if (e.edgeType==='causes'||e.edgeType==='correlates') cBoost+=e.weight*0.05;
          else if (e.edgeType==='contradicts') dDamp+=e.weight*0.04;
        }
      }
    }
    const freq = nodes.reduce((s,n)=>s+n.frequency,0)/nodes.length;
    const damp = 0.92 + freq*0.05;
    const traj: number[] = [parseFloat(fs.toFixed(3))];
    for (let i=1;i<steps;i++) {
      fs = Math.max(0,Math.min(1, fs*damp+cBoost-dDamp+(Math.random()-0.5)*0.04));
      traj.push(parseFloat(fs.toFixed(3)));
    }
    const fr = traj[traj.length-1]!;
    const rl: 'high'|'medium'|'low' = fr>0.68?'high':fr>0.42?'medium':'low';
    const drivers = nodes.map((n,i)=>({n,amp:amps[i]??0})).sort((a,b)=>b.amp-a.amp).slice(0,3).map(x=>x.n.id);
    const icon = {high:'🔴',medium:'🟡',low:'🟢'}[rl]??'⚪';
    const labels: Record<ResonanceDomain,string> = {burnout:'burnout',relationship:'relationship drift',
      decision:'decision risk',code_pattern:'bug risk',contradiction:'contradiction',goal:'goal risk',general:'general'};
    return { domain, riskScore:parseFloat(fr.toFixed(3)), riskLevel:rl, trajectory:traj, drivingNodeIds:drivers,
      explanation:`${icon} ResonanceForge (${labels[domain]}): ${rl.toUpperCase()} at ${Math.round(fr*100)}%.`,
      confidence:Math.min(0.95,0.45+nodes.length*0.025) };
  }

  private _inferDomain(nodes: ResonanceNode[]): ResonanceDomain {
    const c: Partial<Record<ResonanceDomain,number>> = {};
    for (const n of nodes) c[n.domain]=(c[n.domain]??0)+1;
    let best: ResonanceDomain='general', bc=0;
    for (const [d,v] of Object.entries(c)) if (v&&v>bc) { bc=v; best=d as ResonanceDomain; }
    return best;
  }

  private async _persistEdge(e: ResonanceCausalEdge): Promise<void> {
    await this._x(
      `INSERT INTO resonance_edges(from_id,to_id,weight,edge_type,created_at)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(from_id,to_id,edge_type) DO UPDATE SET weight=EXCLUDED.weight`,
      [e.fromId,e.toId,e.weight,e.edgeType,e.createdAt]
    );
  }

  private _toNode(r: any, userId: number, projectId: string): ResonanceNode {
    let emb: Record<number,number>;
    try { emb = typeof r.embedding==='string' ? JSON.parse(r.embedding) : r.embedding; } catch { emb={}; }
    return { id:r.id, userId, projectId, content:r.content, domain:r.domain as ResonanceDomain,
      embedding:emb, validFrom:r.valid_from, validTo:r.valid_to, invalidAt:r.invalid_at,
      causalParentId:r.causal_parent_id, amplitude:r.amplitude, frequency:r.frequency,
      phase:r.phase, retrievalCount:r.retrieval_count, tags:r.tags??[], createdAt:r.created_at_ms };
  }

  private _genId(p: string): string {
    return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  private async _q<T>(sql: string, params: unknown[]): Promise<T[]> {
    return pgQuery<T>(sql, params);
  }

  private async _x(sql: string, params: unknown[]): Promise<void> {
    await pgExecute(sql, params);
  }
}

export const resonanceForge = new ResonanceForge();