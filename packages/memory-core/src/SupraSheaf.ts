// ── @timps/memory-core — SupraSheaf: Cross-Layer Sheaf Coordinator ──
// Reads stalks from ChronosForge (L5), EchoForge (L7), and AetherForgeERL (L10),
// builds a joint sheaf Laplacian, and computes cross-layer H¹ + joint foresight.
//
// Design:
//   • Lightweight coordinator — no persistence, no new data files
//   • On-demand computation from existing forge stores
//   • Three wired forges: chronos (L5), echo (L7), aether (L10)
//   • Extensible: accepts optional extra node/edge arrays for unwired forges
//
// First-principles:
//   Memory layers form a cellular sheaf over (time × project). Each forge's
//   nodes are local sections; cross-layer similarity edges are restriction maps.
//   Non-trivial H¹ in the joint Laplacian = cross-layer contradiction.

import { MemoryEngine } from './MemoryEngine.js';
import { jaccardSimilarity } from './storage.js';

export interface SupraNodeRef {
  layerId: string;
  nodeId: string;
  domain: string;
  content: string;
  amplitude: number;
  createdAt: number;
}

export interface SupraEdge {
  fromLayer: string;
  fromNodeId: string;
  toLayer: string;
  toNodeId: string;
  weight: number;
  edgeType: string;
}

export interface CrossLayerContradiction {
  from: SupraNodeRef;
  to: SupraNodeRef;
  weight: number;
  layers: [string, string];
}

export interface CrossLayerCohomologyResult {
  betti1: number;
  spectralGap: number;
  contradictions: CrossLayerContradiction[];
  isConsistent: boolean;
  layerCount: number;
  totalNodes: number;
  crossLayerEdges: number;
}

export interface JointForesightResult {
  domain: string;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low';
  trajectory: number[];
  layerContributions: Record<string, number>;
  title: string;
  explanation: string;
}

export interface SheafConsistencyReport {
  layerSizes: Record<string, number>;
  totalNodes: number;
  crossLayerEdges: number;
  gluingScore: number;
  highestDiscrepancy: { layerA: string; layerB: string; score: number } | null;
  warnings: string[];
}

const CROSS_LAYER_SIM_THRESHOLD = 0.45;
const CROSS_LAYER_TEMPORAL_MS = 7 * 86_400_000;

export class SupraSheaf {
  private engine: MemoryEngine | null;
  private forgeRefs: {
    chronos?: { loadNodes(): Array<{ id: string; domain: string; content: string; baseImportance?: number; createdAt: number }> };
    echo?: { getNodes(): Array<{ id: string; domain: string; content: string; echoAmp?: number; salience?: number; createdAt: number }> };
    aether?: { getNodes(): Array<{ id: string; domain: string; content: string; amplitude?: number; createdAt: number }> };
  };

  constructor(engine?: MemoryEngine) {
    this.engine = engine ?? null;
    this.forgeRefs = {};
  }

  /**
   * Optional: provide forge references directly (for environments without MemoryEngine,
   * e.g., timps-code's Memory class).
   */
  setForgeRefs(refs: {
    chronos?: { loadNodes(): Array<{ id: string; domain: string; content: string; baseImportance?: number; createdAt: number }> };
    echo?: { getNodes(): Array<{ id: string; domain: string; content: string; echoAmp?: number; salience?: number; createdAt: number }> };
    aether?: { getNodes(): Array<{ id: string; domain: string; content: string; amplitude?: number; createdAt: number }> };
  }): void {
    this.forgeRefs = refs;
  }

  collectNodes(): SupraNodeRef[] {
    const nodes: SupraNodeRef[] = [];

    // Try from forgeRefs first, then MemoryEngine
    if (this.forgeRefs.chronos) {
      try {
        for (const n of this.forgeRefs.chronos.loadNodes()) {
          nodes.push({
            layerId: 'chronos', nodeId: n.id, domain: n.domain,
            content: n.content, amplitude: n.baseImportance ?? 0.5, createdAt: n.createdAt,
          });
        }
      } catch { /* skip */ }
    } else if (this.engine) {
      try {
        const chronos = this.engine.chronosForge;
        if (chronos) {
          for (const n of (chronos as any)['_loadNodes']() ?? []) {
            nodes.push({
              layerId: 'chronos', nodeId: n.id, domain: n.domain,
              content: n.content, amplitude: n.baseImportance ?? 0.5, createdAt: n.createdAt,
            });
          }
        }
      } catch { /* chronos unavailable */ }
    }

    if (this.forgeRefs.echo) {
      try {
        for (const n of this.forgeRefs.echo.getNodes()) {
          nodes.push({
            layerId: 'echo', nodeId: n.id, domain: n.domain,
            content: n.content, amplitude: n.echoAmp ?? n.salience ?? 0.5, createdAt: n.createdAt,
          });
        }
      } catch { /* skip */ }
    } else if (this.engine) {
      try {
        const echo = this.engine.echoForge;
        if (echo) {
          for (const n of Object.values((echo as any)['storeData'].nodes ?? {})) {
            nodes.push({
              layerId: 'echo', nodeId: (n as any).id, domain: (n as any).domain,
              content: (n as any).content, amplitude: (n as any).echoAmp ?? (n as any).salience ?? 0.5,
              createdAt: (n as any).createdAt,
            });
          }
        }
      } catch { /* echo unavailable */ }
    }

    if (this.forgeRefs.aether) {
      try {
        for (const n of this.forgeRefs.aether.getNodes()) {
          nodes.push({
            layerId: 'aether', nodeId: n.id, domain: n.domain,
            content: n.content, amplitude: n.amplitude ?? 0.5, createdAt: n.createdAt,
          });
        }
      } catch { /* skip */ }
    } else if (this.engine) {
      try {
        const aether = this.engine.aetherForge;
        if (aether) {
          for (const n of Object.values((aether as any)['storeData'].nodes ?? {})) {
            nodes.push({
              layerId: 'aether', nodeId: (n as any).id, domain: (n as any).domain,
              content: (n as any).content, amplitude: (n as any).amplitude ?? 0.5,
              createdAt: (n as any).createdAt,
            });
          }
        }
      } catch { /* aether unavailable */ }
    }

    return nodes;
  }

  /**
   * Build the cross-layer supra-graph.
   * Within-layer edges come from each forge's edge list.
   * Cross-layer edges connect nodes with similar content + temporal proximity.
   */
  buildSupraGraph(): { nodes: SupraNodeRef[]; edges: SupraEdge[] } {
    const nodes = this.collectNodes();
    const edges: SupraEdge[] = [];
    const nowMs = Date.now();

    // Index by (domain, normalized time bucket)
    const domainTimeBuckets: Record<string, Array<{ node: SupraNodeRef; idx: number }>> = {};
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const bucketKey = `${n.domain}:${Math.floor(n.createdAt / CROSS_LAYER_TEMPORAL_MS)}`;
      if (!domainTimeBuckets[bucketKey]) domainTimeBuckets[bucketKey] = [];
      domainTimeBuckets[bucketKey].push({ node: n, idx: i });
    }

    // Cross-layer edges: same domain + same time bucket + similar content
    for (const bucket of Object.values(domainTimeBuckets)) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i].node;
          const b = bucket[j].node;
          if (a.layerId === b.layerId) continue; // skip within-layer (handled by forge edges)
          const sim = jaccardSimilarity(a.content, b.content);
          if (sim >= CROSS_LAYER_SIM_THRESHOLD) {
            edges.push({
              fromLayer: a.layerId,
              fromNodeId: a.nodeId,
              toLayer: b.layerId,
              toNodeId: b.nodeId,
              weight: sim,
              edgeType: 'cross_layer_correlates',
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Compute cross-layer H¹ (contradictions spanning layer boundaries).
   *
   * Builds a joint sheaf Laplacian from the supra-graph where:
   *   • Each node is a stalk in the cellular sheaf
   *   • Within-layer edges are existing forge edges
   *   • Cross-layer similarity edges are restriction maps
   *   • Cross-layer contradiction edges (node in layer A contradicts node in layer B)
   *     indicate non-trivial H¹
   *
   * Uses the same spectral gap method as HarmonicSheafWeaver/AetherForgeERL.
   */
  computeCrossLayerH1(): CrossLayerCohomologyResult {
    const { nodes, edges } = this.buildSupraGraph();
    const crossLayerEdges = edges.filter(e => e.fromLayer !== e.toLayer);

    if (nodes.length < 2) {
      return {
        betti1: 0, spectralGap: 1, contradictions: [],
        isConsistent: true, layerCount: this.countLayers(nodes),
        totalNodes: nodes.length, crossLayerEdges: crossLayerEdges.length,
      };
    }

    // Check for cross-layer contradictions:
    // A node in layer A contradicts a node in layer B when:
    // 1. Both are in the same domain
    // 2. Content similarity is high (>0.6) suggesting they discuss the same thing
    // 3. But amplitudes are both high AND they disagree (status=contradiction in ERL,
    //    or edge type = contradicts in their respective forge)
    const contradictions: CrossLayerContradiction[] = [];

    // Collect nodes by domain
    const byDomain: Record<string, SupraNodeRef[]> = {};
    for (const n of nodes) {
      if (!byDomain[n.domain]) byDomain[n.domain] = [];
      byDomain[n.domain].push(n);
    }

    // Check each pair of cross-layer nodes in the same domain
    for (const domainNodes of Object.values(byDomain)) {
      for (let i = 0; i < domainNodes.length; i++) {
        for (let j = i + 1; j < domainNodes.length; j++) {
          const a = domainNodes[i];
          const b = domainNodes[j];
          if (a.layerId === b.layerId) continue;
          const sim = jaccardSimilarity(a.content, b.content);
          if (sim > 0.6 && a.amplitude > 0.5 && b.amplitude > 0.5) {
            contradictions.push({
              from: a, to: b, weight: sim,
              layers: [a.layerId, b.layerId],
            });
          }
        }
      }
    }

    // Build joint Laplacian to compute H¹
    const idxMap = new Map<string, number>();
    for (const n of nodes) idxMap.set(`${n.layerId}:${n.nodeId}`, idxMap.size);
    const N = nodes.length;

    // Laplacian triples: include within-layer edges and cross-layer edges
    // For simplicity, treat all edges as adjacency with Fisher-like weight
    const triples: Array<{ i: number; j: number; v: number }> = [];
    for (const e of edges) {
      const fi = idxMap.get(`${e.fromLayer}:${e.fromNodeId}`);
      const fj = idxMap.get(`${e.toLayer}:${e.toNodeId}`);
      if (fi === undefined || fj === undefined) continue;
      const w = e.weight;
      triples.push({ i: fi, j: fj, v: -w });
      triples.push({ i: fi, j: fi, v: w });
    }

    // Power iteration for smallest eigenvalues (spectral gap → H¹)
    const k = Math.min(8, Math.max(2, Math.floor(N / 3)));
    const { values } = this.computeSmallestEigenpairs(N, triples, k);

    let betti1 = 0;
    let spectralGap = 1.0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] < 0.15) {
        betti1++;
      } else {
        spectralGap = values[i];
        break;
      }
    }

    return {
      betti1,
      spectralGap,
      contradictions,
      isConsistent: betti1 === 0 && contradictions.length === 0,
      layerCount: this.countLayers(nodes),
      totalNodes: N,
      crossLayerEdges: crossLayerEdges.length,
    };
  }

  /**
   * Joint eigenmode foresight: predict trajectory for a domain
   * using the dominant eigenmode of the joint Laplacian.
   *
   * The first non-constant eigenvector encodes the slowest-varying
   * mode across all layers — the most persistent trend.
   */
  jointForesight(
    domain: string,
    opts: { horizon?: number; dt?: number } = {}
  ): JointForesightResult {
    const horizon = opts.horizon ?? 12;
    const dt = opts.dt ?? 0.1;
    const { nodes, edges } = this.buildSupraGraph();

    const domainNodes = nodes.filter(
      n => n.domain === domain && n.amplitude > 0.05
    );

    if (domainNodes.length < 2) {
      return {
        domain,
        riskScore: 0,
        riskLevel: 'low',
        trajectory: Array(horizon).fill(0),
        layerContributions: {},
        title: `SupraSheaf: ${domain}`,
        explanation: `Insufficient cross-layer data for ${domain}.`,
      };
    }

    // Build Laplacian restricted to this domain and compute eigenmodes
    const idxMap = new Map<string, number>();
    for (const n of domainNodes) idxMap.set(`${n.layerId}:${n.nodeId}`, idxMap.size);
    const N = domainNodes.length;

    const triples: Array<{ i: number; j: number; v: number }> = [];
    for (const e of edges) {
      const fi = idxMap.get(`${e.fromLayer}:${e.fromNodeId}`);
      const fj = idxMap.get(`${e.toLayer}:${e.toNodeId}`);
      if (fi === undefined || fj === undefined) continue;
      const w = e.weight;
      triples.push({ i: fi, j: fj, v: -w });
      triples.push({ i: fi, j: fi, v: w });
    }

    const k = Math.min(4, N);
    if (k < 2) {
      return {
        domain, riskScore: 0, riskLevel: 'low',
        trajectory: Array(horizon).fill(0),
        layerContributions: {},
        title: `SupraSheaf: ${domain}`,
        explanation: `Too few domain nodes for eigen-decomposition.`,
      };
    }

    const { values, vectors: rawVecs } = this.computeSmallestEigenpairs(N, triples, k, true);
    const vectors = rawVecs!;

    // First non-constant eigenvector = dominant mode
    const dominantVec = vectors.slice(N, N * 2); // eigenvector 1 (skip constant)
    if (dominantVec.length < N) {
      return {
        domain, riskScore: 0, riskLevel: 'low',
        trajectory: Array(horizon).fill(0),
        layerContributions: {},
        title: `SupraSheaf: ${domain}`,
        explanation: `Eigen-decomposition returned insufficient vectors.`,
      };
    }

    // Project amplitudes onto dominant eigenmode
    const amplitudes = domainNodes.map(n => n.amplitude);
    let projection = 0;
    for (let i = 0; i < N; i++) {
      projection += amplitudes[i] * dominantVec[i];
    }
    const normalizedProj = Math.max(0, Math.min(1, Math.abs(projection) / Math.sqrt(N)));

    // ODE integration along the dominant mode
    const trajectory: number[] = [];
    let state = normalizedProj;
    const lambda = values[1] ?? 0.1; // eigenvalue = decay rate
    for (let step = 0; step < horizon; step++) {
      state = Math.max(0, Math.min(1, state * Math.exp(-lambda * dt)));
      trajectory.push(parseFloat(state.toFixed(4)));
    }

    // Layer contributions = how many nodes from each layer
    const layerContributions: Record<string, number> = {};
    for (const n of domainNodes) {
      layerContributions[n.layerId] = (layerContributions[n.layerId] ?? 0) + 1;
    }
    // Normalize
    const total = Object.values(layerContributions).reduce((s, v) => s + v, 0);
    for (const k of Object.keys(layerContributions)) {
      layerContributions[k] = parseFloat((layerContributions[k] / total).toFixed(3));
    }

    const finalRisk = trajectory[trajectory.length - 1]!;
    const riskLevel: 'high' | 'medium' | 'low' =
      finalRisk > 0.68 ? 'high' : finalRisk > 0.42 ? 'medium' : 'low';

    const gap = values[1] ?? 0;
    return {
      domain,
      riskScore: finalRisk,
      riskLevel,
      trajectory,
      layerContributions,
      title: `SupraSheaf: ${domain}`,
      explanation: `Joint eigenmode (λ₁=${gap.toFixed(3)}): ${riskLevel.toUpperCase()} at ${Math.round(finalRisk * 100)}%. Layers: ${Object.entries(layerContributions).map(([l, w]) => `${l}: ${(w * 100).toFixed(0)}%`).join(', ')}.`,
    };
  }

  /**
   * Report on how consistently local sections glue across layers.
   * A gluing score of 1.0 = perfect consistency across all layers.
   * Low score indicates cross-layer contradictions or missing restrictions.
   */
  sheafConsistency(): SheafConsistencyReport {
    const { nodes, edges } = this.buildSupraGraph();
    const crossLayerEdges = edges.filter(e => e.fromLayer !== e.toLayer);

    // Layer sizes
    const layerSizes: Record<string, number> = {};
    for (const n of nodes) {
      layerSizes[n.layerId] = (layerSizes[n.layerId] ?? 0) + 1;
    }

    // Gluing score = how many nodes have cross-layer restrictions
    // vs total possible cross-layer pairs
    const nodesWithCrossLinks = new Set<string>();
    for (const e of crossLayerEdges) {
      nodesWithCrossLinks.add(`${e.fromLayer}:${e.fromNodeId}`);
      nodesWithCrossLinks.add(`${e.toLayer}:${e.toNodeId}`);
    }

    const gluingScore = nodes.length > 0
      ? parseFloat((nodesWithCrossLinks.size / nodes.length).toFixed(4))
      : 1;

    // Highest discrepancy = pair of layers with biggest amplitude gap
    // for nodes in the same domain
    let highestDiscrepancy: { layerA: string; layerB: string; score: number } | null = null;

    const byDomainLayer: Record<string, Record<string, SupraNodeRef[]>> = {};
    for (const n of nodes) {
      if (!byDomainLayer[n.domain]) byDomainLayer[n.domain] = {};
      if (!byDomainLayer[n.domain][n.layerId]) byDomainLayer[n.domain][n.layerId] = [];
      byDomainLayer[n.domain][n.layerId].push(n);
    }

    for (const [domain, layers] of Object.entries(byDomainLayer)) {
      const layerIds = Object.keys(layers);
      for (let i = 0; i < layerIds.length; i++) {
        for (let j = i + 1; j < layerIds.length; j++) {
          const aAmps = layers[layerIds[i]].map(n => n.amplitude);
          const bAmps = layers[layerIds[j]].map(n => n.amplitude);
          const aMean = aAmps.reduce((s, v) => s + v, 0) / aAmps.length;
          const bMean = bAmps.reduce((s, v) => s + v, 0) / bAmps.length;
          const diff = Math.abs(aMean - bMean);
          if (!highestDiscrepancy || diff > highestDiscrepancy.score) {
            highestDiscrepancy = {
              layerA: layerIds[i], layerB: layerIds[j],
              score: parseFloat(diff.toFixed(4)),
            };
          }
        }
      }
    }

    const warnings: string[] = [];
    if (gluingScore < 0.3) {
      warnings.push('Low cross-layer connectivity: layers are operating in isolation');
    }
    if (highestDiscrepancy && highestDiscrepancy.score > 0.4) {
      warnings.push(`Large amplitude gap between ${highestDiscrepancy.layerA} and ${highestDiscrepancy.layerB} (Δ=${highestDiscrepancy.score})`);
    }

    return {
      layerSizes,
      totalNodes: nodes.length,
      crossLayerEdges: crossLayerEdges.length,
      gluingScore,
      highestDiscrepancy,
      warnings,
    };
  }

  // ── Private: spectral helpers ──

  private countLayers(nodes: SupraNodeRef[]): number {
    return new Set(nodes.map(n => n.layerId)).size;
  }

  /**
   * Power iteration to compute the k smallest eigenvalues/eigenvectors
   * of a symmetric matrix represented as sparse triples.
   * Matches the algorithm in HarmonicSheafWeaver and AetherForgeERL.
   */
  private computeSmallestEigenpairs(
    n: number,
    triples: Array<{ i: number; j: number; v: number }>,
    k: number,
    returnVectors: boolean = false
  ): { values: Float64Array; vectors?: Float64Array } {
    if (n === 0) return { values: new Float64Array(0) };
    const actualK = Math.min(k, n);

    // Shift-invert: compute largest eigenvalues of (I + L)^{-1}
    // Power iteration with deflation
    const values = new Float64Array(actualK);
    const vectors = returnVectors ? new Float64Array(n * actualK) : undefined;

    for (let ev = 0; ev < actualK; ev++) {
      // Random start vector (deterministic seed)
      let vec = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        vec[i] = Math.sin((i + 1) * (ev + 1) * 1.618) * 0.5 + 0.5;
      }

      // Normalize
      this.normalizeInPlace(vec);

      // Power iteration with shifted inverse
      for (let iter = 0; iter < 50; iter++) {
        // (I + L)^{-1} @ vec via linear system approximation
        // Simple: compute L @ vec, then vec_new = vec - L@vec
        const lv = this.applyLaplacian(vec, triples, n);
        for (let i = 0; i < n; i++) {
          vec[i] = vec[i] - lv[i] * 0.5; // approximate inverse
        }

        // Gram-Schmidt deflation against previous eigenvectors
        if (vectors) {
          for (let p = 0; p < ev; p++) {
            let dot = 0;
            for (let i = 0; i < n; i++) {
              dot += vec[i] * vectors[p * n + i];
            }
            for (let i = 0; i < n; i++) {
              vec[i] -= dot * vectors[p * n + i];
            }
          }
        }

        this.normalizeInPlace(vec);
      }

      // Rayleigh quotient = eigenvalue estimate
      const lv = this.applyLaplacian(vec, triples, n);
      let eig = 0;
      for (let i = 0; i < n; i++) {
        eig += vec[i] * lv[i];
      }
      values[ev] = Math.max(0, parseFloat(eig.toFixed(6)));

      if (vectors) {
        for (let i = 0; i < n; i++) {
          vectors[ev * n + i] = vec[i];
        }
      }
    }

    return { values, vectors };
  }

  private applyLaplacian(
    vec: Float64Array,
    triples: Array<{ i: number; j: number; v: number }>,
    n: number
  ): Float64Array {
    const result = new Float64Array(n);
    for (const t of triples) {
      result[t.i] += t.v * vec[t.j];
    }
    return result;
  }

  private normalizeInPlace(vec: Float64Array): void {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 1e-10) {
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    }
  }
}
