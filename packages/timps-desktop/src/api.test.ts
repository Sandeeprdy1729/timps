import { describe, it, expect } from 'vitest';
import { api } from '../src/api';

describe('TIMPS Desktop API', () => {
  it('should export correct types', () => {
    expect(typeof api.projectHash).toBe('function');
    expect(typeof api.loadSemantic).toBe('function');
    expect(typeof api.loadEpisodes).toBe('function');
    expect(typeof api.chat).toBe('function');
  });

  it('should have all required methods', () => {
    const requiredMethods = [
      'projectHash',
      'loadSemantic',
      'loadEpisodes',
      'loadWorking',
      'getMemoryStats',
      'listProjects',
      'searchMemory',
      'chat',
      'storeMemory',
      'deleteMemory',
    ];
    
    requiredMethods.forEach(method => {
      expect(api).toHaveProperty(method);
    });
  });
});

describe('Memory Stats', () => {
  it('should handle empty project stats', async () => {
    const stats = await api.getMemoryStats('/nonexistent/project');
    expect(stats).toHaveProperty('project_hash');
    expect(stats).toHaveProperty('semantic_count');
    expect(stats).toHaveProperty('episode_count');
    expect(stats).toHaveProperty('working_goals');
  });
});

describe('Memory Operations', () => {
  it('should load semantic from empty project', async () => {
    const entries = await api.loadSemantic('/nonexistent/project');
    expect(Array.isArray(entries)).toBe(true);
  });

  it('should load episodes from empty project', async () => {
    const entries = await api.loadEpisodes('/nonexistent/project', 10);
    expect(Array.isArray(entries)).toBe(true);
  });

  it('should search memory with empty query', async () => {
    const results = await api.searchMemory('/nonexistent/project', '', 5);
    expect(Array.isArray(results)).toBe(true);
  });
});