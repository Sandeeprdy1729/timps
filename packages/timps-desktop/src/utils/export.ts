/**
 * TIMPS Desktop - Data export/import
 * Export and import memory data.
 */

import { api } from '../api';
import type { SemanticEntry, EpisodicEntry } from '../api';

export interface ExportData {
  version: string;
  exported: number;
  semantic: SemanticEntry[];
  episodes: EpisodicEntry[];
}

export async function exportProject(projectPath: string): Promise<string> {
  const [semantic, episodes] = await Promise.all([
    api.loadSemantic(projectPath),
    api.loadEpisodes(projectPath, 1000),
  ]);

  const data: ExportData = {
    version: '1.0',
    exported: Date.now(),
    semantic,
    episodes,
  };

  return JSON.stringify(data, null, 2);
}

export async function importProject(
  projectPath: string,
  jsonString: string
): Promise<{ imported: number }> {
  const data = JSON.parse(jsonString) as ExportData;
  let imported = 0;

  if (data.semantic) {
    for (const entry of data.semantic) {
      await api.storeMemory(
        projectPath,
        entry.id,
        entry.content,
        entry.score || 0.5,
        entry.tags
      );
      imported++;
    }
  }

  return { imported };
}

export async function exportCSV(projectPath: string): Promise<string> {
  const entries = await api.loadSemantic(projectPath);
  
  const headers = ['id', 'timestamp', 'type', 'content', 'tags', 'score'];
  const rows = entries.map(e => [
    e.id,
    String(e.timestamp),
    e.type,
    `"${e.content.replace(/"/g, '""')}"`,
    e.tags.join(';'),
    String(e.score || ''),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export async function clearProject(projectPath: string): Promise<void> {
  const entries = await api.loadSemantic(projectPath);
  
  for (const entry of entries) {
    await api.deleteMemory(projectPath, entry.id);
  }
}