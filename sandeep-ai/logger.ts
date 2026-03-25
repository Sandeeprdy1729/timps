import { config } from './config/env';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

function shouldLog(level: Level): boolean {
  const configured = (config.logging?.level ?? 'info') as Level;
  return LEVELS[level] >= LEVELS[configured];
}

function format(level: Level, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const base = `${ts} [${level.toUpperCase()}] ${message}`;
  if (meta !== undefined) {
    const extra = meta instanceof Error
      ? meta.stack ?? meta.message
      : typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
    return `${base} ${extra}`;
  }
  return base;
}

export const logger = {
  debug(message: string, meta?: unknown): void {
    if (shouldLog('debug')) console.debug(format('debug', message, meta));
  },
  info(message: string, meta?: unknown): void {
    if (shouldLog('info')) console.info(format('info', message, meta));
  },
  warn(message: string, meta?: unknown): void {
    if (shouldLog('warn')) console.warn(format('warn', message, meta));
  },
  error(message: string, meta?: unknown): void {
    if (shouldLog('error')) console.error(format('error', message, meta));
  },
};
