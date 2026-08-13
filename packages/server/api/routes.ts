import { Router, Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eventBus } from '../core/eventBus';
import { Agent } from '../core/agent';
import { memoryIndex } from '../memory/memoryIndex';
import { query, execute, dbAvailable } from '../db/postgres';
import { ContradictionTool } from '../tools/contradictionTool';
import { positionStore } from '../tools/positionStore';
import { nexusForge } from '../core/nexusForge';
import { chronosVeil, ChronosSignal } from '../core/chronosVeil';
import { synapseMetabolon, MetabolicSignal } from '../core/synapseMetabolon';
import { chronosForge } from '../memory/chronosForge.js';

const router = Router();
const contradictionTool = new ContradictionTool();

const JWT_SECRET = process.env.TIMPS_JWT_SECRET ?? '';

// JWT auth middleware — extracts verified userId from Authorization header
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = auth.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) { res.status(401).json({ error: 'Invalid token format' }); return; }
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      res.status(401).json({ error: 'Token expired' }); return;
    }
    if (!JWT_SECRET) { res.status(500).json({ error: 'Server not configured for auth' }); return; }
    const alg = header.alg ?? 'HS256';
    if (alg !== 'HS256') { res.status(401).json({ error: 'Unsupported algorithm' }); return; }
    const sig = createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(parts[2]))) {
      res.status(401).json({ error: 'Invalid token signature' }); return;
    }
    (req as any).authenticatedUserId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Helper to get the effective userId (from auth if available, fallback to request value)
function effectiveUserId(req: Request, fallback: number | null): number | null {
  const authId = (req as any).authenticatedUserId as number | undefined;
  if (authId !== undefined) return authId;
  return fallback;
}

// Middleware: requireAuth + verify route param userId matches authenticated user
function requireUserId(param = 'userId'): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const authId = (req as any).authenticatedUserId as number | undefined;
    const paramId = parseInt(req.params[param], 10);
    if (!authId || isNaN(paramId) || authId !== paramId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    next();
  };
}

// Helper: returns a meaningful error string regardless of error type
function errMsg(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'Internal server error';
}

// Helper: log the real error server-side but never expose internal details
// (DB driver/SQL strings, stack traces) to the client.
function dbError(res: Response, err: unknown): void {
  console.error('[db] Request failed:', err);
  res.status(500).json({ error: 'Internal server error' });
}

// Guard for routes that require a live database
function requireDb(res: Response): boolean {
  if (!dbAvailable) {
    res.status(503).json({
      error: 'Database unavailable. Set POSTGRES_HOST or DATABASE_URL in your .env file.',
      docs: 'https://github.com/Sandeeprdy1729/timps#quick-start-manual',
    });
    return false;
  }
  return true;
}

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

type JsonObject = Record<string, unknown>;

function bodyObject(body: unknown): JsonObject | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as JsonObject : null;
}

function positiveInt(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function requiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function optionalBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function boundedPositiveInt(value: unknown, min: number, max: number): number | null {
  const parsed = positiveInt(value);
  if (!parsed) return null;
  return parsed >= min && parsed <= max ? parsed : null;
}

router.post('/chat', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const message = requiredString(body?.message, 20_000);
    const username = optionalString(body?.username, 120);
    const systemPrompt = optionalString(body?.systemPrompt, 20_000);
    const clearConversation = optionalBool(body?.clearConversation);
    
    if (!userId || !message) {
      res.status(400).json({ error: 'userId must be a positive integer and message must be a non-empty string' });
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.get('/memory/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = parseInt(req.params.userId, 10);
    const context = await memoryIndex.retrieveContext(userId, '', '');
    res.json({
      memories: context.memories,
      goals: context.goals,
      preferences: context.preferences,
      projects: context.projects,
    });
  } catch (error: any) {
    console.error('Memory retrieval error:', error);
    res.status(500).json({ error: errMsg(error) });
  }
});

router.get('/goals/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.post('/goals/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = positiveInt(req.params.userId);
    const body = bodyObject(req.body);
    const title = requiredString(body?.title, 240);
    const description = optionalString(body?.description, 5_000);
    const priority = body?.priority === undefined ? 1 : positiveInt(body.priority);
    const targetDate = optionalString(body?.targetDate, 80);
    if (!userId || !title || !priority) {
      res.status(400).json({ error: 'Invalid userId, title, or priority' });
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.put('/goals/:goalId', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const goalId = positiveInt(req.params.goalId);
    const body = bodyObject(req.body);
    const status = requiredString(body?.status, 80);
    if (!goalId || !status) {
      res.status(400).json({ error: 'Invalid goalId or status' });
      return;
    }
    await query(
      'UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, goalId]
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Goal update error:', error);
    res.status(500).json({ error: errMsg(error) });
  }
});

router.get('/preferences/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.post('/preferences/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = positiveInt(req.params.userId);
    const body = bodyObject(req.body);
    const key = requiredString(body?.key, 160);
    const value = requiredString(body?.value, 5_000);
    const category = optionalString(body?.category, 160);
    if (!userId || !key || !value) {
      res.status(400).json({ error: 'Invalid userId, key, or value' });
      return;
    }
    await ensureUser(userId);
    const preference = await memoryIndex.storePreference(userId, key, value, category);
    res.json({ preference });
  } catch (error: any) {
    console.error('Preference creation error:', error);
    res.status(500).json({ error: errMsg(error) });
  }
});

router.get('/projects/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.post('/conversations/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = positiveInt(req.params.userId);
    const body = bodyObject(req.body);
    const title = optionalString(body?.title, 240) || 'New Conversation';
    if (!userId) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    await ensureUser(userId);
    const conversation = await query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title]
    );
    res.json({ conversation: conversation[0] });
  } catch (error: any) {
    console.error('Conversation creation error:', error);
    res.status(500).json({ error: errMsg(error) });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 5 — Argument DNA Mapper endpoints
// ─────────────────────────────────────────────────────────────────────────────

router.post('/contradiction/check', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const text = requiredString(body?.text, 20_000);
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const autoStore = optionalBool(body?.autoStore);
    if (!userId || !text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    await ensureUser(userId);
    const raw = await contradictionTool.execute({
      operation: 'check',
      user_id: userId,
      text,
      project_id: projectId,
      auto_store: autoStore !== false,
    });
    const result = JSON.parse(raw);
    // Emit real-time event if contradiction detected
    if (result.verdict === 'CONTRADICTION' || result.verdict === 'PARTIAL') {
      eventBus.emit({
        type: 'contradiction',
        userId,
        payload: {
          score: result.contradiction_score,
          verdict: result.verdict,
          claim: result.conflicting_position?.extracted_claim,
          new_text: text.slice(0, 100),
        },
        timestamp: new Date().toISOString(),
      });
    }
    res.json(result);
  } catch (error: any) {
    console.error('Contradiction check error:', error);
    res.status(500).json({ error: errMsg(error) });
  }
});

router.get('/positions/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.post('/positions/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = positiveInt(req.params.userId);
    const body = bodyObject(req.body);
    const text = requiredString(body?.text, 20_000);
    const projectId = optionalString(body?.projectId, 160) || 'default';
    if (!userId || !text) {
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.delete('/positions/:userId/:positionId', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(error) });
  }
});

router.get('/contradiction/history/:positionId', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(error) });
  }
});


// ─── Dashboard API endpoints ──────────────────────────────────────────────────

router.get('/dashboard/burnout/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }
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
  } catch (e) { dbError(res, e); }
});

router.get('/dashboard/commitments/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }
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
  } catch (e) { dbError(res, e); }
});

router.get('/dashboard/relationships/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }
    const health = await query(
      `SELECT contact_name, health_score, drift_alert, last_interaction, computed_at
       FROM relationship_health WHERE user_id=$1 ORDER BY health_score ASC`,
      [userId]
    );
    res.json({ relationships: health, total: health.length });
  } catch (e) { dbError(res, e); }
});

router.get('/dashboard/bugs/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }
    const bugs = await query(
      `SELECT bug_type, trigger_context, frequency, last_occurrence
       FROM bug_patterns WHERE user_id=$1 ORDER BY frequency DESC`,
      [userId]
    );
    res.json({ bugs, total: bugs.length });
  } catch (e) { dbError(res, e); }
});

router.get('/dashboard/manifesto/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }
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
  } catch (e) { dbError(res, e); }
});

router.get('/dashboard/stats/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }
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
  } catch (e) { dbError(res, e); }
});


// ─── Real-time SSE endpoint ───────────────────────────────────────────────────
router.get('/events/:userId', requireAuth, requireUserId(), (req: Request, res: Response) => {
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

router.post('/nexus/ingest', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const content = requiredString(body?.content, 50_000);
    const sourceModule = requiredString(body?.sourceModule, 160);
    const tags = Array.isArray(body?.tags) ? body.tags : [];
    const metadata = bodyObject(body?.metadata) || {};
    if (!userId || !content || !sourceModule) {
      res.status(400).json({ error: 'content and sourceModule required' });
      return;
    }

    const signal = {
      userId,
      projectId,
      content,
      tags,
      metadata,
    };

    const nodeId = await nexusForge.episodicIndexer(signal, sourceModule);
    if (nodeId) {
      await nexusForge.evolutionOracle(signal, { projectId });
      res.json({ success: true, nodeId });
    } else {
      res.json({ success: false, message: 'NexusForge disabled or error' });
    }
  } catch (err: any) {
    console.error('[nexus/ingest] Error:', err);
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/nexus/query', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const q = requiredString(body?.query, 10_000);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    if (!q) {
      res.status(400).json({ error: 'query required' });
      return;
    }

    const result = await nexusForge.retrievalWeaver(
      q,
      userId,
      { projectId }
    );

    res.json(result);
  } catch (err: any) {
    console.error('[nexus/query] Error:', err);
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/nexus/stats/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/nexus/graph/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = positiveInt(req.params.userId);
    const limit = boundedPositiveInt(req.query.limit, 1, 200) || 30;
    if (!userId) {
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
    res.status(500).json({ error: errMsg(err) });
  }
});


// ─── ChronosVeil API Routes ───────────────────────────────────────────────

router.post('/chronos/ingest', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const content = requiredString(body?.content, 50_000);
    const tags = Array.isArray(body?.tags) ? body.tags : [];
    const entity = optionalString(body?.entity, 160);
    const metadata = bodyObject(body?.metadata) || {};
    const sourceModule = requiredString(body?.sourceModule, 160);
    if (!userId || !content || !sourceModule) {
      res.status(400).json({ error: 'content and sourceModule required' });
      return;
    }

    const signal: ChronosSignal = {
      userId,
      projectId,
      content,
      tags,
      entity,
      metadata,
    };

    const result = await chronosVeil.ingestEvent(signal, sourceModule);

    eventBus.emit({
      type: 'chronos_event',
      userId,
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
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/chronos/query', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const q = requiredString(body?.query, 10_000);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const limit = boundedPositiveInt(body?.limit, 1, 100) || 8;
    if (!q) {
      res.status(400).json({ error: 'query required' });
      return;
    }

    const resolved = await chronosVeil.queryWithVeil(
      q,
      userId,
      projectId,
      limit
    );

    res.json(resolved);
  } catch (err: any) {
    console.error('[chronos/query] Error:', err);
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/chronos/context/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/chronos/stats/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/chronos/edges/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(err) });
  }
});


// ─── SynapseMetabolon API Routes ─────────────────────────────────────────────

router.post('/synapse/ingest', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const content = requiredString(body?.content, 50_000);
    const tags = Array.isArray(body?.tags) ? body.tags : [];
    const entity = optionalString(body?.entity, 160);
    const metadata = bodyObject(body?.metadata) || {};
    const sourceModule = requiredString(body?.sourceModule, 160);
    const confidence = typeof body?.confidence === 'number' ? body.confidence : undefined;
    const outcomeScore = typeof body?.outcomeScore === 'number' ? body.outcomeScore : undefined;
    if (!userId || !content || !sourceModule) {
      res.status(400).json({ error: 'content and sourceModule required' });
      return;
    }

    const signal: MetabolicSignal = {
      userId,
      projectId,
      content,
      tags,
      entity,
      confidence,
      outcomeScore,
      metadata,
    };

    const result = await synapseMetabolon.injectEvent(signal, sourceModule);

    eventBus.emit({
      type: 'synapse_event',
      userId,
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
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/synapse/query', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const q = requiredString(body?.query, 10_000);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const limit = boundedPositiveInt(body?.limit, 1, 100) || 10;
    if (!q) {
      res.status(400).json({ error: 'query required' });
      return;
    }

    const result = await synapseMetabolon.queryWithSpread(
      q,
      userId,
      projectId,
      limit
    );

    res.json(result);
  } catch (err: any) {
    console.error('[synapse/query] Error:', err);
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/synapse/context/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/synapse/stats/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
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
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/synapse/graph/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = positiveInt(req.params.userId);
    const limit = boundedPositiveInt(req.query.limit, 1, 200) || 30;

    if (!userId) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const graph = await synapseMetabolon.getGraph(userId, limit);
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/synapse/consolidate/:userId', requireAuth, requireUserId(), async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = positiveInt(req.params.userId);
    const body = bodyObject(req.body);
    const projectId = optionalString(body?.projectId, 160) || 'default';

    if (!userId) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }

    const result = await synapseMetabolon.runConsolidationCycle(userId, projectId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: errMsg(err) });
  }
});


// ── ChronosForge Routes ────────────────────────────────────────────────────

router.post('/chrono/query', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const atTime = Number(body?.atTime);
    const domain = optionalString(body?.domain, 160) as import('../memory/chronosForge.js').SignalDomain | undefined;
    const limit = boundedPositiveInt(body?.limit, 1, 100) || 10;
    if (!userId || !Number.isFinite(atTime)) {
      res.status(400).json({ error: 'atTime is required' });
      return;
    }
    const result = await chronosForge.queryAt(
      userId,
      projectId,
      atTime,
      { domain, limit: limit ?? 10 }
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/chrono/foresight', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const domain = requiredString(body?.domain, 160) as import('../memory/chronosForge.js').SignalDomain;
    const lookbackDays = boundedPositiveInt(body?.lookbackDays, 1, 3650);
    const steps = boundedPositiveInt(body?.steps, 1, 365);
    if (!userId || !domain) {
      res.status(400).json({ error: 'domain is required' });
      return;
    }
    const result = await chronosForge.simulateForesight(
      userId,
      projectId,
      domain,
      { lookbackDays: lookbackDays ?? undefined, steps: steps ?? undefined }
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/chrono/consolidate', requireAuth, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const body = bodyObject(req.body);
    const userId = (req as any).authenticatedUserId as number;
    const projectId = optionalString(body?.projectId, 160) || 'default';
    const importanceThreshold = typeof body?.importanceThreshold === 'number' ? body.importanceThreshold : undefined;
    if (!userId) {
      res.status(400).json({ error: 'Authentication required' });
      return;
    }
    const result = await chronosForge.consolidate(
      userId,
      projectId,
      importanceThreshold ?? 0.05
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: errMsg(err) });
  }
});


export default router;
