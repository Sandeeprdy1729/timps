// ── TIMPS Predictive Pre-fetching ──
// Silent context pre-loading based on task similarity

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import type { EpisodicMemory, PredictionCandidate } from './types.js';

export class PredictivePrefetcher {
  private dir: string;
  private episodicFile: string;
  private sessionProfilesFile: string;

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.episodicFile = path.join(this.dir, 'episodes.jsonl');
    this.sessionProfilesFile = path.join(this.dir, 'session-profiles.json');
  }

  private loadEpisodes(): EpisodicMemory[] {
    try {
      if (!fs.existsSync(this.episodicFile)) return [];
      return fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n')
        .filter(l => l.trim())
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean) as EpisodicMemory[];
    } catch { return []; }
  }

  private loadProfiles(): { summary: string; taskType: string; files: string[]; timestamp: number }[] {
    try {
      if (!fs.existsSync(this.sessionProfilesFile)) return [];
      return JSON.parse(fs.readFileSync(this.sessionProfilesFile, 'utf-8'));
    } catch { return []; }
  }

  private saveProfiles(profiles: { summary: string; taskType: string; files: string[]; timestamp: number }[]): void {
    if (profiles.length > 100) profiles = profiles.slice(-100);
    fs.writeFileSync(this.sessionProfilesFile, JSON.stringify(profiles, null, 2), 'utf-8');
  }

  // ── Session Profile Generation ─────────────────────────────

  createProfile(summary: string, files: string[], taskType = 'general'): void {
    const profiles = this.loadProfiles();
    profiles.push({ summary, taskType, files, timestamp: Date.now() });
    this.saveProfiles(profiles);
  }

  // ── Similarity Computation ──────────────────────────────────

  private computeSimilarity(a: EpisodicMemory | { summary: string; files: string[]; taskType?: string }, b: { summary: string; files: string[] }): number {
    const aSummary = 'summary' in a ? a.summary : '';
    const aFiles = 'files' in a ? a.files : [];

    const summaryTokens = aSummary.toLowerCase().split(/\s+/);
    const queryTokens = b.summary.toLowerCase().split(/\s+/);
    const summaryMatch = queryTokens.filter(qt => summaryTokens.some(st => st.includes(qt) || qt.includes(st))).length / Math.max(queryTokens.length, 1);

    const aFileSet = new Set(aFiles.map(f => path.basename(f)));
    const bFileSet = new Set(b.files.map(f => path.basename(f)));
    const fileMatch = [...bFileSet].filter(f => aFileSet.has(f)).length / Math.max(bFileSet.size, 1);

    return summaryMatch * 0.6 + fileMatch * 0.4;
  }

  // ── Prediction ─────────────────────────────────────────────

  predict(goal: string, activeFiles: string[]): PredictionCandidate[] {
    const episodes = this.loadEpisodes();
    const profiles = this.loadProfiles();

    const candidates: PredictionCandidate[] = [];
    const query = { summary: goal, files: activeFiles };

    for (const ep of episodes) {
      const sim = this.computeSimilarity(ep, query);
      if (sim > 0.3) candidates.push({ episode: ep, similarity: sim });
    }

    for (const profile of profiles) {
      const sim = this.computeSimilarity(profile as { summary: string; files: string[]; taskType?: string }, query);
      if (sim > 0.3) {
        candidates.push({
          episode: { timestamp: profile.timestamp, summary: profile.summary, filesChanged: profile.files, toolsUsed: [], outcome: 'success', taskType: profile.taskType },
          similarity: sim * 0.9,
        });
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  // ── Pre-fetch ──────────────────────────────────────────────

  prefetch(goal: string, activeFiles: string[]): { episodicSummaries: string[]; semanticFacts: string[]; confidence: number } {
    const candidates = this.predict(goal, activeFiles);
    const top3 = candidates.slice(0, 3);

    if (top3.length === 0) return { episodicSummaries: [], semanticFacts: [], confidence: 0 };

    const episodicSummaries = top3.map(c => c.episode.summary);
    const avgSim = top3.reduce((s, c) => s + c.similarity, 0) / top3.length;

    const semanticFile = path.join(this.dir, 'semantic.json');
    let semanticFacts: string[] = [];
    try {
      const entries = JSON.parse(fs.readFileSync(semanticFile, 'utf-8'));
      const relevant = entries.filter((e: any) => {
        const goalTokens = goal.toLowerCase().split(/\s+/);
        return goalTokens.some((gt: string) => e.content.toLowerCase().includes(gt));
      }).slice(0, 5);
      semanticFacts = relevant.map((e: any) => e.content);
    } catch { /* ignore */ }

    return { episodicSummaries, semanticFacts, confidence: avgSim };
  }

  // ── Active File Monitoring ────────────────────────────────

  updateActiveFiles(files: string[]): void {
    const profiles = this.loadProfiles();
    if (profiles.length > 0) {
      const last = profiles[profiles.length - 1];
      if (files.length !== last.files.length || !files.every((f, i) => f === last.files[i])) {
        this.createProfile(last.summary || 'context update', files, last.taskType || 'general');
      }
    }
  }

  // ── Utility ────────────────────────────────────────────────

  getStats(): { episodeCount: number; profileCount: number; topSimilarities: number[] } {
    const episodes = this.loadEpisodes();
    const profiles = this.loadProfiles();
    return {
      episodeCount: episodes.length,
      profileCount: profiles.length,
      topSimilarities: [],
    };
  }
}