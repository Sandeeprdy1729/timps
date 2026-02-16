"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LongTermMemoryStore = void 0;
const postgres_1 = require("../db/postgres");
const vector_1 = require("../db/vector");
const models_1 = require("../models");
const env_1 = require("../config/env");
class LongTermMemoryStore {
    embeddingModel = (0, models_1.createEmbeddingModel)('ollama');
    async storeMemory(memory) {
        const result = await (0, postgres_1.query)(`INSERT INTO memories (user_id, content, embedding_id, memory_type, importance, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [
            memory.user_id,
            memory.content,
            memory.embedding_id,
            memory.memory_type,
            memory.importance,
            memory.tags,
        ]);
        const storedMemory = result[0];
        if (storedMemory && env_1.config.qdrant.url) {
            try {
                const embedding = await this.embeddingModel.getEmbedding(memory.content);
                const vectorId = `mem_${storedMemory.id}`;
                await (0, vector_1.upsertVectors)([{
                        id: vectorId,
                        vector: embedding.embedding,
                        payload: {
                            user_id: memory.user_id,
                            memory_id: storedMemory.id,
                            content: memory.content,
                            memory_type: memory.memory_type,
                            tags: memory.tags,
                        },
                    }]);
                await (0, postgres_1.execute)('UPDATE memories SET embedding_id = $1 WHERE id = $2', [vectorId, storedMemory.id]);
            }
            catch (error) {
                console.error('Failed to store vector embedding:', error);
            }
        }
        return storedMemory;
    }
    async retrieveMemories(userId, queryText, limit = env_1.config.memory.longTermTopResults) {
        if (!env_1.config.qdrant.url) {
            return this.getMemoriesFromDB(userId, limit);
        }
        try {
            const embedding = await this.embeddingModel.getEmbedding(queryText);
            const searchResults = await (0, vector_1.searchVectors)(embedding.embedding, limit, {
                must: [{ key: 'user_id', match: { value: userId } }],
            });
            if (searchResults.length === 0) {
                return this.getMemoriesFromDB(userId, limit);
            }
            const memoryIds = searchResults.map(r => r.payload.memory_id);
            return (0, postgres_1.query)(`SELECT * FROM memories WHERE id = ANY($1) ORDER BY created_at DESC`, [memoryIds]);
        }
        catch (error) {
            console.error('Vector search failed, falling back to DB:', error);
            return this.getMemoriesFromDB(userId, limit);
        }
    }
    async getMemoriesFromDB(userId, limit) {
        return (0, postgres_1.query)(`SELECT * FROM memories WHERE user_id = $1 ORDER BY importance DESC, created_at DESC LIMIT $2`, [userId, limit]);
    }
    async getUserMemories(userId) {
        return (0, postgres_1.query)(`SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    }
    async updateMemory(id, updates) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updates.content !== undefined) {
            fields.push(`content = $${paramIndex++}`);
            values.push(updates.content);
        }
        if (updates.memory_type !== undefined) {
            fields.push(`memory_type = $${paramIndex++}`);
            values.push(updates.memory_type);
        }
        if (updates.importance !== undefined) {
            fields.push(`importance = $${paramIndex++}`);
            values.push(updates.importance);
        }
        if (updates.tags !== undefined) {
            fields.push(`tags = $${paramIndex++}`);
            values.push(updates.tags);
        }
        if (fields.length > 0) {
            fields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id);
            await (0, postgres_1.execute)(`UPDATE memories SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        }
    }
    async deleteMemory(id) {
        await (0, postgres_1.execute)('DELETE FROM memories WHERE id = $1', [id]);
    }
    async storeGoal(goal) {
        const result = await (0, postgres_1.query)(`INSERT INTO goals (user_id, title, description, status, priority, target_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [
            goal.user_id,
            goal.title,
            goal.description,
            goal.status,
            goal.priority,
            goal.target_date,
        ]);
        return result[0];
    }
    async getGoals(userId) {
        return (0, postgres_1.query)(`SELECT * FROM goals WHERE user_id = $1 ORDER BY priority DESC, created_at DESC`, [userId]);
    }
    async updateGoal(id, updates) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updates.title !== undefined) {
            fields.push(`title = $${paramIndex++}`);
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }
        if (updates.status !== undefined) {
            fields.push(`status = $${paramIndex++}`);
            values.push(updates.status);
        }
        if (updates.priority !== undefined) {
            fields.push(`priority = $${paramIndex++}`);
            values.push(updates.priority);
        }
        if (updates.target_date !== undefined) {
            fields.push(`target_date = $${paramIndex++}`);
            values.push(updates.target_date);
        }
        if (fields.length > 0) {
            fields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id);
            await (0, postgres_1.execute)(`UPDATE goals SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        }
    }
    async storePreference(pref) {
        const result = await (0, postgres_1.query)(`INSERT INTO preferences (user_id, preference_key, preference_value, category)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, preference_key)
       DO UPDATE SET preference_value = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`, [pref.user_id, pref.preference_key, pref.preference_value, pref.category]);
        return result[0];
    }
    async getPreferences(userId) {
        return (0, postgres_1.query)(`SELECT * FROM preferences WHERE user_id = $1 ORDER BY category, preference_key`, [userId]);
    }
    async getPreference(userId, key) {
        const result = await (0, postgres_1.query)(`SELECT * FROM preferences WHERE user_id = $1 AND preference_key = $2`, [userId, key]);
        return result[0] || null;
    }
    async storeProject(project) {
        const result = await (0, postgres_1.query)(`INSERT INTO projects (user_id, name, description, status, tech_stack, repository_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [
            project.user_id,
            project.name,
            project.description,
            project.status,
            project.tech_stack,
            project.repository_url,
        ]);
        return result[0];
    }
    async getProjects(userId) {
        return (0, postgres_1.query)(`SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    }
    async updateProject(id, updates) {
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updates.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            values.push(updates.name);
        }
        if (updates.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }
        if (updates.status !== undefined) {
            fields.push(`status = $${paramIndex++}`);
            values.push(updates.status);
        }
        if (updates.tech_stack !== undefined) {
            fields.push(`tech_stack = $${paramIndex++}`);
            values.push(updates.tech_stack);
        }
        if (updates.repository_url !== undefined) {
            fields.push(`repository_url = $${paramIndex++}`);
            values.push(updates.repository_url);
        }
        if (fields.length > 0) {
            fields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id);
            await (0, postgres_1.execute)(`UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        }
    }
}
exports.LongTermMemoryStore = LongTermMemoryStore;
//# sourceMappingURL=longTerm.js.map