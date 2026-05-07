import { describe, it, expect } from 'vitest';
// Import from the stub path so tests don't need a real Tauri runtime
import { api } from './api';

describe('api stubs (non-Tauri env)', () => {
  it('projectHash returns a string', async () => {
    const hash = await api.projectHash('/some/path');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('loadSemantic returns an array', async () => {
    const entries = await api.loadSemantic('/some/path');
    expect(Array.isArray(entries)).toBe(true);
  });

  it('loadEpisodes returns an array', async () => {
    const eps = await api.loadEpisodes('/some/path', 10);
    expect(Array.isArray(eps)).toBe(true);
  });

  it('loadWorking returns a WorkingState shape', async () => {
    const w = await api.loadWorking('/some/path');
    expect(Array.isArray(w.goals)).toBe(true);
    expect(Array.isArray(w.activeFiles)).toBe(true);
    expect(Array.isArray(w.recentErrors)).toBe(true);
  });

  it('getMemoryStats returns MemoryStats shape', async () => {
    const stats = await api.getMemoryStats('/some/path');
    expect(typeof stats.project_hash).toBe('string');
    expect(typeof stats.semantic_count).toBe('number');
    expect(typeof stats.episode_count).toBe('number');
    expect(typeof stats.working_goals).toBe('number');
  });

  it('listProjects returns an array', async () => {
    const projects = await api.listProjects();
    expect(Array.isArray(projects)).toBe(true);
  });

  it('searchMemory returns an array', async () => {
    const results = await api.searchMemory('/some/path', 'test query', 5);
    expect(Array.isArray(results)).toBe(true);
  });
});
