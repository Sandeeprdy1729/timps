import { Router, Request, Response } from 'express';
import { eventBus } from '../core/eventBus';
import { Agent } from '../core/agent';
import { memoryIndex } from '../memory/memoryIndex';
import { query, execute } from '../db/postgres';
import { ContradictionTool } from '../tools/contradictionTool';
import { positionStore } from '../tools/positionStore';
import { logger } from '../logger';

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
    logger.warn('[ensureUser] Could not upsert user:', err);
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
    logger.error('Chat error:', error);
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
    logger.error('Memory retrieval error:', error);
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
    logger.error('Goals retrieval error:', error);
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
    logger.error('Goal creation error:', error);
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
    logger.error('Goal update error:', error);
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
    logger.error('Preferences retrieval error:', error);
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
    logger.error('Preference creation error:', error);
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
    logger.error('Projects retrieval error:', error);
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
    logger.error('Conversation creation error:', error);
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
    logger.error('Contradiction check error:', error);
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
    logger.error('Positions list error:', error);
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
    logger.error('Position store error:', error);
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
    logger.error('Position delete error:', error);
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
    logger.error('Contradiction history error:', error);
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


export default router;