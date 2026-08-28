// ── TIMPS Affective Memory ──
// 3D affect model: arousal, valence, cognitive load

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import type { AffectiveState, AffectiveSample } from './types.js';

export class AffectiveMemory {
  private dir: string;
  private stateFile: string;
  private state: AffectiveState;

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.stateFile = path.join(this.dir, 'affective-state.json');
    this.state = this.load();
  }

  private load(): AffectiveState {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { arousal: 0.5, valence: 0.5, cognitiveLoad: 0.5, sessionStart: Date.now(), samples: [] };
  }

  private save(): void {
    if (this.state.samples.length > 500) this.state.samples = this.state.samples.slice(-500);
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  // ── State Tracking ────────────────────────────────────────

  sample(arousal?: number, valence?: number, cognitiveLoad?: number, task?: string, toolsUsed?: string[]): void {
    if (arousal !== undefined) this.state.arousal = arousal;
    if (valence !== undefined) this.state.valence = valence;
    if (cognitiveLoad !== undefined) this.state.cognitiveLoad = cognitiveLoad;

    this.state.samples.push({
      timestamp: Date.now(),
      arousal: this.state.arousal,
      valence: this.state.valence,
      cognitiveLoad: this.state.cognitiveLoad,
      task,
      toolsUsed,
    });

    this.save();
  }

  // ── Heuristic Updates ────────────────────────────────────

  updateFromToolSequence(tools: string[]): void {
    const hasComplex = tools.some(t => ['bash', 'multi_edit', 'search_code'].includes(t));
    const hasSimple = tools.every(t => ['read_file', 'think'].includes(t));

    if (hasComplex && this.state.cognitiveLoad < 0.8) {
      this.state.cognitiveLoad = Math.min(1, this.state.cognitiveLoad + 0.1);
    }
    if (hasSimple && this.state.cognitiveLoad > 0.2) {
      this.state.cognitiveLoad = Math.max(0.1, this.state.cognitiveLoad - 0.05);
    }

    this.sample();
  }

  updateFromError(errorCount: number): void {
    this.state.valence = Math.max(0.1, this.state.valence - errorCount * 0.1);
    this.state.arousal = Math.min(1, this.state.arousal + errorCount * 0.15);
    this.sample();
  }

  updateFromSuccess(): void {
    this.state.valence = Math.min(1, this.state.valence + 0.1);
    this.state.arousal = Math.max(0.3, this.state.arousal - 0.05);
    this.sample();
  }

  // ── Pattern Detection ──────────────────────────────────────

  detectPatterns(): { timePatterns: string[]; taskPatterns: string[]; toolPatterns: string[] } {
    const samples = this.state.samples.slice(-50);
    const timePatterns: string[] = [];
    const taskPatterns: string[] = [];
    const toolPatterns: string[] = [];

    const hourMap = new Map<number, { valence: number; cognitiveLoad: number }>();
    for (const s of samples) {
      const hour = new Date(s.timestamp).getHours();
      if (!hourMap.has(hour)) hourMap.set(hour, { valence: 0, count: 0, cognitiveLoad: 0 } as any);
      const entry = hourMap.get(hour)!;
      (entry as any).valence += s.valence;
      (entry as any).count += 1;
      (entry as any).cognitiveLoad += s.cognitiveLoad;
    }

    for (const [hour, data] of hourMap) {
      const avgValence = (data as any).valence / (data as any).count;
      const avgLoad = (data as any).cognitiveLoad / (data as any).count;
      if (avgValence < 0.4) timePatterns.push(`Struggle period: ${hour}:00 (valence ${avgValence.toFixed(2)}, load ${avgLoad.toFixed(2)})`);
      if (avgLoad > 0.7) timePatterns.push(`High cognitive load: ${hour}:00`);
    }

    const taskMap = new Map<string, { valence: number; arousal: number; count: number }>();
    for (const s of samples) {
      if (s.task) {
        if (!taskMap.has(s.task)) taskMap.set(s.task, { valence: 0, arousal: 0, count: 0 });
        const t = taskMap.get(s.task)!;
        t.valence += s.valence;
        t.arousal += s.arousal;
        t.count += 1;
      }
    }

    for (const [task, data] of taskMap) {
      const avgValence = data.valence / data.count;
      if (avgValence < 0.4 && data.count >= 3) {
        taskPatterns.push(`Difficult task type: "${task}" (valence ${avgValence.toFixed(2)})`);
      }
    }

    const toolMap = new Map<string, { cognitiveLoad: number; count: number }>();
    for (const s of samples) {
      for (const tool of s.toolsUsed || []) {
        if (!toolMap.has(tool)) toolMap.set(tool, { cognitiveLoad: 0, count: 0 });
        const t = toolMap.get(tool)!;
        t.cognitiveLoad += s.cognitiveLoad;
        t.count += 1;
      }
    }

    for (const [tool, data] of toolMap) {
      if (data.count >= 5) {
        const avgLoad = data.cognitiveLoad / data.count;
        if (avgLoad > 0.7) toolPatterns.push(`High-effort tool: ${tool} (load ${avgLoad.toFixed(2)})`);
      }
    }

    return { timePatterns, taskPatterns, toolPatterns };
  }

  // ── Predictions ────────────────────────────────────────────

  predict(taskType: string): { suggestion: string; confidence: number } {
    const patterns = this.detectPatterns();
    const matching = patterns.taskPatterns.find(p => p.toLowerCase().includes(taskType.toLowerCase()));

    if (matching) {
      const hour = new Date().getHours();
      const lowValenceTime = patterns.timePatterns.find(p => p.includes(`Struggle period: ${hour}:`));
      if (lowValenceTime) {
        return { suggestion: `Consider deferring ${taskType} — detected as difficult at this time.`, confidence: 0.7 };
      }
      return { suggestion: `Consider a different approach for ${taskType} — historically challenging.`, confidence: 0.6 };
    }

    return { suggestion: '', confidence: 0 };
  }

  // ── State Access ───────────────────────────────────────────

  getState(): { arousal: number; valence: number; cognitiveLoad: number } {
    return { arousal: this.state.arousal, valence: this.state.valence, cognitiveLoad: this.state.cognitiveLoad };
  }

  reset(): void {
    this.state = { arousal: 0.5, valence: 0.5, cognitiveLoad: 0.5, sessionStart: Date.now(), samples: [] };
    this.save();
  }

  getStats(): { sessionDuration: number; avgArousal: number; avgValence: number; avgCognitiveLoad: number; sampleCount: number } {
    const recent = this.state.samples.slice(-20);
    return {
      sessionDuration: Date.now() - this.state.sessionStart,
      avgArousal: recent.length > 0 ? recent.reduce((s, x) => s + x.arousal, 0) / recent.length : 0.5,
      avgValence: recent.length > 0 ? recent.reduce((s, x) => s + x.valence, 0) / recent.length : 0.5,
      avgCognitiveLoad: recent.length > 0 ? recent.reduce((s, x) => s + x.cognitiveLoad, 0) / recent.length : 0.5,
      sampleCount: this.state.samples.length,
    };
  }
}