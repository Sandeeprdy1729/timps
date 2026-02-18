"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBlame = handleBlame;
exports.handleForget = handleForget;
exports.handleAudit = handleAudit;
const postgres_1 = require("../db/postgres");
const vector_1 = require("../db/vector");
const models_1 = require("../models");
const env_1 = require("../config/env");
/**
 * Handle !blame command: search for memories by keyword
 */
async function handleBlame(userId, projectId, keyword) {
    try {
        const embeddingModel = (0, models_1.createEmbeddingModel)('ollama');
        // SQL keyword search
        const sqlResults = await (0, postgres_1.query)(`SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2 
       AND content ILIKE $3
       ORDER BY created_at DESC`, [userId, projectId, `%${keyword}%`]);
        // Vector search
        let vectorResults = [];
        if (env_1.config.qdrant.url) {
            try {
                const embedding = await embeddingModel.getEmbedding(keyword);
                const searchResults = await (0, vector_1.searchVectors)(embedding.embedding, 10, {
                    must: [
                        { key: 'user_id', match: { value: userId } },
                        { key: 'project_id', match: { value: projectId } },
                    ],
                });
                if (searchResults.length > 0) {
                    const memoryIds = searchResults.map(r => r.payload.memory_id);
                    vectorResults = await (0, postgres_1.query)(`SELECT * FROM memories WHERE id = ANY($1)`, [memoryIds]);
                }
            }
            catch (error) {
                // Vector search failed, continue with SQL only
            }
        }
        // Merge and deduplicate
        const mergedMap = new Map();
        for (const mem of sqlResults) {
            if (mem.id)
                mergedMap.set(mem.id, mem);
        }
        for (const mem of vectorResults) {
            if (mem.id)
                mergedMap.set(mem.id, mem);
        }
        const results = Array.from(mergedMap.values())
            .sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
        // Increment retrieval count
        for (const mem of results) {
            if (mem.id) {
                await (0, postgres_1.execute)('UPDATE memories SET retrieval_count = retrieval_count + 1, last_retrieved_at = CURRENT_TIMESTAMP WHERE id = $1', [mem.id]);
            }
        }
        return results;
    }
    catch (error) {
        throw error;
    }
}
/**
 * Handle !forget command: delete memories matching keyword
 */
async function handleForget(userId, projectId, keyword) {
    try {
        const embeddingModel = (0, models_1.createEmbeddingModel)('ollama');
        // Find matching memories (same as blame)
        const sqlResults = await (0, postgres_1.query)(`SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2 
       AND content ILIKE $3
       ORDER BY created_at DESC`, [userId, projectId, `%${keyword}%`]);
        let vectorResults = [];
        if (env_1.config.qdrant.url) {
            try {
                const embedding = await embeddingModel.getEmbedding(keyword);
                const searchResults = await (0, vector_1.searchVectors)(embedding.embedding, 10, {
                    must: [
                        { key: 'user_id', match: { value: userId } },
                        { key: 'project_id', match: { value: projectId } },
                    ],
                });
                if (searchResults.length > 0) {
                    const memoryIds = searchResults.map(r => r.payload.memory_id);
                    vectorResults = await (0, postgres_1.query)(`SELECT * FROM memories WHERE id = ANY($1)`, [memoryIds]);
                }
            }
            catch (error) {
                // Continue with SQL only
            }
        }
        // Merge
        const mergedMap = new Map();
        for (const mem of sqlResults) {
            if (mem.id)
                mergedMap.set(mem.id, mem);
        }
        for (const mem of vectorResults) {
            if (mem.id)
                mergedMap.set(mem.id, mem);
        }
        const results = Array.from(mergedMap.values());
        const deletedIds = [];
        // Delete each memory
        for (const mem of results) {
            if (mem.id) {
                try {
                    await (0, postgres_1.execute)('DELETE FROM memories WHERE id = $1', [mem.id]);
                    deletedIds.push(mem.id);
                }
                catch (error) {
                    // Continue on error
                }
            }
        }
        return deletedIds;
    }
    catch (error) {
        throw error;
    }
}
/**
 * Handle !audit command: show recent memories
 */
async function handleAudit(userId, projectId) {
    try {
        const memories = await (0, postgres_1.query)(`SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2
       ORDER BY created_at DESC 
       LIMIT 10`, [userId, projectId]);
        return memories;
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=tuiHandlers.js.map