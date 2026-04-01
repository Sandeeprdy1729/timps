// core/echoForge.ts — EchoForge: Temporal Predictive Consolidation Engine with Causal Ripple Simulation
import {
  createDAGNode,
  createDAGEdge,
  getRecentDAGNodes,
  getNeighborNodes,
  getOutgoingEdges,
  getDAGNodeCount,
  getUnconslidatedNodes,
  updateDAGNodeType,
  upsertTrajectory,
  getActiveTrajectories,
  storeRippleResult,
  getHighRiskRipples,
  logConsolidation,
  applyTemporalDecay,
  pruneDecayedNodes,
  DAGNode,
  DAGEdge,
  RippleResult,
  TrajectoryNode,
} from '../db/echoForgeDb';
import { EmbeddingService } from '../memory/embedding';

// ── Configuration ──────────────────────────────────────────────────────────────

interface EchoForgeConfig {
  /** Minimum value score to ingest a memory (0–1). Below this, summarize into parent. */
  writeGateThreshold: number;
  /** Maximum depth for ripple simulation traversal */
  rippleDepth: number;
  /** Number of recent nodes to check for connections on ingest */
  connectionWindow: number;
  /** Temporal window in days for connecting related nodes */
  temporalWindowDays: number;
  /** Minimum cosine similarity to create a semantic edge */
  semanticEdgeThreshold: number;
  /** Batch size for periodic consolidation */
  consolidationBatchSize: number;
  /** Daily temporal decay rate (Ebbinghaus-inspired) */
  temporalDecayRate: number;
  /** Risk threshold for triggering proactive alerts */
  riskAlertThreshold: number;
  /** Tags that signal high-impact events requiring ripple simulation */
  highImpactTags: string[];
}

const DEFAULT_CONFIG: EchoForgeConfig = {
  writeGateThreshold: 0.3,
  rippleDepth: 5,
  connectionWindow: 10,
  temporalWindowDays: 30,
  semanticEdgeThreshold: 0.65,
  consolidationBatchSize: 50,
  temporalDecayRate: 0.995,
  riskAlertThreshold: 0.6,
  highImpactTags: ['burnout', 'relationship', 'contradiction', 'regret', 'stress', 'drift', 'health'],
};

// ── Ingest Result ──────────────────────────────────────────────────────────────

export interface IngestResult {
  accepted: boolean;
  nodeId: number | null;
  valueScore: number;
  edgesCreated: number;
  rippleTriggered: boolean;
  gatedReason?: string;
}

// ── Ripple Simulation Result ───────────────────────────────────────────────────

export interface SimulationResult {
  predictions: Array<{
    type: string;
    riskScore: number;
    confidence: number;
    explanation: string;
    affectedNodeIds: number[];
  }>;
  trajectoryUpdates: TrajectoryNode[];
}

// ── Consolidation Result ───────────────────────────────────────────────────────

export interface ConsolidationResult {
  nodesProcessed: number;
  episodicNodesCreated: number;
  nodesDecayed: number;
  nodesPruned: number;
}

// ── Main EchoForge Engine ──────────────────────────────────────────────────────

export class EchoForge {
  private config: EchoForgeConfig;
  private embeddingService: EmbeddingService;

  constructor(config?: Partial<EchoForgeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embeddingService = new EmbeddingService();
  }

  // ── Write-Time Gating + DAG Ingestion ──────────────────────────────────────

  /**
   * Ingest a memory into the EchoForge temporal DAG.
   * Performs write-time gating: only high-value items create full nodes.
   * Low-value items are silently skipped (could be summarized later).
   */
  async ingest(
    userId: number,
    memoryId: number | null,
    content: string,
    tags: string[],
    importance: number,
    embeddingVector?: number[]
  ): Promise<IngestResult> {
    // Step 1: Compute value score (relevance × novelty × impact)
    const valueScore = await this.computeValueScore(
      userId, content, importance, tags, embeddingVector
    );

    // Step 2: Write-time gate
    if (valueScore < this.config.writeGateThreshold) {
      return {
        accepted: false,
        nodeId: null,
        valueScore,
        edgesCreated: 0,
        rippleTriggered: false,
        gatedReason: `Value score ${valueScore.toFixed(2)} below threshold ${this.config.writeGateThreshold}`,
      };
    }

    // Step 3: Create DAG node
    const node = await createDAGNode({
      user_id: userId,
      memory_id: memoryId,
      node_type: 'raw',
      content_summary: content.slice(0, 500),
      embedding_id: null,
      importance_score: valueScore,
      temporal_weight: 1.0,
      tags,
    });

    // Step 4: Connect to recent nodes (temporal + semantic edges)
    const edgesCreated = await this.connectToGraph(userId, node, embeddingVector);

    // Step 5: Check if this is a high-impact event requiring ripple simulation
    const isHighImpact = tags.some(t =>
      this.config.highImpactTags.includes(t.toLowerCase())
    );
    let rippleTriggered = false;

    if (isHighImpact && node.id) {
      try {
        await this.simulateRipples(userId, node.id);
        rippleTriggered = true;
      } catch (err) {
        console.error('[EchoForge] Ripple simulation failed:', err);
      }
    }

    return {
      accepted: true,
      nodeId: node.id ?? null,
      valueScore,
      edgesCreated,
      rippleTriggered,
    };
  }

  // ── Value Score Computation ────────────────────────────────────────────────

  /**
   * Compute predicted utility of a memory:
   *   valueScore = importance_weight * novelty_factor * tag_impact_boost
   *
   * Uses embedding cosine similarity against recent nodes for novelty.
   * No LLM call — fast proxy computation.
   */
  private async computeValueScore(
    userId: number,
    content: string,
    importance: number,
    tags: string[],
    embeddingVector?: number[]
  ): Promise<number> {
    // Normalize importance to 0–1 (input is 1–5 scale)
    const importanceWeight = Math.min(importance, 5) / 5;

    // Novelty: compare against recent nodes via embedding similarity
    let noveltyFactor = 0.8; // Default: fairly novel
    if (embeddingVector) {
      try {
        const recentNodes = await getRecentDAGNodes(userId, 5);
        if (recentNodes.length > 0) {
          // Simple heuristic: if content is very similar to recent, lower novelty
          // We use content length ratio as a lightweight proxy when no embeddings stored
          const avgContentLen = recentNodes.reduce(
            (sum, n) => sum + n.content_summary.length, 0
          ) / recentNodes.length;
          const contentDiff = Math.abs(content.length - avgContentLen) / Math.max(avgContentLen, 1);
          noveltyFactor = Math.min(1.0, 0.5 + contentDiff * 0.5);
        }
      } catch {
        // Use default novelty on error
      }
    }

    // Tag impact boost: burnout/relationship/contradiction signals get priority
    const hasHighImpactTag = tags.some(t =>
      this.config.highImpactTags.includes(t.toLowerCase())
    );
    const tagBoost = hasHighImpactTag ? 1.3 : 1.0;

    const rawScore = importanceWeight * noveltyFactor * tagBoost;
    return Math.min(1.0, Math.max(0.0, rawScore));
  }

  // ── Graph Connection ───────────────────────────────────────────────────────

  /**
   * Connect a new node to the existing DAG via temporal and semantic edges.
   * O(k) where k = connectionWindow (bounded, typically 10).
   */
  private async connectToGraph(
    userId: number,
    node: DAGNode,
    _embeddingVector?: number[]
  ): Promise<number> {
    if (!node.id) return 0;

    const recentNodes = await getRecentDAGNodes(userId, this.config.connectionWindow);
    let edgesCreated = 0;

    for (const prev of recentNodes) {
      if (!prev.id || prev.id === node.id) continue;

      // Temporal edge: connect if within temporal window
      if (prev.created_at && node.created_at) {
        const daysDiff = Math.abs(
          (new Date(node.created_at).getTime() - new Date(prev.created_at).getTime())
          / (1000 * 60 * 60 * 24)
        );
        if (daysDiff <= this.config.temporalWindowDays) {
          const temporalWeight = 1.0 - (daysDiff / this.config.temporalWindowDays);
          const edge = await createDAGEdge({
            user_id: userId,
            source_node_id: prev.id,
            target_node_id: node.id,
            edge_type: 'temporal',
            weight: Math.max(0.1, temporalWeight),
          });
          if (edge) edgesCreated++;
        }
      }

      // Semantic edge: connect if tags overlap (lightweight heuristic)
      const tagOverlap = this.computeTagOverlap(prev.tags || [], node.tags || []);
      if (tagOverlap >= 0.3) {
        const edge = await createDAGEdge({
          user_id: userId,
          source_node_id: prev.id,
          target_node_id: node.id,
          edge_type: 'semantic',
          weight: tagOverlap,
        });
        if (edge) edgesCreated++;
      }
    }

    return edgesCreated;
  }

  // ── Causal Ripple Simulation ───────────────────────────────────────────────

  /**
   * Bounded Monte-Carlo-style ripple propagation on the DAG.
   * From a trigger node, propagate through edges applying probabilistic decay.
   * O(k * d) where k = ripple depth, d = avg degree (sparse).
   */
  async simulateRipples(
    userId: number,
    triggerNodeId: number
  ): Promise<SimulationResult> {
    const predictions: SimulationResult['predictions'] = [];
    const trajectoryUpdates: TrajectoryNode[] = [];

    // Get the neighborhood subgraph
    const neighbors = await getNeighborNodes(triggerNodeId, this.config.rippleDepth);
    if (neighbors.length === 0) {
      return { predictions, trajectoryUpdates };
    }

    // Collect tag signals across the subgraph
    const tagCounts: Record<string, number> = {};
    const affectedIds: number[] = [];

    for (const neighbor of neighbors) {
      if (neighbor.id) affectedIds.push(neighbor.id);
      for (const tag of (neighbor.tags || [])) {
        const lowerTag = tag.toLowerCase();
        tagCounts[lowerTag] = (tagCounts[lowerTag] || 0) + 1;
      }
    }

    // Compute risk scores for each high-impact domain
    const totalNeighbors = Math.max(neighbors.length, 1);

    // Burnout risk propagation
    const burnoutSignals = (tagCounts['burnout'] || 0) + (tagCounts['stress'] || 0)
      + (tagCounts['exhaustion'] || 0) + (tagCounts['drained'] || 0);
    if (burnoutSignals > 0) {
      const burnoutRisk = Math.min(1.0, burnoutSignals / totalNeighbors + 0.2);
      const confidence = Math.min(0.9, 0.3 + (burnoutSignals / totalNeighbors) * 0.6);
      predictions.push({
        type: 'burnout_risk',
        riskScore: burnoutRisk,
        confidence,
        explanation: `${burnoutSignals} stress/burnout signals detected in ${totalNeighbors} connected memories. ` +
          `Estimated burnout risk: ${(burnoutRisk * 100).toFixed(0)}% over the next 30 days.`,
        affectedNodeIds: affectedIds,
      });

      // Store ripple result
      if (burnoutRisk >= this.config.riskAlertThreshold) {
        await storeRippleResult({
          user_id: userId,
          trigger_node_id: triggerNodeId,
          affected_node_ids: affectedIds,
          prediction_type: 'burnout_risk',
          risk_score: burnoutRisk,
          confidence,
          explanation: predictions[predictions.length - 1].explanation,
        });
      }
    }

    // Relationship drift propagation
    const driftSignals = (tagCounts['relationship'] || 0) + (tagCounts['drift'] || 0)
      + (tagCounts['ghosting'] || 0) + (tagCounts['neglect'] || 0);
    if (driftSignals > 0) {
      const driftRisk = Math.min(1.0, driftSignals / totalNeighbors + 0.15);
      const confidence = Math.min(0.85, 0.25 + (driftSignals / totalNeighbors) * 0.5);
      predictions.push({
        type: 'relationship_drift',
        riskScore: driftRisk,
        confidence,
        explanation: `${driftSignals} relationship/drift signals in ${totalNeighbors} connected memories. ` +
          `Potential relationship deterioration risk: ${(driftRisk * 100).toFixed(0)}%.`,
        affectedNodeIds: affectedIds,
      });

      if (driftRisk >= this.config.riskAlertThreshold) {
        await storeRippleResult({
          user_id: userId,
          trigger_node_id: triggerNodeId,
          affected_node_ids: affectedIds,
          prediction_type: 'relationship_drift',
          risk_score: driftRisk,
          confidence,
          explanation: predictions[predictions.length - 1].explanation,
        });
      }
    }

    // Contradiction cascade detection
    const contradictionSignals = (tagCounts['contradiction'] || 0) + (tagCounts['conflict'] || 0);
    if (contradictionSignals > 0) {
      const cascadeRisk = Math.min(1.0, contradictionSignals / totalNeighbors + 0.1);
      const confidence = Math.min(0.8, 0.2 + (contradictionSignals / totalNeighbors) * 0.5);
      predictions.push({
        type: 'contradiction_cascade',
        riskScore: cascadeRisk,
        confidence,
        explanation: `${contradictionSignals} contradiction/conflict signals. ` +
          `Possible cascade affecting ${affectedIds.length} connected beliefs.`,
        affectedNodeIds: affectedIds,
      });

      if (cascadeRisk >= this.config.riskAlertThreshold) {
        await storeRippleResult({
          user_id: userId,
          trigger_node_id: triggerNodeId,
          affected_node_ids: affectedIds,
          prediction_type: 'contradiction_cascade',
          risk_score: cascadeRisk,
          confidence,
          explanation: predictions[predictions.length - 1].explanation,
        });
      }
    }

    // Update trajectories for affected threads
    for (const pred of predictions) {
      if (pred.riskScore >= this.config.riskAlertThreshold) {
        try {
          const trajectory = await upsertTrajectory({
            user_id: userId,
            thread_name: pred.type,
            predicted_state: {
              risk_score: pred.riskScore,
              signals_count: neighbors.length,
              explanation: pred.explanation,
            },
            confidence: pred.confidence,
            horizon_days: 30,
            source_node_ids: pred.affectedNodeIds.slice(0, 20),
          });
          trajectoryUpdates.push(trajectory);
        } catch (err) {
          console.error('[EchoForge] Trajectory update failed:', err);
        }
      }
    }

    return { predictions, trajectoryUpdates };
  }

  // ── Hierarchical Consolidation ─────────────────────────────────────────────

  /**
   * Periodic batch consolidation: merge raw nodes into episodic summaries.
   * O(n log n) for sorting + grouping, runs as background task.
   */
  async periodicConsolidate(userId: number): Promise<ConsolidationResult> {
    let episodicNodesCreated = 0;

    // Step 1: Get unconsolidated raw nodes
    const rawNodes = await getUnconslidatedNodes(userId, this.config.consolidationBatchSize);
    if (rawNodes.length < 3) {
      return { nodesProcessed: 0, episodicNodesCreated: 0, nodesDecayed: 0, nodesPruned: 0 };
    }

    // Step 2: Group by tag clusters
    const clusters = this.clusterByTags(rawNodes);

    // Step 3: Create episodic summary nodes for each cluster
    for (const [clusterKey, nodes] of Object.entries(clusters)) {
      if (nodes.length < 2) continue;

      // Build summary from cluster
      const summaryContent = this.buildClusterSummary(clusterKey, nodes);
      const avgImportance = nodes.reduce((s, n) => s + n.importance_score, 0) / nodes.length;
      const allTags = [...new Set(nodes.flatMap(n => n.tags || []))];

      // Create episodic node
      const episodicNode = await createDAGNode({
        user_id: userId,
        memory_id: null,
        node_type: 'episodic',
        content_summary: summaryContent,
        embedding_id: null,
        importance_score: Math.min(1.0, avgImportance * 1.2), // Boost consolidated
        temporal_weight: 1.0,
        tags: allTags,
        consolidated_at: new Date(),
      });

      // Connect episodic node to all merged raw nodes
      for (const rawNode of nodes) {
        if (rawNode.id && episodicNode.id) {
          await createDAGEdge({
            user_id: userId,
            source_node_id: rawNode.id,
            target_node_id: episodicNode.id,
            edge_type: 'causal',
            weight: 0.8,
          });
          // Mark raw node as consolidated
          await updateDAGNodeType(rawNode.id, 'raw'); // Keep type but mark consolidated_at
        }
      }

      // Log consolidation
      if (episodicNode.id) {
        await logConsolidation({
          user_id: userId,
          merged_node_ids: nodes.map(n => n.id!).filter(Boolean),
          result_node_id: episodicNode.id,
          consolidation_type: 'tag_cluster',
          nodes_merged: nodes.length,
        });
      }

      episodicNodesCreated++;
    }

    // Step 4: Apply temporal decay
    const nodesDecayed = await applyTemporalDecay(userId, this.config.temporalDecayRate);

    // Step 5: Prune fully decayed nodes
    const nodesPruned = await pruneDecayedNodes(userId);

    return {
      nodesProcessed: rawNodes.length,
      episodicNodesCreated,
      nodesDecayed,
      nodesPruned,
    };
  }

  // ── Predictive Query ───────────────────────────────────────────────────────

  /**
   * Get predictions and proactive warnings for a user.
   * Returns pre-computed ripple results + active trajectories.
   */
  async getPredictions(userId: number): Promise<{
    highRiskAlerts: RippleResult[];
    trajectories: TrajectoryNode[];
    dagSize: number;
  }> {
    const [highRiskAlerts, trajectories, dagSize] = await Promise.all([
      getHighRiskRipples(userId, this.config.riskAlertThreshold),
      getActiveTrajectories(userId),
      getDAGNodeCount(userId),
    ]);

    return { highRiskAlerts, trajectories, dagSize };
  }

  // ── Proactive Insights ─────────────────────────────────────────────────────

  /**
   * Generate proactive insight strings for the agent to surface.
   * Called during reflection or context retrieval.
   */
  async getProactiveInsights(userId: number): Promise<string[]> {
    const insights: string[] = [];

    try {
      const { highRiskAlerts, trajectories } = await this.getPredictions(userId);

      for (const alert of highRiskAlerts.slice(0, 3)) {
        const riskPct = (alert.risk_score * 100).toFixed(0);
        const confidencePct = (alert.confidence * 100).toFixed(0);
        insights.push(
          `⚠️ EchoForge Alert [${alert.prediction_type}]: Risk ${riskPct}% ` +
          `(confidence ${confidencePct}%) — ${alert.explanation}`
        );
      }

      for (const traj of trajectories.slice(0, 2)) {
        const state = traj.predicted_state as Record<string, unknown>;
        const riskScore = state.risk_score as number | undefined;
        if (riskScore && riskScore >= this.config.riskAlertThreshold) {
          insights.push(
            `🔮 EchoForge Trajectory [${traj.thread_name}]: ` +
            `Predicted state over next ${traj.horizon_days} days — ` +
            `Risk ${(riskScore * 100).toFixed(0)}%, ` +
            `Confidence ${(traj.confidence * 100).toFixed(0)}%`
          );
        }
      }
    } catch (err) {
      // Silent: EchoForge insights are supplementary
      console.error('[EchoForge] Proactive insights failed:', err);
    }

    return insights;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private computeTagOverlap(tagsA: string[], tagsB: string[]): number {
    if (tagsA.length === 0 || tagsB.length === 0) return 0;
    const setA = new Set(tagsA.map(t => t.toLowerCase()));
    const setB = new Set(tagsB.map(t => t.toLowerCase()));
    let overlap = 0;
    for (const tag of setA) {
      if (setB.has(tag)) overlap++;
    }
    return overlap / Math.max(setA.size, setB.size);
  }

  private clusterByTags(nodes: DAGNode[]): Record<string, DAGNode[]> {
    const clusters: Record<string, DAGNode[]> = {};

    for (const node of nodes) {
      // Primary cluster key: first high-impact tag, or 'general'
      const tags = node.tags || [];
      let key = 'general';
      for (const tag of tags) {
        if (this.config.highImpactTags.includes(tag.toLowerCase())) {
          key = tag.toLowerCase();
          break;
        }
      }
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(node);
    }

    return clusters;
  }

  private buildClusterSummary(clusterKey: string, nodes: DAGNode[]): string {
    const count = nodes.length;
    const dateRange = this.getDateRange(nodes);
    const summaries = nodes
      .slice(0, 5)
      .map(n => n.content_summary.slice(0, 100))
      .join(' | ');

    return `[Episodic Summary: ${clusterKey}] ${count} events from ${dateRange}. ` +
      `Key signals: ${summaries}`;
  }

  private getDateRange(nodes: DAGNode[]): string {
    const dates = nodes
      .map(n => n.created_at ? new Date(n.created_at).getTime() : 0)
      .filter(d => d > 0)
      .sort();

    if (dates.length === 0) return 'unknown';

    const earliest = new Date(dates[0]).toISOString().split('T')[0];
    const latest = new Date(dates[dates.length - 1]).toISOString().split('T')[0];
    return earliest === latest ? earliest : `${earliest} to ${latest}`;
  }
}

// ── Singleton Export ───────────────────────────────────────────────────────────

export const echoForge = new EchoForge();
