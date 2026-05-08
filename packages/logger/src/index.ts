import { createLogger, format, transports } from 'winston';
import { c } from 'picocolors';

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly';

interface LogContext {
  sessionId?: string;
  tool?: string;
  duration?: number;
  [key: string]: unknown;
}

const colorScheme = {
  error: c.red,
  warn: c.yellow,
  info: c.blue,
  debug: c.cyan,
  verbose: c.gray,
  silly: c.white,
};

const createTimpsLogger = (options?: {
  level?: LogLevel;
  sessionId?: string;
  pretty?: boolean;
  json?: boolean;
}) => {
  const { level = 'info', sessionId, pretty = true, json = false } = options || {};

  const logFormat = format.combine(
    format.timestamp({ format: 'ISO' }),
    format.errors({ stack: true }),
    format((info) => {
      info.level = info.level.toLowerCase();
      return info;
    })(),
    json ? format.json() : format.printf(({ timestamp, level, message, sessionId, tool, duration, stack, ...meta }) => {
      const color = colorScheme[level as LogLevel] || c.white;
      const timestampStr = c.dim(timestamp as string);
      const levelStr = color(level.toUpperCase().padEnd(7));
      const sessionStr = sessionId ? c.dim(`[${sessionId.slice(0, 8)}]`) : '';
      const toolStr = tool ? c.green(`[${tool}]`) : '';
      const durationStr = duration !== undefined ? c.yellow(`+${duration}ms`) : '';

      let log = `${timestampStr} ${levelStr} ${sessionStr}${toolStr} ${color(message as string)}${durationStr ? ` ${durationStr}` : ''}`;

      const metaKeys = Object.keys(meta).filter((k) => meta[k] !== undefined);
      if (metaKeys.length > 0) {
        const metaStr = c.dim(JSON.stringify(meta, null, 0));
        log += ` ${metaStr}`;
      }

      if (stack) {
        log += c.red(`\n${stack}`);
      }

      return log;
    })
  );

  const logger = createLogger({
    level,
    format: logFormat,
    transports: [
      new transports.Console(),
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
      new transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
      }),
    ],
    });

  return {
    error: (message: string, meta?: LogContext) => logger.error(message, meta),
    warn: (message: string, meta?: LogContext) => logger.warn(message, meta),
    info: (message: string, meta?: LogContext) => logger.info(message, meta),
    debug: (message: string, meta?: LogContext) => logger.debug(message, meta),
    verbose: (message: string, meta?: LogContext) => logger.verbose(message, meta),
    silly: (message: string, meta?: LogContext) => logger.silly(message, meta),
    child: (options: { sessionId: string }) => {
      return createTimpsLogger({ sessionId: options.sessionId });
    },
    setLevel: (newLevel: LogLevel) => logger.level = newLevel,
  };
};

const loggerMiddleware = (logger: ReturnType<typeof createTimpsLogger>) => {
  return (req: { method: string; url: string; path: string }, res: unknown, next: () => void) => {
    const start = Date.now();

    res === res; // mark res as used

    res = { ...res } as unknown as { on?: (event: string, fn: () => void) => void };

    if (res && typeof res === 'object' && 'on' in res) {
      res.on?.('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path || req.url}`, {
          duration,
          statusCode: (res as { statusCode?: number }).statusCode,
        });
      });
    } else {
      setTimeout(() => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path || req.url}`, { duration });
      }, 0);
    }

    next();
  };
};

const createActivityLogger = (options?: { sessionId?: string }) => {
  return (activity: string, data?: Record<string, unknown>) => {
    return createTimpsLogger().info(activity, { sessionId: options?.sessionId, ...data });
  };
};

const createToolLogger = (options: { toolName: string; sessionId?: string }) => {
  return {
    start: (args: Record<string, unknown>) => {
      createTimpsLogger().debug(`[${options.toolName}] Executing`, { args, sessionId: options.sessionId });
      return Date.now();
    },
    end: (startTime: number, result?: unknown, error?: Error) => {
      const duration = Date.now() - startTime;
      if (error) {
        createTimpsLogger().error(`[${options.toolName}] Failed`, { duration, error: error.message, sessionId: options.sessionId });
      } else {
        createTimpsLogger().debug(`[${options.toolName}] Complete`, { duration, result, sessionId: options.sessionId });
      }
    },
  };
};

export { createTimpsLogger, loggerMiddleware, createActivityLogger, createToolLogger };
export type { LogLevel, LogContext };