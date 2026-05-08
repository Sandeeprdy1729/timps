/**
 * TIMPS Desktop - Memory service
 * Service for managing TIMPS memory operations.
 */

import { api } from '../api';
import type { SemanticEntry, EpisodicEntry, MemoryStats } from '../api';

export interface MemoryFilter {
  types?: string[];
  tags?: string[];
  search?: string;
}

export class MemoryService {
  async getSemantic(projectPath: string): Promise<SemanticEntry[]> {
    return api.loadSemantic(projectPath);
  }

  async getEpisodes(projectPath: string, count = 50): Promise<EpisodicEntry[]> {
    return api.loadEpisodes(projectPath, count);
  }

  async getStats(projectPath: string): Promise<MemoryStats> {
    return api.getMemoryStats(projectPath);
  }

  async addMemory(
    projectPath: string,
    key: string,
    value: string,
    options: {
      type?: string;
      tags?: string[];
      importance?: number;
    } = {}
  ): Promise<void> {
    const { type = 'fact', tags = [], importance = 0.5 } = options;
    await api.storeMemory(projectPath, key, value, importance, tags);
  }

  async deleteMemory(projectPath: string, key: string): Promise<number> {
    return api.deleteMemory(projectPath, key);
  }

  async filter(
    projectPath: string,
    filter: MemoryFilter
  ): Promise<SemanticEntry[]> {
    let entries = await api.loadSemantic(projectPath);

    if (filter.types?.length) {
      entries = entries.filter(e => filter.types!.includes(e.type));
    }

    if (filter.tags?.length) {
      entries = entries.filter(e =>
        filter.tags!.some(t => e.tags.includes(t))
      );
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      entries = entries.filter(e =>
        e.content.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return entries;
  }

  async getTags(projectPath: string): Promise<string[]> {
    const entries = await api.loadSemantic(projectPath);
    const tags = new Set<string>();
    
    for (const entry of entries) {
      entry.tags.forEach(t => tags.add(t));
    }
    
    return Array.from(tags).sort();
  }

  async getTypes(projectPath: string): Promise<string[]> {
    const entries = await api.loadSemantic(projectPath);
    return [...new Set(entries.map(e => e.type))].sort();
  }

  async getRecentEntries(
    projectPath: string,
    count = 10
  ): Promise<SemanticEntry[]> {
    const entries = await api.loadSemantic(projectPath);
    return entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  async getEntriesByType(
    projectPath: string,
    type: string
  ): Promise<SemanticEntry[]> {
    const entries = await api.loadSemantic(projectPath);
    return entries.filter(e => e.type === type);
  }

  async getEntriesByTag(
    projectPath: string,
    tag: string
  ): Promise<SemanticEntry[]> {
    const entries = await api.loadSemantic(projectPath);
    return entries.filter(e => e.tags.includes(tag));
  }
}

export const memoryService = new MemoryService();