/**
 * TIMPS Desktop - Logger utility
 * Provides structured logging with levels and transports.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private minLevel: LogLevel = 'debug';

  constructor() {
    if (import.meta.env.PROD) {
      this.minLevel = 'info';
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private format(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const context = entry.context 
      ? ` ${JSON.stringify(entry.context)}` 
      : '';
    return `[${time}] [${entry.level.toUpperCase()}] ${entry.message}${context}`;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    const entry: LogEntry = {
      level: 'debug',
      message,
      timestamp: Date.now(),
      context,
    };
    this.addLog(entry);
    console.debug(this.format(entry));
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: Date.now(),
      context,
    };
    this.addLog(entry);
    console.info(this.format(entry));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    const entry: LogEntry = {
      level: 'warn',
      message,
      timestamp: Date.now(),
      context,
    };
    this.addLog(entry);
    console.warn(this.format(entry));
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: Date.now(),
      context,
    };
    this.addLog(entry);
    console.error(this.format(entry));
  }

  getLogs(level?: LogLevel, limit = 100): LogEntry[] {
    let logs = this.logs;
    if (level) {
      logs = logs.filter(l => l.level === level);
    }
    return logs.slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  export(): string {
    return this.logs.map(l => this.format(l)).join('\n');
  }
}

export const logger = new Logger();

// Convenience logging functions
export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) => logger.debug(msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => logger.info(msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => logger.warn(msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => logger.error(msg, ctx),
};