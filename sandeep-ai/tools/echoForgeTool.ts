// tools/echoForgeTool.ts — Tool 18: EchoForge Predictive Memory Engine
import { BaseTool, ToolParameter } from './baseTool';
import { echoForge } from '../core/echoForge';
import { getRecentRippleResults, getActiveTrajectories, getDAGNodeCount } from '../db/echoForgeDb';

export class EchoForgeTool extends BaseTool {
  name = 'echoforge_engine';
  description = 'Tool 18 — EchoForge Predictive Memory Engine. Temporal predictive consolidation with causal ripple simulation. ' +
    'Builds a temporal memory DAG to proactively detect burnout trajectories, relationship drift, contradiction cascades, ' +
    'and simulate "what-if" memory evolutions. Provides predictive warnings rather than reactive analysis.';

  parameters: ToolParameter = {
    type: 'object',
    description: 'EchoForge Predictive Memory Engine parameters',
    properties: {
      operation: {
        type: 'string',
        enum: ['predictions', 'simulate', 'consolidate', 'trajectories', 'insights', 'status'],
        description:
          'predictions: get active risk alerts and predictions | ' +
          'simulate: run ripple simulation from a trigger node | ' +
          'consolidate: run hierarchical memory consolidation | ' +
          'trajectories: view active predictive trajectories | ' +
          'insights: get proactive insight strings | ' +
          'status: get DAG stats and health',
      },
      user_id: { type: 'number', description: 'User ID' },
      trigger_node_id: { type: 'number', description: 'DAG node ID to simulate ripples from (for simulate operation)' },
      prediction_type: {
        type: 'string',
        description: 'Filter predictions by type (burnout_risk, relationship_drift, contradiction_cascade)',
      },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, trigger_node_id, prediction_type } = params;

    try {
      if (operation === 'predictions') {
        const { highRiskAlerts, trajectories, dagSize } = await echoForge.getPredictions(user_id);

        const filteredAlerts = prediction_type
          ? highRiskAlerts.filter(a => a.prediction_type === prediction_type)
          : highRiskAlerts;

        return JSON.stringify({
          high_risk_alerts: filteredAlerts.map(a => ({
            prediction_type: a.prediction_type,
            risk_score: a.risk_score,
            confidence: a.confidence,
            explanation: a.explanation,
            created_at: a.created_at,
          })),
          active_trajectories: trajectories.length,
          dag_nodes: dagSize,
          message: filteredAlerts.length > 0
            ? `${filteredAlerts.length} active risk alert(s) detected`
            : 'No high-risk predictions currently active',
        });
      }

      if (operation === 'simulate') {
        if (!trigger_node_id) {
          return JSON.stringify({ error: 'trigger_node_id required for simulate operation' });
        }
        const result = await echoForge.simulateRipples(user_id, trigger_node_id);
        return JSON.stringify({
          predictions: result.predictions.map(p => ({
            type: p.type,
            risk_score: p.riskScore,
            confidence: p.confidence,
            explanation: p.explanation,
            affected_nodes: p.affectedNodeIds.length,
          })),
          trajectory_updates: result.trajectoryUpdates.length,
          message: result.predictions.length > 0
            ? `Ripple simulation found ${result.predictions.length} prediction(s)`
            : 'No significant ripple effects detected from this trigger',
        });
      }

      if (operation === 'consolidate') {
        const result = await echoForge.periodicConsolidate(user_id);
        return JSON.stringify({
          nodes_processed: result.nodesProcessed,
          episodic_nodes_created: result.episodicNodesCreated,
          nodes_decayed: result.nodesDecayed,
          nodes_pruned: result.nodesPruned,
          message: result.nodesProcessed > 0
            ? `Consolidated ${result.nodesProcessed} raw nodes into ${result.episodicNodesCreated} episodic summaries`
            : 'No nodes ready for consolidation',
        });
      }

      if (operation === 'trajectories') {
        const trajectories = await getActiveTrajectories(user_id);
        return JSON.stringify({
          trajectories: trajectories.map(t => ({
            thread_name: t.thread_name,
            predicted_state: t.predicted_state,
            confidence: t.confidence,
            horizon_days: t.horizon_days,
            created_at: t.created_at,
            expires_at: t.expires_at,
          })),
          total: trajectories.length,
          message: trajectories.length > 0
            ? `${trajectories.length} active trajectory prediction(s)`
            : 'No active trajectory predictions',
        });
      }

      if (operation === 'insights') {
        const insights = await echoForge.getProactiveInsights(user_id);
        return JSON.stringify({
          insights,
          total: insights.length,
          message: insights.length > 0
            ? 'Proactive insights generated from temporal memory analysis'
            : 'No proactive insights currently available — more data needed',
        });
      }

      if (operation === 'status') {
        const [dagSize, ripples, trajectories] = await Promise.all([
          getDAGNodeCount(user_id),
          getRecentRippleResults(user_id, undefined, 5),
          getActiveTrajectories(user_id),
        ]);

        return JSON.stringify({
          dag_nodes: dagSize,
          recent_ripple_simulations: ripples.length,
          active_trajectories: trajectories.length,
          recent_predictions: ripples.map(r => ({
            type: r.prediction_type,
            risk: r.risk_score,
            confidence: r.confidence,
          })),
          health: dagSize > 0 ? 'active' : 'initializing',
          message: `EchoForge DAG: ${dagSize} nodes, ${trajectories.length} trajectories, ${ripples.length} recent simulations`,
        });
      }

      return JSON.stringify({ error: `Unknown operation: ${operation}` });
    } catch (error: any) {
      return JSON.stringify({
        error: `EchoForge operation failed: ${error.message}`,
        operation,
      });
    }
  }
}
