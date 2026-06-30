import * as http from 'node:http';
import * as grpc from '@grpc/grpc-js';
import express from 'express';
import cors from 'cors';
import type { Express } from 'express';
import { MemoryEngine } from '../MemoryEngine';
import type { MemoryEngineOptions } from '../MemoryEngine';
import { EventBus } from '../events/EventBus';
import type { EventBusChannel } from '../events/EventBus';
import { createAuthMiddleware } from './auth';
import type { AuthConfig } from './auth';
import { createMemoryRoutes } from './routes';
import { MemoryWsServer } from './websocket';
import type { WsEvent } from './websocket';
import { startGrpcServer, createGrpcServer } from './grpc';
import type { GrpcServerOptions } from './grpc';
import { PostgresBackend } from '../backends/PostgresBackend';
import { RedisBackend } from '../backends/RedisBackend';
import { ProjectRoom } from './ProjectRoom';
import type { ProjectRoomEvent } from './ProjectRoom';
import { RateLimiter } from '../rateLimiter';
import type { RateLimiterConfig } from '../rateLimiter';
import { createMarketplaceRoutes } from './marketplaceRoutes';
import { TelemetryManager } from '../telemetry/TelemetryManager';
import type { TelemetryConfig } from '../telemetry/types';
import { createTelemetryRoutes } from './telemetryRoutes';
import { createEvalRoutes } from './evalRoutes';

export interface MemoryServerOptions {
  /** HTTP port to listen on (default: 4100) */
  port?: number;
  /** Project path for MemoryEngine */
  projectPath: string;
  /** MemoryEngine options (scope, backend, dir, cacheManager, eventBus, etc.) */
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
  /** gRPC server configuration. Set to false to disable gRPC (default: enabled on port 4101) */
  grpc?: GrpcServerOptions | false;
  /** Event bus configuration. Set to false to disable cross-server events (default: disabled). */
  eventBus?: { url?: string } | false;
  /** Server ID for event bus identification (default: auto-generated). */
  serverId?: string;
  /** Org-scoped rate limit config. When set, per-org rate limits are enforced. */
  rateLimiterConfig?: RateLimiterConfig;
  /**
   * Telemetry configuration for metrics, traces, and anonymous export.
   * Default: off (no telemetry collected).
   */
  telemetry?: TelemetryConfig;
  /** Directory for eval baselines. Default: <projectPath>/eval-baselines */
  evalBaselineDir?: string;
}

export class MemoryServer {
  readonly engine: MemoryEngine;
  readonly app: Express;
  readonly httpServer: http.Server;
  readonly wsServer: MemoryWsServer;
  private options: MemoryServerOptions;
  private grpcServer: grpc.Server | null = null;
  private grpcPort: number | null = null;
  private _eventBus: EventBus | null = null;
  private rateLimiter: RateLimiter;
  private projectRooms = new Map<string, ProjectRoom>();
  private _telemetryManager: TelemetryManager | null = null;

  get rateLimiterInstance(): RateLimiter {
    return this.rateLimiter;
  }

  /** The telemetry manager, if configured. */
  get telemetryManager(): TelemetryManager | null {
    return this._telemetryManager;
  }

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

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(options.rateLimiterConfig);

    // 1. Create event bus (before engine, so engine can use it)
    if (options.eventBus !== false) {
      this._eventBus = new EventBus({
        url: typeof options.eventBus === 'object' ? options.eventBus.url : undefined,
        serverId: options.serverId,
      });
      // Inject event bus into engine options
      this.options.engineOptions = {
        ...this.options.engineOptions,
        eventBus: this._eventBus,
      };
    }

    // 2. Create the canonical MemoryEngine
    // Inject telemetry config into engine options
    if (options.telemetry) {
      this._telemetryManager = new TelemetryManager(options.telemetry);
      this.options.engineOptions = {
        ...this.options.engineOptions,
        telemetry: options.telemetry,
      };
    }
    this.engine = new MemoryEngine(this.options.projectPath, this.options.engineOptions);

    // 3. Create Express app
    this.app = express();
    this.configureApp();

    // 4. Create HTTP server
    this.httpServer = http.createServer(this.app);

    // 5. Create WebSocket server (shares HTTP server)
    this.wsServer = new MemoryWsServer(this.httpServer, this.engine, this.options.wsPath);

    // 6. Mount routes with optional auth
    this.mountRoutes();

    // 7. Subscribe to event bus for cross-server event forwarding
    if (this._eventBus) {
      this._subscribeToEventBus();
    }

    // 8. Error handler (must be last)
    this.app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[MemoryServer] Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /** Subscribe to event bus channels and forward to WebSocket clients. */
  private _subscribeToEventBus(): void {
    if (!this._eventBus) return;

    const forwardEvent = (channel: string) => {
      this._eventBus!.subscribe(channel as EventBusChannel, (msg) => {
        this.wsServer.broadcast({
          type: 'insight',
          channel: msg.channel,
          payload: msg.payload,
          timestamp: msg.timestamp,
        } as any);
      });
    };

    forwardEvent('memory:stored');
    forwardEvent('memory:recalled');
    forwardEvent('insight');
    forwardEvent('contradiction');
    forwardEvent('forge:decay');
    forwardEvent('forge:echo:prediction');
    forwardEvent('forge:chronos:weave');
    forwardEvent('forge:aether:insight');
    forwardEvent('memory:consolidated');
    forwardEvent('server:heartbeat');
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

    // Per-org rate limiting middleware
    const rateLimitMiddleware = async (req: any, res: any, next: any) => {
      const orgId = req.auth?.orgId ?? req.headers['x-org-id'] as string;
      if (orgId) {
        const result = await this.rateLimiter.checkMemoryOp(orgId);
        if (!result.allowed) {
          res.set('Retry-After', String(Math.ceil((result.retryAfterMs ?? 60000) / 1000)));
          return res.status(429).json({
            error: 'Rate limit exceeded. Try again later.',
            retryAfterMs: result.retryAfterMs,
            orgId,
          });
        }
      }
      next();
    };

    let authMiddleware: ReturnType<typeof createAuthMiddleware> | undefined;

    if (this.options.auth) {
      const auth = createAuthMiddleware(this.options.auth);
      authMiddleware = auth;
      this.app.post('/auth/token', (req, res) => {
        const { userId, orgId, teamId, projectId, secret } = req.body;
        if (!userId || secret !== this.options.auth!.secret) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Include org-scope claims when generating token
        const token = auth.sign({ userId, orgId, teamId, projectId });
        res.json({ token, userId, orgId, teamId, projectId });
      });
      memoryRoutes = createMemoryRoutes(this.engine, this.wsServer);
      this.app.use('/memory', auth.middleware, rateLimitMiddleware, memoryRoutes);
    } else {
      memoryRoutes = createMemoryRoutes(this.engine, this.wsServer);
      this.app.use('/memory', rateLimitMiddleware, memoryRoutes);
    }

    // ── Project Room endpoints ──
    this.app.post('/room/join', (req, res) => {
      const { projectId, agentId } = req.body;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      const room = this.getOrCreateRoom(projectId);
      // For REST, we just acknowledge the join — the real bidirectional stream handles push
      res.json({ status: 'ok', projectId, agentCount: room.agentCount });
    });

    this.app.post('/room/leave', (req, res) => {
      const { projectId, agentId } = req.body;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      const room = this.projectRooms.get(projectId);
      if (room) {
        room.leave(agentId ?? 'anonymous');
        if (room.agentCount === 0) {
          room.destroy();
          this.projectRooms.delete(projectId);
        }
      }
      res.json({ status: 'ok' });
    });

    this.app.get('/room/:projectId/agents', (req, res) => {
      const room = this.projectRooms.get(String(req.params.projectId));
      if (!room) return res.json({ agents: [], count: 0 });
      res.json({ agents: room.connectedAgentIds, count: room.agentCount });
    });

    // ── Marketplace API routes (always open for browsing, auth for submit) ──
    const marketplaceRoutes = createMarketplaceRoutes(this.engine.backend);
    if (this.options.auth && authMiddleware) {
      this.app.use('/marketplace', authMiddleware.middleware, marketplaceRoutes);
    } else {
      this.app.use('/marketplace', marketplaceRoutes);
    }

    // ── Telemetry & Metrics ──
    if (this._telemetryManager) {
      const telemetryRoutes = createTelemetryRoutes(this._telemetryManager);
      this.app.use('/metrics', telemetryRoutes);
    }

    // ── Eval Framework — Quality Measurement & Regression Detection ──
    const baselineDir = this.options.evalBaselineDir || `${this.options.projectPath}/eval-baselines`;
    const evalRoutes = createEvalRoutes(this.engine, this.engine.backend, baselineDir);
    this.app.use('/eval', evalRoutes);

    // Health check (always open)
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Readiness probe — checks backend dependencies are healthy
    this.app.get('/health/readiness', async (_req, res) => {
      const checks: Record<string, boolean | string | number> = {
        engine: true,
        timestamp: Date.now(),
      };

      // Check Postgres health
      const pgBackend = this.engine.backend;
      if (pgBackend instanceof PostgresBackend) {
        try {
          const pgHealth = await pgBackend.health();
          checks.postgres_primary = pgHealth.primary;
          checks.postgres_replicas = pgHealth.replicas;
        } catch {
          checks.postgres_primary = false;
        }
      }

      // Check Redis health
      if (pgBackend instanceof RedisBackend) {
        try {
          await (pgBackend as any).exists('_health_check');
          checks.redis = true;
        } catch {
          checks.redis = false;
        }
      }

      // Check EventBus
      if (this._eventBus) {
        try {
          await this._eventBus.publish('server:heartbeat', { serverId: this.options.serverId });
          checks.eventBus = true;
        } catch {
          checks.eventBus = false;
        }
      }

      // Check cache manager if present
      if (this.engine.cacheManager) {
        try {
          await this.engine.cacheManager.exists('_health_check');
          checks.cache = true;
        } catch {
          checks.cache = false;
        }
      }

      // Check telemetry if configured
      if (this._telemetryManager) {
        checks.telemetry = this._telemetryManager.level;
      }

      // Determine overall health
      const unhealthy = Object.entries(checks).filter(
        ([k, v]) => k !== 'timestamp' && v === false
      );
      if (unhealthy.length > 0) {
        res.status(503).json({ status: 'unhealthy', checks, unhealthy: unhealthy.map(([k]) => k) });
      } else {
        res.json({ status: 'ok', checks });
      }
    });
  }

  /** Start listening */
  async start(): Promise<void> {
    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer.listen(this.options.port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     TIMPS MemoryServer (horizontal scale)                 ║
║     Stateless — all state externalized                    ║
║                                                           ║
║     HTTP:  http://localhost:${String(this.options.port).padEnd(36)}║
║     WS:    ws://localhost:${String(this.options.port)}${(this.options.wsPath ?? '/ws').padEnd(29)}║
║     Auth:  ${(this.options.auth ? 'JWT enabled' : 'DISABLED').padEnd(41)}║
║     EventBus: ${(this._eventBus ? 'enabled' : 'disabled').padEnd(41)}║
║     ServerID: ${(this.options.serverId ?? `auto_${process.pid}`).padEnd(41)}║
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
║     - GET  /health/readiness      Readiness probe         ║
║     - WS   ${(this.options.wsPath ?? '/ws').padEnd(49)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
        resolve();
      });
    });

    // Start gRPC server (if enabled)
    if (this.options.grpc !== false) {
      const grpcOpts: GrpcServerOptions = {
        port: 4101,
        host: '0.0.0.0',
        ...(typeof this.options.grpc === 'object' ? this.options.grpc : {}),
      };
      const result = await startGrpcServer(this.engine, grpcOpts, this._eventBus);
      this.grpcServer = result.server;
      this.grpcPort = result.port;
    }
  }

  /** Graceful shutdown */
  async stop(): Promise<void> {
    this.wsServer.close();

    // Close event bus
    if (this._eventBus) {
      await this._eventBus.close();
      this._eventBus = null;
    }

    // Shutdown gRPC server if running
    if (this.grpcServer) {
      await new Promise<void>((resolve) => {
        this.grpcServer!.tryShutdown(() => resolve());
      });
      this.grpcServer = null;
    }

    return new Promise((resolve) => {
      this.httpServer.close(() => resolve());
    });
  }

  /** Broadcast an event to all connected WebSocket clients */
  broadcast(event: WsEvent & { channel?: string; payload?: Record<string, unknown> }): void {
    this.wsServer.broadcast(event);

    // Also publish to event bus for cross-server propagation
    if (this._eventBus && event.channel) {
      void this._eventBus.publish(event.channel as EventBusChannel, event.payload ?? {});
    }
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

  /** Get the gRPC port, or null if gRPC is not running */
  getGrpcPort(): number | null {
    return this.grpcPort;
  }

  /** Get the event bus instance */
  getEventBus(): EventBus | null {
    return this._eventBus;
  }

  /** Get or create a project room for collaborative agent memory */
  getOrCreateRoom(projectId: string): ProjectRoom {
    let room = this.projectRooms.get(projectId);
    if (!room) {
      room = new ProjectRoom({
        projectId,
        engine: this.engine,
        eventBus: this._eventBus,
      });
      this.projectRooms.set(projectId, room);
    }
    return room;
  }

  /** Get all active project rooms */
  getProjectRooms(): Map<string, ProjectRoom> {
    return this.projectRooms;
  }

  /** Join an agent to a project room (called from gRPC AgentStream/StreamContext) */
  joinProjectRoom(projectId: string, agentId: string, stream: { send: (msg: any) => boolean }): ProjectRoom {
    const room = this.getOrCreateRoom(projectId);
    room.join(agentId, stream);
    return room;
  }

  /** Leave a project room (called from gRPC stream disconnect) */
  leaveProjectRoom(projectId: string, agentId: string, stream?: { send: (msg: any) => boolean }): void {
    const room = this.projectRooms.get(projectId);
    if (room) {
      room.leave(agentId, stream);
      if (room.agentCount === 0) {
        room.destroy();
        this.projectRooms.delete(projectId);
      }
    }
  }
}
