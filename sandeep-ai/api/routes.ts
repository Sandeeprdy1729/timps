import { Router, Request, Response } from 'express';
import { Agent } from '../core/agent';
import { memoryIndex } from '../memory/memoryIndex';
import { query } from '../db/postgres';

const router = Router();

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
    
    const agent = new Agent({
      userId,
      username,
      systemPrompt,
    });
    
    if (clearConversation) {
      agent.clearConversation();
    }
    
    const response = await agent.run(message);
    
    res.json({
      response: response.content,
      toolResults: response.toolResults,
      iterations: response.iterations,
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
    
    const context = await memoryIndex.retrieveContext(userId, '');
    
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
    
    const goal = await memoryIndex.storeGoal(
      userId,
      title,
      description,
      priority || 1,
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
    const { status, title, description, priority } = req.body;
    
    if (isNaN(goalId)) {
      res.status(400).json({ error: 'Invalid goalId' });
      return;
    }
    
    const updates: any = {};
    if (status) updates.status = status;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority) updates.priority = priority;
    
    await query(
      'UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [updates.status, goalId]
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

export default router;
