// db/echoForgeDb.ts — Database operations for EchoForge Temporal Predictive Consolidation Engine
import { query, execute, queryOne } from './postgres';

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface DAGNode {
  id?: number;
  user_id: number;
  memory_id: number | null;
  node_type: 'raw' | 'episodic' | 'semantic' | 'predictive';
  content_summary: string;
  embedding_id: string | null;
  importance_score: number;
  temporal_weight: number;
  tags: string[];
  created_at?: Date;
  consolidated_at?: Date;
}

export interface DAGEdge {
  id?: number;
  user_id: number;
  source_node_id: number;
  target_node_id: number;
  edge_type: 'causal' | 'temporal' | 'semantic' | 'contradicts';
  weight: number;
  created_at?: Date;
}

export interface TrajectoryNode {
  id?: number;
  user_id: number;
  thread_name: string;
  predicted_state: Record<string, unknown>;
  confidence: number;
  horizon_days: number;
  source_node_ids: number[];
  created_at?: Date;
  expires_at?: Date;
}

export interface RippleResult {
  id?: number;
  user_id: number;
  trigger_node_id: number;
  affected_node_ids: number[];
  prediction_type: string;
  risk_score: number;
  confidence: number;
  explanation: string;
  created_at?: Date;
}

export interface ConsolidationLog {
  id?: number;
  user_id: number;
  merged_node_ids: number[];
  result_node_id: number;
  consolidation_type: string;
  nodes_merged: number;
  created_at?: Date;
}

// ── Schema Initialization ──────────────────────────────────────────────────────

export async function initEchoForgeTables(): Promise<void> {
  // DAG nodes — vertices of the temporal memory graph
  await execute(`
    CREATE TABLE IF NOT EXISTS echoforge_dag_nodes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      memory_id INTEGER REFERENCES memories(id) ON DELETE SET NULL,
      node_type VARCHAR(20) NOT NULL DEFAULT 'raw'
        CHECK (node_type IN ('raw', 'episodic', 'semantic', 'predictive')),
      content_summary TEXT NOT NULL,
      embedding_id VARCHAR(255),
      importance_score FLOAT DEFAULT 0.5,
      temporal_weight FLOAT DEFAULT 1.0,
      tags TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      consolidated_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dag_nodes_user ON echoforge_dag_nodes(user_id, node_type);
    CREATE INDEX IF NOT EXISTS idx_dag_nodes_memory ON echoforge_dag_nodes(memory_id);
    CREATE INDEX IF NOT EXISTS idx_dag_nodes_created ON echoforge_dag_nodes(user_id, created_at DESC);
  `);

  // DAG edges — directed relationships between nodes
  await execute(`
    CREATE TABLE IF NOT EXISTS echoforge_dag_edges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      source_node_id INTEGER REFERENCES echoforge_dag_nodes(id) ON DELETE CASCADE,
      target_node_id INTEGER REFERENCES echoforge_dag_nodes(id) ON DELETE CASCADE,
      edge_type VARCHAR(20) NOT NULL DEFAULT 'temporal'
        CHECK (edge_type IN ('causal', 'temporal', 'semantic', 'contradicts')),
      weight FLOAT DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_node_id, target_node_id, edge_type)
    );
    CREATE INDEX IF NOT EXISTS idx_dag_edges_source ON echoforge_dag_edges(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_dag_edges_target ON echoforge_dag_edges(target_node_id);
    CREATE INDEX IF NOT EXISTS idx_dag_edges_user ON echoforge_dag_edges(user_id);
  `);

  // Trajectory nodes — lightweight predictive forks per life thread
  await execute(`
    CREATE TABLE IF NOT EXISTS echoforge_trajectories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      thread_name VARCHAR(100) NOT NULL,
      predicted_state JSONB NOT NULL DEFAULT '{}',
      confidence FLOAT DEFAULT 0.5,
      horizon_days INTEGER DEFAULT 30,
      source_node_ids INTEGER[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trajectories_user ON echoforge_trajectories(user_id, thread_name);
  `);

  // Ripple simulation results — stored predictions from causal propagation
  await execute(`
    CREATE TABLE IF NOT EXISTS echoforge_ripple_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      trigger_node_id INTEGER REFERENCES echoforge_dag_nodes(id) ON DELETE CASCADE,
      affected_node_ids INTEGER[] DEFAULT '{}',
      prediction_type VARCHAR(100) NOT NULL,
      risk_score FLOAT DEFAULT 0,
      confidence FLOAT DEFAULT 0.5,
      explanation TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ripple_user ON echoforge_ripple_results(user_id, prediction_type);
    CREATE INDEX IF NOT EXISTS idx_ripple_trigger ON echoforge_ripple_results(trigger_node_id);
  `);

  // Consolidation log — audit trail for hierarchical merges
  await execute(`
    CREATE TABLE IF NOT EXISTS echoforge_consolidation_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      merged_node_ids INTEGER[] NOT NULL,
      result_node_id INTEGER REFERENCES echoforge_dag_nodes(id) ON DELETE SET NULL,
      consolidation_type VARCHAR(50) NOT NULL,
      nodes_merged INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_consolidation_user ON echoforge_consolidation_log(user_id, created_at DESC);
  `);

  console.log('[EchoForge] Database tables initialized');
}

// ── DAG Node Operations ────────────────────────────────────────────────────────

export async function createDAGNode(node: Omit<DAGNode, 'id' | 'created_at'>): Promise<DAGNode> {
  const rows = await query<DAGNode>(
    `INSERT INTO echoforge_dag_nodes
     (user_id, memory_id, node_type, content_summary, embedding_id, importance_score, temporal_weight, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [node.user_id, node.memory_id, node.node_type, node.content_summary,
     node.embedding_id, node.importance_score, node.temporal_weight, node.tags]
  );
  return rows[0];
}

export async function getRecentDAGNodes(
  userId: number,
  limit: number = 10,
  nodeType?: string
): Promise<DAGNode[]> {
  if (nodeType) {
    return query<DAGNode>(
      `SELECT * FROM echoforge_dag_nodes
       WHERE user_id = $1 AND node_type = $2
       ORDER BY created_at DESC LIMIT $3`,
      [userId, nodeType, limit]
    );
  }
  return query<DAGNode>(
    `SELECT * FROM echoforge_dag_nodes
     WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
}

export async function getDAGNodeById(nodeId: number): Promise<DAGNode | null> {
  return queryOne<DAGNode>(
    `SELECT * FROM echoforge_dag_nodes WHERE id = $1`,
    [nodeId]
  );
}

export async function updateDAGNodeType(
  nodeId: number,
  newType: DAGNode['node_type']
): Promise<void> {
  await execute(
    `UPDATE echoforge_dag_nodes SET node_type = $1, consolidated_at = NOW() WHERE id = $2`,
    [newType, nodeId]
  );
}

export async function getDAGNodeCount(userId: number): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM echoforge_dag_nodes WHERE user_id = $1`,
    [userId]
  );
  return row ? parseInt(row.count, 10) : 0;
}

export async function getUnconslidatedNodes(
  userId: number,
  limit: number = 100
): Promise<DAGNode[]> {
  return query<DAGNode>(
    `SELECT * FROM echoforge_dag_nodes
     WHERE user_id = $1 AND node_type = 'raw' AND consolidated_at IS NULL
     ORDER BY created_at ASC LIMIT $2`,
    [userId, limit]
  );
}

// ── DAG Edge Operations ────────────────────────────────────────────────────────

export async function createDAGEdge(edge: Omit<DAGEdge, 'id' | 'created_at'>): Promise<DAGEdge | null> {
  // Prevent self-loops
  if (edge.source_node_id === edge.target_node_id) return null;

  try {
    const rows = await query<DAGEdge>(
      `INSERT INTO echoforge_dag_edges
       (user_id, source_node_id, target_node_id, edge_type, weight)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_node_id, target_node_id, edge_type) DO UPDATE SET weight = $5
       RETURNING *`,
      [edge.user_id, edge.source_node_id, edge.target_node_id, edge.edge_type, edge.weight]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function getOutgoingEdges(nodeId: number): Promise<DAGEdge[]> {
  return query<DAGEdge>(
    `SELECT * FROM echoforge_dag_edges WHERE source_node_id = $1`,
    [nodeId]
  );
}

export async function getIncomingEdges(nodeId: number): Promise<DAGEdge[]> {
  return query<DAGEdge>(
    `SELECT * FROM echoforge_dag_edges WHERE target_node_id = $1`,
    [nodeId]
  );
}

export async function getNeighborNodes(
  nodeId: number,
  depth: number = 2
): Promise<DAGNode[]> {
  // Use recursive CTE for bounded graph traversal
  return query<DAGNode>(
    `WITH RECURSIVE reachable AS (
       SELECT target_node_id AS node_id, 1 AS depth
       FROM echoforge_dag_edges WHERE source_node_id = $1
       UNION
       SELECT e.target_node_id, r.depth + 1
       FROM echoforge_dag_edges e
       JOIN reachable r ON e.source_node_id = r.node_id
       WHERE r.depth < $2
     )
     SELECT DISTINCT n.* FROM echoforge_dag_nodes n
     JOIN reachable r ON n.id = r.node_id`,
    [nodeId, depth]
  );
}

// ── Trajectory Operations ──────────────────────────────────────────────────────

export async function upsertTrajectory(trajectory: Omit<TrajectoryNode, 'id' | 'created_at'>): Promise<TrajectoryNode> {
  const rows = await query<TrajectoryNode>(
    `INSERT INTO echoforge_trajectories
     (user_id, thread_name, predicted_state, confidence, horizon_days, source_node_ids, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($5 || ' days')::INTERVAL)
     RETURNING *`,
    [trajectory.user_id, trajectory.thread_name, JSON.stringify(trajectory.predicted_state),
     trajectory.confidence, trajectory.horizon_days, trajectory.source_node_ids]
  );
  return rows[0];
}

export async function getActiveTrajectories(userId: number): Promise<TrajectoryNode[]> {
  return query<TrajectoryNode>(
    `SELECT * FROM echoforge_trajectories
     WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY confidence DESC`,
    [userId]
  );
}

export async function getTrajectoryByThread(
  userId: number,
  threadName: string
): Promise<TrajectoryNode | null> {
  return queryOne<TrajectoryNode>(
    `SELECT * FROM echoforge_trajectories
     WHERE user_id = $1 AND thread_name = $2 AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC LIMIT 1`,
    [userId, threadName]
  );
}

// ── Ripple Result Operations ───────────────────────────────────────────────────

export async function storeRippleResult(result: Omit<RippleResult, 'id' | 'created_at'>): Promise<RippleResult> {
  const rows = await query<RippleResult>(
    `INSERT INTO echoforge_ripple_results
     (user_id, trigger_node_id, affected_node_ids, prediction_type, risk_score, confidence, explanation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [result.user_id, result.trigger_node_id, result.affected_node_ids,
     result.prediction_type, result.risk_score, result.confidence, result.explanation]
  );
  return rows[0];
}

export async function getRecentRippleResults(
  userId: number,
  predictionType?: string,
  limit: number = 10
): Promise<RippleResult[]> {
  if (predictionType) {
    return query<RippleResult>(
      `SELECT * FROM echoforge_ripple_results
       WHERE user_id = $1 AND prediction_type = $2
       ORDER BY created_at DESC LIMIT $3`,
      [userId, predictionType, limit]
    );
  }
  return query<RippleResult>(
    `SELECT * FROM echoforge_ripple_results
     WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
}

export async function getHighRiskRipples(
  userId: number,
  minRisk: number = 0.6
): Promise<RippleResult[]> {
  return query<RippleResult>(
    `SELECT * FROM echoforge_ripple_results
     WHERE user_id = $1 AND risk_score >= $2
     ORDER BY risk_score DESC, created_at DESC LIMIT 20`,
    [userId, minRisk]
  );
}

// ── Consolidation Log Operations ───────────────────────────────────────────────

export async function logConsolidation(log: Omit<ConsolidationLog, 'id' | 'created_at'>): Promise<ConsolidationLog> {
  const rows = await query<ConsolidationLog>(
    `INSERT INTO echoforge_consolidation_log
     (user_id, merged_node_ids, result_node_id, consolidation_type, nodes_merged)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [log.user_id, log.merged_node_ids, log.result_node_id, log.consolidation_type, log.nodes_merged]
  );
  return rows[0];
}

// ── Temporal Decay ─────────────────────────────────────────────────────────────

export async function applyTemporalDecay(
  userId: number,
  decayRate: number = 0.995
): Promise<number> {
  const result = await execute(
    `UPDATE echoforge_dag_nodes
     SET temporal_weight = temporal_weight * $2
     WHERE user_id = $1 AND node_type IN ('raw', 'episodic')
       AND temporal_weight > 0.01`,
    [userId, decayRate]
  );
  return result;
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

export async function pruneExpiredTrajectories(): Promise<number> {
  return execute(
    `DELETE FROM echoforge_trajectories WHERE expires_at < NOW()`
  );
}

export async function pruneDecayedNodes(
  userId: number,
  minWeight: number = 0.01
): Promise<number> {
  return execute(
    `DELETE FROM echoforge_dag_nodes
     WHERE user_id = $1 AND temporal_weight < $2 AND node_type = 'raw'`,
    [userId, minWeight]
  );
}
