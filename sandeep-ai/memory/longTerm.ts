import { query, execute } from '../db/postgres';
import { searchVectors, upsertVectors, VectorPoint } from '../db/vector';
import { createEmbeddingModel } from '../models';
import { config } from '../config/env';

export interface Memory {
  id?: number;
  user_id: number;
  content: string;
  embedding_id?: string;
  memory_type: string;
  importance: number;
  tags: string[];
  created_at?: Date;
  updated_at?: Date;
}

export interface Goal {
  id?: number;
  user_id: number;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'cancelled';
  priority: number;
  target_date?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface Preference {
  id?: number;
  user_id: number;
  preference_key: string;
  preference_value?: string;
  category?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Project {
  id?: number;
  user_id: number;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  tech_stack?: string[];
  repository_url?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class LongTermMemoryStore {
  private embeddingModel = createEmbeddingModel('ollama');
  
  async storeMemory(memory: Omit<Memory, 'id' | 'created_at' | 'updated_at'>): Promise<Memory> {
    const result = await query<Memory>(
      `INSERT INTO memories (user_id, content, embedding_id, memory_type, importance, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        memory.user_id,
        memory.content,
        memory.embedding_id,
        memory.memory_type,
        memory.importance,
        memory.tags,
      ]
    );
    
    const storedMemory = result[0];
    
    if (storedMemory && config.qdrant.url) {
      try {
        const embedding = await this.embeddingModel.getEmbedding(memory.content);
        const vectorId = `mem_${storedMemory.id}`;
        
        await upsertVectors([{
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
        
        await execute(
          'UPDATE memories SET embedding_id = $1 WHERE id = $2',
          [vectorId, storedMemory.id]
        );
      } catch (error) {
        console.error('Failed to store vector embedding:', error);
      }
    }
    
    return storedMemory;
  }
  
  async retrieveMemories(
    userId: number,
    queryText: string,
    limit: number = config.memory.longTermTopResults
  ): Promise<Memory[]> {
    if (!config.qdrant.url) {
      return this.getMemoriesFromDB(userId, limit);
    }
    
    try {
      const embedding = await this.embeddingModel.getEmbedding(queryText);
      const searchResults = await searchVectors(embedding.embedding, limit, {
        must: [{ key: 'user_id', match: { value: userId } }],
      });
      
      if (searchResults.length === 0) {
        return this.getMemoriesFromDB(userId, limit);
      }
      
      const memoryIds = searchResults.map(r => r.payload.memory_id);
      return query<Memory>(
        `SELECT * FROM memories WHERE id = ANY($1) ORDER BY created_at DESC`,
        [memoryIds]
      );
    } catch (error) {
      console.error('Vector search failed, falling back to DB:', error);
      return this.getMemoriesFromDB(userId, limit);
    }
  }
  
  private async getMemoriesFromDB(userId: number, limit: number): Promise<Memory[]> {
    return query<Memory>(
      `SELECT * FROM memories WHERE user_id = $1 ORDER BY importance DESC, created_at DESC LIMIT $2`,
      [userId, limit]
    );
  }
  
  async getUserMemories(userId: number): Promise<Memory[]> {
    return query<Memory>(
      `SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }
  
  async updateMemory(id: number, updates: Partial<Memory>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
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
      await execute(
        `UPDATE memories SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  }
  
  async deleteMemory(id: number): Promise<void> {
    await execute('DELETE FROM memories WHERE id = $1', [id]);
  }
  
  async storeGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at'>): Promise<Goal> {
    const result = await query<Goal>(
      `INSERT INTO goals (user_id, title, description, status, priority, target_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        goal.user_id,
        goal.title,
        goal.description,
        goal.status,
        goal.priority,
        goal.target_date,
      ]
    );
    return result[0];
  }
  
  async getGoals(userId: number): Promise<Goal[]> {
    return query<Goal>(
      `SELECT * FROM goals WHERE user_id = $1 ORDER BY priority DESC, created_at DESC`,
      [userId]
    );
  }
  
  async updateGoal(id: number, updates: Partial<Goal>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
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
      await execute(
        `UPDATE goals SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  }
  
  async storePreference(pref: Omit<Preference, 'id' | 'created_at' | 'updated_at'>): Promise<Preference> {
    const result = await query<Preference>(
      `INSERT INTO preferences (user_id, preference_key, preference_value, category)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, preference_key)
       DO UPDATE SET preference_value = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [pref.user_id, pref.preference_key, pref.preference_value, pref.category]
    );
    return result[0];
  }
  
  async getPreferences(userId: number): Promise<Preference[]> {
    return query<Preference>(
      `SELECT * FROM preferences WHERE user_id = $1 ORDER BY category, preference_key`,
      [userId]
    );
  }
  
  async getPreference(userId: number, key: string): Promise<Preference | null> {
    const result = await query<Preference>(
      `SELECT * FROM preferences WHERE user_id = $1 AND preference_key = $2`,
      [userId, key]
    );
    return result[0] || null;
  }
  
  async storeProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const result = await query<Project>(
      `INSERT INTO projects (user_id, name, description, status, tech_stack, repository_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        project.user_id,
        project.name,
        project.description,
        project.status,
        project.tech_stack,
        project.repository_url,
      ]
    );
    return result[0];
  }
  
  async getProjects(userId: number): Promise<Project[]> {
    return query<Project>(
      `SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    
  );
  }
  
  async updateProject(id: number, updates: Partial<Project>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
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
      await execute(
        `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  }
}
