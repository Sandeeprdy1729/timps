import { query, execute } from '../db/postgres';
import { searchVectors } from '../db/vector';
import { createEmbeddingModel } from '../models';
import { Memory } from '../memory/longTerm';
import { config } from '../config/env';

/**
 * Handle !blame command: search for memories by keyword
 */
export async function handleBlame(
  userId: number,
  projectId: string,
  keyword: string
): Promise<Memory[]> {
  try {
    const embeddingModel = createEmbeddingModel('ollama');
    
    // SQL keyword search
    const sqlResults = await query<Memory>(
      `SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2 
       AND content ILIKE $3
       ORDER BY created_at DESC`,
      [userId, projectId, `%${keyword}%`]
    );
    
    // Vector search
    let vectorResults: Memory[] = [];
    if (config.qdrant.url) {
      try {
        const embedding = await embeddingModel.getEmbedding(keyword);
        const searchResults = await searchVectors(embedding.embedding, 10, {
          must: [
            { key: 'user_id', match: { value: userId } },
            { key: 'project_id', match: { value: projectId } },
          ],
        });
        
        if (searchResults.length > 0) {
          const memoryIds = searchResults.map(r => r.payload.memory_id);
          vectorResults = await query<Memory>(
            `SELECT * FROM memories WHERE id = ANY($1)`,
            [memoryIds]
          );
        }
      } catch (error) {
        // Vector search failed, continue with SQL only
      }
    }
    
    // Merge and deduplicate
    const mergedMap = new Map<number, Memory>();
    for (const mem of sqlResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
    }
    for (const mem of vectorResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
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
        await execute(
          'UPDATE memories SET retrieval_count = retrieval_count + 1, last_retrieved_at = CURRENT_TIMESTAMP WHERE id = $1',
          [mem.id]
        );
      }
    }
    
    return results;
  } catch (error) {
    throw error;
  }
}

/**
 * Handle !forget command: delete memories matching keyword
 */
export async function handleForget(
  userId: number,
  projectId: string,
  keyword: string
): Promise<number[]> {
  try {
    const embeddingModel = createEmbeddingModel('ollama');
    
    // Find matching memories (same as blame)
    const sqlResults = await query<Memory>(
      `SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2 
       AND content ILIKE $3
       ORDER BY created_at DESC`,
      [userId, projectId, `%${keyword}%`]
    );
    
    let vectorResults: Memory[] = [];
    if (config.qdrant.url) {
      try {
        const embedding = await embeddingModel.getEmbedding(keyword);
        const searchResults = await searchVectors(embedding.embedding, 10, {
          must: [
            { key: 'user_id', match: { value: userId } },
            { key: 'project_id', match: { value: projectId } },
          ],
        });
        
        if (searchResults.length > 0) {
          const memoryIds = searchResults.map(r => r.payload.memory_id);
          vectorResults = await query<Memory>(
            `SELECT * FROM memories WHERE id = ANY($1)`,
            [memoryIds]
          );
        }
      } catch (error) {
        // Continue with SQL only
      }
    }
    
    // Merge
    const mergedMap = new Map<number, Memory>();
    for (const mem of sqlResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
    }
    for (const mem of vectorResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
    }
    
    const results = Array.from(mergedMap.values());
    const deletedIds: number[] = [];
    
    // Delete each memory
    for (const mem of results) {
      if (mem.id) {
        try {
          await execute(
            'DELETE FROM memories WHERE id = $1',
            [mem.id]
          );
          deletedIds.push(mem.id);
        } catch (error) {
          // Continue on error
        }
      }
    }
    
    return deletedIds;
  } catch (error) {
    throw error;
  }
}

/**
 * Handle !audit command: show recent memories
 */
export async function handleAudit(
  userId: number,
  projectId: string
): Promise<Memory[]> {
  try {
    const memories = await query<Memory>(
      `SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2
       ORDER BY created_at DESC 
       LIMIT 10`,
      [userId, projectId]
    );
    
    return memories;
  } catch (error) {
    throw error;
  }
}
