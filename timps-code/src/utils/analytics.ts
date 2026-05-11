// ── TIMPS Code — Analytics & Telemetry
// Session analytics, usage tracking, and performance metrics

import { getFeatureFlags } from './featureFlags.js';
import { loadConfig } from '../config/config.js';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  filesModified: number;
  commandsExecuted: number;
  errors: number;
  cost?: number;
  model: string;
  provider: string;
}

export interface ToolMetric {
  toolName: string;
  callCount: number;
  totalDurationMs: number;
  successCount: number;
  errorCount: number;
}

export interface TelemetryEvent {
  type: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

class Analytics {
  private metrics: SessionMetrics | null = null;
  private toolMetrics = new Map<string, ToolMetric>();
  private events: TelemetryEvent[] = [];
  private enabled: boolean = true;

  constructor() {
    const cfg = loadConfig();
    this.enabled = !cfg.disableAnalytics;
  }

  startSession(sessionId: string, model: string, provider: string): void {
    this.metrics = {
      sessionId,
      startTime: Date.now(),
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
      filesModified: 0,
      commandsExecuted: 0,
      errors: 0,
      model,
      provider,
    };
  }

  endSession(): SessionMetrics | null {
    if (!this.metrics) return null;
    this.metrics.endTime = Date.now();
    this.persistMetrics();
    return this.metrics;
  }

  trackTokens(input: number, output: number): void {
    if (!this.metrics) return;
    this.metrics.inputTokens += input;
    this.metrics.outputTokens += output;
  }

  trackToolCall(toolName: string, durationMs: number, success: boolean): void {
    if (!this.metrics) return;
    this.metrics.toolCalls++;

    const existing = this.toolMetrics.get(toolName) || {
      toolName,
      callCount: 0,
      totalDurationMs: 0,
      successCount: 0,
      errorCount: 0,
    };

    existing.callCount++;
    existing.totalDurationMs += durationMs;
    if (success) existing.successCount++;
    else existing.errorCount++;

    this.toolMetrics.set(toolName, existing);
  }

  trackFileModified(): void {
    if (!this.metrics) return;
    this.metrics.filesModified++;
  }

  trackCommand(): void {
    if (!this.metrics) return;
    this.metrics.commandsExecuted++;
  }

  trackError(): void {
    if (!this.metrics) return;
    this.metrics.errors++;
  }

  trackCost(cost: number): void {
    if (!this.metrics) return;
    this.metrics.cost = (this.metrics.cost || 0) + cost;
  }

  trackEvent(type: string, properties: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    this.events.push({ type, properties, timestamp: Date.now() });
  }

  getMetrics(): SessionMetrics | null {
    return this.metrics;
  }

  getToolMetrics(): ToolMetric[] {
    return Array.from(this.toolMetrics.values());
  }

  private persistMetrics(): void {
    if (!this.metrics) return;
    try {
      const statsDir = path.join(os.homedir(), '.timps', 'stats');
      fs.mkdirSync(statsDir, { recursive: true });
      const filePath = path.join(statsDir, `${this.metrics.sessionId}.json`);
      fs.writeFileSync(filePath, JSON.stringify({
        ...this.metrics,
        toolMetrics: this.getToolMetrics(),
      }, null, 2));
    } catch { /* ignore */ }
  }
}

let analytics: Analytics | null = null;

export function getAnalytics(): Analytics {
  if (!analytics) {
    analytics = new Analytics();
  }
  return analytics;
}

// ── Startup Telemetry ─────────────────────────────────────────────────────────

export interface StartupTelemetry {
  timestamp: number;
  gitStatus: 'clean' | 'dirty' | 'not-repo';
  worktreeCount: number;
  isGitHubAuthenticated: boolean;
  sandboxEnabled: boolean;
  autoUpdaterEnabled: boolean;
  reduceMotion: boolean;
  startupDurationMs: number;
  version: string;
}

export function logStartupTelemetry(): StartupTelemetry {
  const telemetry: StartupTelemetry = {
    timestamp: Date.now(),
    gitStatus: 'not-repo',
    worktreeCount: 0,
    isGitHubAuthenticated: false,
    sandboxEnabled: false,
    autoUpdaterEnabled: false,
    reduceMotion: false,
    startupDurationMs: 0,
    version: '2.0.0',
  };

  // Git status
  try {
    const gitStatus = childProcess.execSync('git status --short', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    telemetry.gitStatus = gitStatus.trim() ? 'dirty' : 'clean';
  } catch { /* not a repo */ }

  // Worktree count
  try {
    const worktrees = childProcess.execSync('git worktree list --porcelain', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    telemetry.worktreeCount = (worktrees.match(/^worktree /gm) || []).length;
  } catch { /* ignore */ }

  // GitHub auth
  telemetry.isGitHubAuthenticated = !!(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);

  // Sandbox
  telemetry.sandboxEnabled = process.env.TIMPS_SANDBOX === 'true';

  const analyticsInstance = getAnalytics();
  analyticsInstance.trackEvent('startup', telemetry as unknown as Record<string, unknown>);

  return telemetry;
}
