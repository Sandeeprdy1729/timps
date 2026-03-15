import { Router, Request, Response } from 'express';
import { Agent } from '../core/agent';
import { memoryIndex } from '../memory/memoryIndex';
import { query, execute } from '../db/postgres';
import { ContradictionTool } from '../tools/contradictionTool';
import { positionStore } from '../tools/positionStore';

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
    
    res.json({
      response: response.content,
      toolResults: response.toolResults,
      iterations: response.iterations,
      toolsActivated: response.toolsActivated || [],
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
    res.json(JSON.parse(raw));
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

export default router;