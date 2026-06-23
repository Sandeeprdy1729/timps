import * as http from 'node:http';
import express from 'express';
import cors from 'cors';
import type { Express } from 'express';
import { MemoryEngine } from '../MemoryEngine';
import type { MemoryEngineOptions } from '../MemoryEngine';
import { createAuthMiddleware } from './auth';
import type { AuthConfig } from './auth';
import { createMemoryRoutes } from './routes';
import { MemoryWsServer } from './websocket';
import type { WsEvent } from './websocket';

export interface MemoryServerOptions {
  /** HTTP port to listen on (default: 4100) */
  port?: number;
  /** Project path for MemoryEngine */
  projectPath: string;
  /** MemoryEngine options (scope, backend, dir, etc.) */
  engineOptions?: MemoryEngineOptions;
  /** Auth configuration. If not provided, auth is disabled (all requests allowed). */
  auth?: AuthConfig;
  /** CORS origins (default: allow all) */
  corsOrigins?: string | string[];
  /** Enable request logging (default: true) */
  logging?: boolean;
  /** WebSocket path (default: /ws) */
  wsPath?: string;
  /** Rate limit: max requests per window (default: 200) */
  rateLimitMax?: number;
  /** Rate limit window in ms (default: 60000) */
  rateLimitWindowMs?: number;
}

export class MemoryServer {
  readonly engine: MemoryEngine;
  readonly app: Express;
  readonly httpServer: http.Server;
  readonly wsServer: MemoryWsServer;
  private options: MemoryServerOptions;

  constructor(options: MemoryServerOptions) {
    this.options = {
      ...options,
      port: options.port ?? 4100,
      corsOrigins: options.corsOrigins ?? '*',
      logging: options.logging ?? true,
      wsPath: options.wsPath ?? '/ws',
      rateLimitMax: options.rateLimitMax ?? 200,
      rateLimitWindowMs: options.rateLimitWindowMs ?? 60000,
    };

    // 1. Create the canonical MemoryEngine
    this.engine = new MemoryEngine(this.options.projectPath, this.options.engineOptions);

    // 2. Create Express app
    this.app = express();
    this.configureApp();

    // 3. Create HTTP server
    this.httpServer = http.createServer(this.app);

    // 4. Create WebSocket server (shares HTTP server)
    this.wsServer = new MemoryWsServer(this.httpServer, this.engine, this.options.wsPath);

    // 5. Mount routes with optional auth
    this.mountRoutes();

    // 6. Error handler (must be last)
    this.app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[MemoryServer] Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private configureApp(): void {
    // CORS
    this.app.use(cors({
      origin: this.options.corsOrigins === '*'
        ? '*'
        : (typeof this.options.corsOrigins === 'string'
          ? this.options.corsOrigins.split(',')
          : this.options.corsOrigins),
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json({ limit: '5mb' }));

    // Request logging
    if (this.options.logging) {
      this.app.use((req, _res, next) => {
        console.log(`[MemoryServer] ${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
      });
    }
  }

  private mountRoutes(): void {
    let memoryRoutes: express.Router;

    if (this.options.auth) {
      // Auth-protected routes
      const auth = createAuthMiddleware(this.options.auth);
      this.app.post('/auth/token', (req, res) => {
        const { userId, secret } = req.body;
        if (!userId || secret !== this.options.auth!.secret) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = auth.sign({ userId });
        res.json({ token, userId });
      });
      memoryRoutes = createMemoryRoutes(this.engine, this.wsServer);
      this.app.use('/memory', auth.middleware, memoryRoutes);
    } else {
      // No auth — open access
      memoryRoutes = createMemoryRoutes(this.engine, this.wsServer);
      this.app.use('/memory', memoryRoutes);
    }

    // Health check (always open)
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });
  }

  /** Start listening */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.options.port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     TIMPS MemoryServer                                    ║
║     Centralized memory — one canonical engine             ║
║                                                           ║
║     HTTP:  http://localhost:${String(this.options.port).padEnd(36)}║
║     WS:    ws://localhost:${String(this.options.port)}${(this.options.wsPath ?? '/ws').padEnd(29)}║
║     Auth:  ${(this.options.auth ? 'JWT enabled' : 'DISABLED').padEnd(41)}║
║     Path:  ${this.options.projectPath.padEnd(50)}║
║                                                           ║
║     Endpoints:                                            ║
║     - POST /memory/store          Store memory            ║
║     - POST /memory/recall         Recall memories         ║
║     - GET  /memory/stats          Memory statistics       ║
║     - GET  /memory/working        Working memory state    ║
║     - POST /memory/consolidate    Deduplicate             ║
║     - GET  /memory/export         Export all memory       ║
║     - POST /memory/import         Import memory pack      ║
║     - GET  /health                Health check            ║
║     - WS   ${(this.options.wsPath ?? '/ws').padEnd(49)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
        resolve();
      });
    });
  }

  /** Graceful shutdown */
  async stop(): Promise<void> {
    this.wsServer.close();
    return new Promise((resolve) => {
      this.httpServer.close(() => resolve());
    });
  }

  /** Broadcast an event to all connected WebSocket clients */
  broadcast(event: WsEvent): void {
    this.wsServer.broadcast(event);
  }

  /** Send an event to a specific user */
  sendToUser(userId: string, event: WsEvent): void {
    this.wsServer.sendToUser(userId, event);
  }

  /** Get auth token (when auth is configured) */
  generateToken(payload: { userId: string; scope?: Record<string, unknown> }): string {
    const authCfg = this.options.auth;
    if (!authCfg) {
      throw new Error('Auth is not configured on this MemoryServer');
    }
    const auth = createAuthMiddleware(authCfg);
    return auth.sign(payload);
  }
}
