import { Plugin } from './types';

export interface PluginDebugInfo {
  id: string;
  name: string;
  version: string;
  status: 'loaded' | 'enabled' | 'disabled' | 'error';
  loadTime?: number;
  error?: string;
  memory?: number;
}

export interface PluginLogEntry {
  timestamp: number;
  pluginId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

export class PluginDevtools {
  private logs: PluginLogEntry[] = [];
  private maxLogs = 1000;
  private debugInfo: Map<string, PluginDebugInfo> = new Map();
  private breakpoints: Map<string, Set<string>> = new Map();

  log(pluginId: string, level: PluginLogEntry['level'], message: string, data?: unknown): void {
    const entry: PluginLogEntry = {
      timestamp: Date.now(),
      pluginId,
      level,
      message,
      data,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.breakpoints.has(pluginId) || level === 'error') {
      this.pauseAtBreakpoint(pluginId, entry);
    }
  }

  debug(pluginId: string, message: string, data?: unknown): void {
    this.log(pluginId, 'debug', message, data);
  }

  info(pluginId: string, message: string, data?: unknown): void {
    this.log(pluginId, 'info', message, data);
  }

  warn(pluginId: string, message: string, data?: unknown): void {
    this.log(pluginId, 'warn', message, data);
  }

  error(pluginId: string, message: string, data?: unknown): void {
    this.log(pluginId, 'error', message, data);
  }

  getLogs(pluginId?: string, level?: PluginLogEntry['level']): PluginLogEntry[] {
    let logs = this.logs;

    if (pluginId) {
      logs = logs.filter(l => l.pluginId === pluginId);
    }

    if (level) {
      logs = logs.filter(l => l.level === level);
    }

    return logs;
  }

  clearLogs(pluginId?: string): void {
    if (pluginId) {
      this.logs = this.logs.filter(l => l.pluginId !== pluginId);
    } else {
      this.logs = [];
    }
  }

  setDebugInfo(pluginId: string, info: Partial<PluginDebugInfo>): void {
    const existing = this.debugInfo.get(pluginId) || { id: pluginId, name: pluginId, version: '1.0.0', status: 'loaded' };
    this.debugInfo.set(pluginId, { ...existing, ...info } as PluginDebugInfo);
  }

  getDebugInfo(pluginId: string): PluginDebugInfo | undefined {
    return this.debugInfo.get(pluginId);
  }

  getAllDebugInfo(): PluginDebugInfo[] {
    return Array.from(this.debugInfo.values());
  }

  setBreakpoint(pluginId: string, event: string): void {
    if (!this.breakpoints.has(pluginId)) {
      this.breakpoints.set(pluginId, new Set());
    }
    this.breakpoints.get(pluginId)!.add(event);
  }

  removeBreakpoint(pluginId: string, event?: string): void {
    if (event) {
      this.breakpoints.get(pluginId)?.delete(event);
    } else {
      this.breakpoints.delete(pluginId);
    }
  }

  getBreakpoints(pluginId: string): string[] {
    return Array.from(this.breakpoints.get(pluginId) || []);
  }

  private pauseAtBreakpoint(pluginId: string, entry: PluginLogEntry): void {
    console.log(`[Plugin Debug] Breakpoint hit: ${pluginId}`, entry);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  importLogs(json: string): void {
    try {
      this.logs = JSON.parse(json);
    } catch (error) {
      console.error('Failed to import logs:', error);
    }
  }
}

export interface PluginProfiler {
  pluginId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  marks: Array<{ name: string; time: number }>;
}

export class PluginProfiler {
  private profiles: Map<string, PluginProfiler> = new Map();

  startProfiling(pluginId: string): void {
    this.profiles.set(pluginId, {
      pluginId,
      startTime: performance.now(),
      marks: [],
    });
  }

  mark(pluginId: string, name: string): void {
    const profile = this.profiles.get(pluginId);
    if (profile) {
      profile.marks.push({
        name,
        time: performance.now() - profile.startTime,
      });
    }
  }

  stopProfiling(pluginId: string): PluginProfiler | undefined {
    const profile = this.profiles.get(pluginId);
    if (profile) {
      profile.endTime = performance.now();
      profile.duration = profile.endTime - profile.startTime;
      this.profiles.delete(pluginId);
    }
    return profile;
  }

  getProfile(pluginId: string): PluginProfiler | undefined {
    return this.profiles.get(pluginId);
  }

  getAllProfiles(): PluginProfiler[] {
    return Array.from(this.profiles.values());
  }

  clearProfiles(): void {
    this.profiles.clear();
  }
}

export const pluginDevtools = new PluginDevtools();
export const pluginProfiler = new PluginProfiler();

export default { pluginDevtools, pluginProfiler };