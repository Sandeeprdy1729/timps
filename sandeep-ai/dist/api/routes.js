"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agent_1 = require("../core/agent");
const memoryIndex_1 = require("../memory/memoryIndex");
const postgres_1 = require("../db/postgres");
const router = (0, express_1.Router)();
router.post('/chat', async (req, res) => {
    try {
        const { userId, username, message, systemPrompt, clearConversation } = req.body;
        if (!userId || !message) {
            res.status(400).json({ error: 'userId and message are required' });
            return;
        }
        const agent = new agent_1.Agent({
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
    }
    catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/memory/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid userId' });
            return;
        }
        const context = await memoryIndex_1.memoryIndex.retrieveContext(userId, '');
        res.json({
            memories: context.memories,
            goals: context.goals,
            preferences: context.preferences,
            projects: context.projects,
        });
    }
    catch (error) {
        console.error('Memory retrieval error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/goals/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid userId' });
            return;
        }
        const goals = await (0, postgres_1.query)('SELECT * FROM goals WHERE user_id = $1 ORDER BY priority DESC, created_at DESC', [userId]);
        res.json({ goals });
    }
    catch (error) {
        console.error('Goals retrieval error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/goals/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const { title, description, priority, targetDate } = req.body;
        if (isNaN(userId) || !title) {
            res.status(400).json({ error: 'Invalid userId or missing title' });
            return;
        }
        const goal = await memoryIndex_1.memoryIndex.storeGoal(userId, title, description, priority || 1, targetDate ? new Date(targetDate) : undefined);
        res.json({ goal });
    }
    catch (error) {
        console.error('Goal creation error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/goals/:goalId', async (req, res) => {
    try {
        const goalId = parseInt(req.params.goalId, 10);
        const { status, title, description, priority } = req.body;
        if (isNaN(goalId)) {
            res.status(400).json({ error: 'Invalid goalId' });
            return;
        }
        const updates = {};
        if (status)
            updates.status = status;
        if (title)
            updates.title = title;
        if (description !== undefined)
            updates.description = description;
        if (priority)
            updates.priority = priority;
        await (0, postgres_1.query)('UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [updates.status, goalId]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Goal update error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/preferences/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid userId' });
            return;
        }
        const preferences = await (0, postgres_1.query)('SELECT * FROM preferences WHERE user_id = $1 ORDER BY category, preference_key', [userId]);
        res.json({ preferences });
    }
    catch (error) {
        console.error('Preferences retrieval error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/preferences/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const { key, value, category } = req.body;
        if (isNaN(userId) || !key || !value) {
            res.status(400).json({ error: 'Invalid userId, key, or value' });
            return;
        }
        const preference = await memoryIndex_1.memoryIndex.storePreference(userId, key, value, category);
        res.json({ preference });
    }
    catch (error) {
        console.error('Preference creation error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/projects/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid userId' });
            return;
        }
        const projects = await (0, postgres_1.query)('SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        res.json({ projects });
    }
    catch (error) {
        console.error('Projects retrieval error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/conversations/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const { title } = req.body;
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid userId' });
            return;
        }
        const conversation = await (0, postgres_1.query)('INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *', [userId, title || 'New Conversation']);
        res.json({ conversation: conversation[0] });
    }
    catch (error) {
        console.error('Conversation creation error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
exports.default = router;
//# sourceMappingURL=routes.js.map