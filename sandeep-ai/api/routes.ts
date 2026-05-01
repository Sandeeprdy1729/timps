import { Router, Request, Response } from 'express';
import { eventBus } from '../core/eventBus';
import { Agent } from '../core/agent';
import { memoryIndex } from '../memory/memoryIndex';
import { query, execute } from '../db/postgres';
import { ContradictionTool } from '../tools/contradictionTool';
import { positionStore } from '../tools/positionStore';
import { nexusForge } from '../core/nexusForge';
import { chronosVeil, ChronosSignal } from '../core/chronosVeil';
import { synapseMetabolon, MetabolicSignal } from '../core/synapseMetabolon';

const router = Router();
const contradictionTool = new ContradictionTool();

// ─── Ensure user row exists before any DB operation that needs it ──────────
async function ensureUser(userId: number, username?: string): Promise<void> {
  try {
    const existing = await query<{ id: number }>('SELECT id FROM users WHERE id = $1', [userId]);
    if (existing.length === 0) {
      const uuid = `user_${userId}_${Date.now()}`;
      await execute(
        `INSERT INTO users (id, uuid, username)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET username = COALESCE(EXCLUDED.username, users.username)`,
        [userId, uuid, username || `user_${userId}`]
      );
      await execute(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    } else if (username) {
      await execute(`UPDATE users SET username = $1 WHERE id = $2`, [username, userId]);
    }
  } catch (err) {
    // Non-fatal: log and continue — agent can still run without DB user row
    console.warn('[ensureUser] Could not upsert user:', err);
  }
}

interface ChatRequest {
  userId: number;
  username?: string;
  message: string;
  systemPrompt?: string;
  clearConversation?: boolean;
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { userId, username, message, systemPrompt, clearConversation } = req.body as ChatRequest;
    
    if (!userId || !message) {
      res.status(400).json({ error: 'userId and message are required' });
      return;
    }

    await ensureUser(userId, username);
    
    const agent = new Agent({ userId, username, systemPrompt });
    
    if (clearConversation) {
      agent.clearConversation();
    }
    
    const response = await agent.run(message);
    
    // Emit real-time events for each activated tool
    const activated = response.toolsActivated || [];
    activated.forEach(toolName => {
      eventBus.emit({
        type: 'tool_activated',
        userId,
        payload: { tool: toolName, message: message.slice(0, 100) },
        timestamp: new Date().toISOString(),
      });
    });

    // Emit chat message event for live feed
    eventBus.emit({
      type: 'chat_message',
      userId,
      payload: {
        userMessage: message.slice(0, 200),
        response: response.content.slice(0, 300),
        toolsActivated: activated,
      },
      timestamp: new Date().toISOString(),
    });

    res.json({
      response: response.content,
      toolResults: response.toolResults,
      iterations: response.iterations,
      toolsActivated: activated,
      planExecuted: response.planExecuted || false,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/memory/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    const context = await memoryIndex.retrieveContext(userId, '', '');
    res.json({
      memories: context.memories,
      goals: context.goals,
      preferences: context.preferences,
      projects: context.projects,
    });
  } catch (error: any) {
    console.error('Memory retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/goals/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    const goals = await query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY priority DESC, created_at DESC',
      [userId]
    );
    res.json({ goals });
  } catch (error: any) {
    console.error('Goals retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/goals/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { title, description, priority, targetDate } = req.body;
    if (isNaN(userId) || !title) {
      res.status(400).json({ error: 'Invalid userId or missing title' });
      return;
    }
    await ensureUser(userId);
    const goal = await memoryIndex.storeGoal(
      userId, title, description, priority || 1,
      targetDate ? new Date(targetDate) : undefined
    );
    res.json({ goal });
  } catch (error: any) {
    console.error('Goal creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const { status } = req.body;
    if (isNaN(goalId)) {
      res.status(400).json({ error: 'Invalid goalId' });
      return;
    }
    await query(
      'UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, goalId]
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Goal update error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/preferences/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    const preferences = await query(
      'SELECT * FROM preferences WHERE user_id = $1 ORDER BY category, preference_key',
      [userId]
    );
    res.json({ preferences });
  } catch (error: any) {
    console.error('Preferences retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/preferences/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { key, value, category } = req.body;
    if (isNaN(userId) || !key || !value) {
      res.status(400).json({ error: 'Invalid userId, key, or value' });
      return;
    }
    await ensureUser(userId);
    const preference = await memoryIndex.storePreference(userId, key, value, category);
    res.json({ preference });
  } catch (error: any) {
    console.error('Preference creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    const projects = await query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ projects });
  } catch (error: any) {
    console.error('Projects retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { title } = req.body;
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    await ensureUser(userId);
    const conversation = await query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title || 'New Conversation']
    );
    res.json({ conversation: conversation[0] });
  } catch (error: any) {
    console.error('Conversation creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 5 — Argument DNA Mapper endpoints
// ─────────────────────────────────────────────────────────────────────────────

router.post('/contradiction/check', async (req: Request, res: Response) => {
  try {
    const { userId, text, projectId, autoStore } = req.body;
    if (!userId || !text) {
      res.status(400).json({ error: 'userId and text are required' });
      return;
    }
    await ensureUser(userId);
    const raw = await contradictionTool.execute({
      operation: 'check',
      user_id: userId,
      text,
      project_id: projectId || 'default',
      auto_store: autoStore !== false,
    });
    const result = JSON.parse(raw);
    // Emit real-time event if contradiction detected
    if (result.verdict === 'CONTRADICTION' || result.verdict === 'PARTIAL') {
      eventBus.emit({
        type: 'contradiction',
        userId: req.body.userId,
        payload: {
          score: result.contradiction_score,
          verdict: result.verdict,
          claim: result.conflicting_position?.extracted_claim,
          new_text: req.body.text?.slice(0, 100),
        },
        timestamp: new Date().toISOString(),
      });
    }
    res.json(result);
  } catch (error: any) {
    console.error('Contradiction check error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/positions/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const projectId = (req.query.projectId as string) || 'default';
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    const positions = await positionStore.getUserPositions(userId, projectId);
    res.json({ positions, total: positions.length });
  } catch (error: any) {
    console.error('Positions list error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/positions/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { text, projectId } = req.body;
    if (isNaN(userId) || !text) {
      res.status(400).json({ error: 'Invalid userId or missing text' });
      return;
    }
    await ensureUser(userId);
    const raw = await contradictionTool.execute({
      operation: 'store',
      user_id: userId,
      text,
      project_id: projectId || 'default',
    });
    res.json(JSON.parse(raw));
  } catch (error: any) {
    console.error('Position store error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/positions/:userId/:positionId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const positionId = parseInt(req.params.positionId, 10);
    if (isNaN(userId) || isNaN(positionId)) {
      res.status(400).json({ error: 'Invalid userId or positionId' });
      return;
    }
    const raw = await contradictionTool.execute({
      operation: 'delete',
      user_id: userId,
      position_id: positionId,
    });
    res.json(JSON.parse(raw));
  } catch (error: any) {
    console.error('Position delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/contradiction/history/:positionId', async (req: Request, res: Response) => {
  try {
    const positionId = parseInt(req.params.positionId, 10);
    if (isNaN(positionId)) {
      res.status(400).json({ error: 'Invalid positionId' });
      return;
    }
    const history = await positionStore.getContradictionHistory(positionId);
    res.json({ history, total: history.length });
  } catch (error: any) {
    console.error('Contradiction history error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ─── Dashboard API endpoints ──────────────────────────────────────────────────

router.get('/dashboard/burnout/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const signals = await query(
      `SELECT signal_type, value, baseline_value, deviation_pct, recorded_at
       FROM burnout_signals WHERE user_id=$1
       ORDER BY recorded_at DESC LIMIT 30`,
      [userId]
    );
    const baseline = await query(
      `SELECT baseline_data FROM burnout_baseline WHERE user_id=$1`, [userId]
    );
    const analysis = await query(
      `SELECT signal_type, AVG(value) as avg_val, AVG(baseline_value) as avg_base
       FROM burnout_signals WHERE user_id=$1 AND recorded_at > NOW() - INTERVAL '6 weeks'
       GROUP BY signal_type`,
      [userId]
    );
    res.json({ signals, baseline: baseline[0]?.baseline_data || null, analysis });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard/commitments/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const pending = await query(
      `SELECT id, person_name, commitment, due_date, status, meeting_title, meeting_date
       FROM meeting_commitments WHERE user_id=$1
       ORDER BY status ASC, due_date ASC NULLS LAST LIMIT 20`,
      [userId]
    );
    const counts = await query(
      `SELECT status, COUNT(*) as count FROM meeting_commitments WHERE user_id=$1 GROUP BY status`,
      [userId]
    );
    res.json({ commitments: pending, counts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard/relationships/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const health = await query(
      `SELECT contact_name, health_score, drift_alert, last_interaction, computed_at
       FROM relationship_health WHERE user_id=$1 ORDER BY health_score ASC`,
      [userId]
    );
    res.json({ relationships: health, total: health.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard/bugs/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const bugs = await query(
      `SELECT bug_type, trigger_context, frequency, last_occurrence
       FROM bug_patterns WHERE user_id=$1 ORDER BY frequency DESC`,
      [userId]
    );
    res.json({ bugs, total: bugs.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard/manifesto/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const manifesto = await query(
      `SELECT content, updated_at FROM manifestos WHERE user_id=$1`, [userId]
    );
    const values = await query(
      `SELECT inferred_value, frequency FROM value_observations WHERE user_id=$1
       ORDER BY frequency DESC LIMIT 8`,
      [userId]
    );
    res.json({
      manifesto: manifesto[0]?.content || null,
      updated_at: manifesto[0]?.updated_at || null,
      values
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard/stats/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const [memories, positions, commitments, relationships, bugs, decisions] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM memories WHERE user_id=$1`, [userId]),
      query(`SELECT COUNT(*) as count FROM positions WHERE user_id=$1`, [userId]),
      query(`SELECT COUNT(*) as count FROM meeting_commitments WHERE user_id=$1 AND status='pending'`, [userId]),
      query(`SELECT COUNT(*) as count FROM relationship_health WHERE user_id=$1`, [userId]),
      query(`SELECT COUNT(*) as count FROM bug_patterns WHERE user_id=$1`, [userId]),
      query(`SELECT COUNT(*) as count FROM decisions WHERE user_id=$1`, [userId]),
    ]);
    res.json({
      memories: parseInt((memories[0] as any).count),
      positions: parseInt((positions[0] as any).count),
      commitments: parseInt((commitments[0] as any).count),
      relationships: parseInt((relationships[0] as any).count),
      bugs: parseInt((bugs[0] as any).count),
      decisions: parseInt((decisions[0] as any).count),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// ─── Real-time SSE endpoint ───────────────────────────────────────────────────
router.get('/events/:userId', (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send connected confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', userId, timestamp: new Date().toISOString() })}\n\n`);

  // Send heartbeat every 20s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); }
  }, 20000);

  eventBus.subscribe(userId, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.unsubscribe(userId, res);
  });
});

// ─── NexusForge API Routes ───────────────────────────────────────────────

router.post('/nexus/ingest', async (req: Request, res: Response) => {
  try {
    const { userId, projectId, content, tags, metadata, sourceModule } = req.body;
    if (!content || !sourceModule) {
      res.status(400).json({ error: 'content and sourceModule required' });
      return;
    }

    const signal = {
      userId: userId || 1,
      projectId,
      content,
      tags: tags || [],
      metadata: metadata || {},
    };

    const nodeId = await nexusForge.episodicIndexer(signal, sourceModule);
    if (nodeId) {
      await nexusForge.evolutionOracle(signal, { projectId: projectId || 'default' });
      res.json({ success: true, nodeId });
    } else {
      res.json({ success: false, message: 'NexusForge disabled or error' });
    }
  } catch (err: any) {
    console.error('[nexus/ingest] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/nexus/query', async (req: Request, res: Response) => {
  try {
    const { query: q, userId, projectId } = req.body;
    if (!q) {
      res.status(400).json({ error: 'query required' });
      return;
    }

    const result = await nexusForge.retrievalWeaver(
      q,
      userId || 1,
      { projectId: projectId || 'default' }
    );

    res.json(result);
  } catch (err: any) {
    console.error('[nexus/query] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/nexus/stats/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const [totalNodes, totalEdges, totalCausal, sources] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM nexus_episodic_nodes WHERE user_id = $1`, [userId]),
      query(`SELECT COUNT(*) as count FROM nexus_temporal_edges WHERE source_node_id IN (SELECT node_id FROM nexus_episodic_nodes WHERE user_id = $1)`, [userId]),
      query(`SELECT COUNT(*) as count FROM nexus_causal_edges WHERE source_node_id IN (SELECT node_id FROM nexus_episodic_nodes WHERE user_id = $1)`, [userId]),
      query(`SELECT source_module, COUNT(*) as count FROM nexus_episodic_nodes WHERE user_id = $1 GROUP BY source_module`, [userId]),
    ]);

    res.json({
      totalNodes: parseInt((totalNodes[0] as any).count),
      totalEdges: parseInt((totalEdges[0] as any).count),
      totalCausal: parseInt((totalCausal[0] as any).count),
      sources: sources.reduce((acc: any, row: any) => { acc[row.source_module] = parseInt(row.count); return acc; }, {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/nexus/graph/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit as string) || 30;
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const [nodes, edges] = await Promise.all([
      query(`SELECT node_id, gist, facts, entity_keys, content, source_module, created_at, metadata
             FROM nexus_episodic_nodes WHERE user_id = $1
             ORDER BY created_at DESC LIMIT $2`, [userId, limit]),
      query(`SELECT source_node_id, target_node_id, edge_type, confidence, provenance_module
             FROM nexus_temporal_edges
             WHERE source_node_id IN (SELECT node_id FROM nexus_episodic_nodes WHERE user_id = $1)
             ORDER BY created_at DESC LIMIT $2`, [userId, limit * 2]),
    ]);

    const enrichedNodes = nodes.map((n: any) => ({
      ...n,
      isCoding: ['timps-code', 'timps-vscode', 'timps-mcp', 'cli', 'code'].some(s => n.source_module?.includes(s)),
    }));

    res.json({ nodes: enrichedNodes, edges });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── ChronosVeil API Routes ───────────────────────────────────────────────

router.post('/chronos/ingest', async (req: Request, res: Response) => {
  try {
    const { userId, projectId, content, tags, entity, metadata, sourceModule } = req.body;
    if (!content || !sourceModule) {
      res.status(400).json({ error: 'content and sourceModule required' });
      return;
    }

    const signal: ChronosSignal = {
      userId: userId || 1,
      projectId: projectId || 'default',
      content,
      tags: tags || [],
      entity,
      metadata: metadata || {},
    };

    const result = await chronosVeil.ingestEvent(signal, sourceModule);

    eventBus.emit({
      type: 'chronos_event',
      userId: userId || 1,
      payload: {
        eventId: result.eventId,
        layer: result.layer,
        entities: result.entities,
        supersedes: result.supersedes,
      },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, eventId: result.eventId, layer: result.layer, entities: result.entities });
  } catch (err: any) {
    console.error('[chronos/ingest] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/chronos/query', async (req: Request, res: Response) => {
  try {
    const { query: q, userId, projectId, limit } = req.body;
    if (!q) {
      res.status(400).json({ error: 'query required' });
      return;
    }

    const resolved = await chronosVeil.queryWithVeil(
      q,
      userId || 1,
      projectId || 'default',
      limit || 8
    );

    res.json(resolved);
  } catch (err: any) {
    console.error('[chronos/query] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/chronos/context/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const projectId = (req.query.projectId as string) || 'default';
    const { query: q } = req.query;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    if (!q) {
      res.status(400).json({ error: 'query parameter required' });
      return;
    }

    const context = await chronosVeil.buildVeilContext(String(q), userId, projectId, 5);
    res.json({ context });
  } catch (err: any) {
    console.error('[chronos/context] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/chronos/stats/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const [total, byLayer, recent] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM chronos_events WHERE user_id = $1`, [userId]),
      query(`SELECT layer, COUNT(*) as count FROM chronos_events WHERE user_id = $1 GROUP BY layer`, [userId]),
      query(`SELECT event_id, layer, entity_keys, content, confidence, created_at
             FROM chronos_events WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 10`, [userId]),
    ]);

    res.json({
      total: parseInt((total[0] as any).count),
      byLayer: byLayer.reduce((acc: any, row: any) => { acc[row.layer] = parseInt(row.count); return acc; }, {}),
      recent,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chronos/edges/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const edges = await query(
      `SELECT e.source_event_id, e.target_event_id, e.edge_type, e.confidence,
              e.entity_keys, e.created_at
       FROM chronos_entity_edges e
       JOIN chronos_events c ON c.event_id = e.target_event_id
       WHERE c.user_id = $1
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ edges, total: edges.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── SynapseMetabolon API Routes ─────────────────────────────────────────────

router.post('/synapse/ingest', async (req: Request, res: Response) => {
  try {
    const { userId, projectId, content, tags, entity, metadata, sourceModule, confidence, outcomeScore } = req.body;
    if (!content || !sourceModule) {
      res.status(400).json({ error: 'content and sourceModule required' });
      return;
    }

    const signal: MetabolicSignal = {
      userId: userId || 1,
      projectId: projectId || 'default',
      content,
      tags: tags || [],
      entity,
      confidence,
      outcomeScore,
      metadata: metadata || {},
    };

    const result = await synapseMetabolon.injectEvent(signal, sourceModule);

    eventBus.emit({
      type: 'synapse_event',
      userId: userId || 1,
      payload: {
        nodeId: result.nodeId,
        layer: result.layer,
        entities: result.entities,
        activation: result.activation,
      },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, nodeId: result.nodeId, layer: result.layer, activation: result.activation, entities: result.entities });
  } catch (err: any) {
    console.error('[synapse/ingest] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/synapse/query', async (req: Request, res: Response) => {
  try {
    const { query: q, userId, projectId, limit } = req.body;
    if (!q) {
      res.status(400).json({ error: 'query required' });
      return;
    }

    const result = await synapseMetabolon.queryWithSpread(
      q,
      userId || 1,
      projectId || 'default',
      limit || 10
    );

    res.json(result);
  } catch (err: any) {
    console.error('[synapse/query] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/synapse/context/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const projectId = (req.query.projectId as string) || 'default';
    const { query: q } = req.query;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    if (!q) {
      res.status(400).json({ error: 'query parameter required' });
      return;
    }

    const context = await synapseMetabolon.buildMetabolicContext(String(q), userId, projectId, 5);
    res.json({ context });
  } catch (err: any) {
    console.error('[synapse/context] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/synapse/stats/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const projectId = (req.query.projectId as string) || 'default';

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const stats = await synapseMetabolon.getStats(userId, projectId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/synapse/graph/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit as string) || 30;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const graph = await synapseMetabolon.getGraph(userId, limit);
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/synapse/consolidate/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const projectId = (req.body.projectId as string) || 'default';

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const result = await synapseMetabolon.runConsolidationCycle(userId, projectId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


export default router;