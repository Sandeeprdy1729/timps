import * as http from 'node:http';
import * as grpc from '@grpc/grpc-js';
import express from 'express';
import cors from 'cors';
import type { Express } from 'express';
import { MemoryEngine } from '../MemoryEngine';
import type { MemoryEngineOptions } from '../MemoryEngine';
import { EventBus } from '../events/EventBus';
import type { EventBusChannel } from '../events/EventBus';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAuthMiddleware, createApiKeyMiddleware, generateApiKey, extractApiKey } from './auth';
import type { AuthConfig, ApiKeyRecord } from './auth';
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
  /**
   * Enable API key authentication.
   * - true: auto-generate a key on first start, store in .timps/api-keys.json
   * - string: use this as the master secret for key management (JWT /admin endpoints)
   * - false: no API key auth (default when auth is also not set)
   */
  apiKeyAuth?: boolean | string;
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
  private _apiKeys = new Map<string, ApiKeyRecord>();
  private _apiKeysPath: string;

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

    // Initialize API key storage path
    this._apiKeysPath = path.join(options.projectPath, '.timps', 'api-keys.json');

    // Load or generate API keys
    if (options.apiKeyAuth) {
      this._loadApiKeys(options.apiKeyAuth);
    }

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

    // 5. Create WebSocket server (shares HTTP server, passes API keys for WS auth)
    this.wsServer = new MemoryWsServer(this.httpServer, this.engine, this.options.wsPath, this._apiKeys);

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

    // ── Combined auth: API key OR JWT ────────────────────────────────────
    const hasApiKeyAuth = this.options.apiKeyAuth && this._apiKeys.size > 0;
    const hasJwtAuth = !!this.options.auth;

    if (hasApiKeyAuth || hasJwtAuth) {
      // Build the combined auth chain: API key → JWT → 401
      const apiKeyMw = hasApiKeyAuth
        ? createApiKeyMiddleware({ keys: this._apiKeys, onUse: (id) => this._touchApiKey(id) })
        : null;

      if (this.options.auth) {
        const auth = createAuthMiddleware(this.options.auth);
        authMiddleware = auth;
        this.app.post('/auth/token', (req, res) => {
          const { userId, orgId, teamId, projectId, secret } = req.body;
          if (!userId || secret !== this.options.auth!.secret) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          const token = auth.sign({ userId, orgId, teamId, projectId });
          res.json({ token, userId, orgId, teamId, projectId });
        });
      }

      // ── Key management endpoints (protected by master secret or JWT) ───
      this.app.get('/auth/keys', (req, res) => {
        if (!this.options.apiKeyAuth) return res.status(404).json({ error: 'API key auth not enabled' });
        // Require master secret in header for admin operations
        const masterSecret = typeof this.options.apiKeyAuth === 'string'
          ? this.options.apiKeyAuth
          : this.options.auth?.secret;
        if (!masterSecret) {
          return res.status(503).json({ error: 'No admin secret configured. Set TIMPS_API_KEY_AUTH to a secret string.' });
        }
        const adminToken = req.headers['x-admin-secret'] as string;
        if (!adminToken || adminToken !== masterSecret) {
          return res.status(403).json({ error: 'Invalid admin credentials' });
        }
        res.json({ keys: this.listApiKeys() });
      });

      this.app.post('/auth/key', (req, res) => {
        if (!this.options.apiKeyAuth) return res.status(404).json({ error: 'API key auth not enabled' });
        const masterSecret = typeof this.options.apiKeyAuth === 'string'
          ? this.options.apiKeyAuth
          : this.options.auth?.secret;
        if (!masterSecret) {
          return res.status(503).json({ error: 'No admin secret configured. Set TIMPS_API_KEY_AUTH to a secret string.' });
        }
        const adminToken = req.headers['x-admin-secret'] as string;
        if (!adminToken || adminToken !== masterSecret) {
          return res.status(403).json({ error: 'Invalid admin credentials' });
        }
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const { key, id } = this.generateNewApiKey(name);
        res.json({ key, id, name, message: 'Save this key — it will NOT be shown again.' });
      });

      this.app.delete('/auth/key/:id', (req, res) => {
        if (!this.options.apiKeyAuth) return res.status(404).json({ error: 'API key auth not enabled' });
        const masterSecret = typeof this.options.apiKeyAuth === 'string'
          ? this.options.apiKeyAuth
          : this.options.auth?.secret;
        if (!masterSecret) {
          return res.status(503).json({ error: 'No admin secret configured. Set TIMPS_API_KEY_AUTH to a secret string.' });
        }
        const adminToken = req.headers['x-admin-secret'] as string;
        if (!adminToken || adminToken !== masterSecret) {
          return res.status(403).json({ error: 'Invalid admin credentials' });
        }
        const revoked = this.revokeApiKey(req.params.id);
        res.json({ revoked });
      });

      // Combined auth middleware: try API key first, then JWT, then 401
      const combinedAuth = (req: any, res: any, next: any) => {
        // 1. Try API key
        if (apiKeyMw) {
          const apiKey = extractApiKey(req);
          if (apiKey) {
            return apiKeyMw(req, res, (err?: any) => {
              if (err) return next(err);
              next();
            });
          }
        }
        // 2. Try JWT
        if (authMiddleware) {
          return authMiddleware.middleware(req, res, next);
        }
        // 3. No auth method matched — deny
        res.status(401).json({ error: 'Authentication required. Provide Authorization: Bearer <api_key_or_jwt>' });
      };

      memoryRoutes = createMemoryRoutes(this.engine, this.wsServer);
      this.app.use('/memory', combinedAuth, rateLimitMiddleware, memoryRoutes);

      // Marketplace also behind auth
      const marketplaceRoutes = createMarketplaceRoutes(this.engine.backend);
      this.app.use('/marketplace', combinedAuth, marketplaceRoutes);
    } else {
      memoryRoutes = createMemoryRoutes(this.engine, this.wsServer);
      this.app.use('/memory', rateLimitMiddleware, memoryRoutes);

      // Marketplace open (no auth)
      const marketplaceRoutes = createMarketplaceRoutes(this.engine.backend);
      this.app.use('/marketplace', marketplaceRoutes);
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
        const authStatus = this.options.apiKeyAuth
          ? `API Key (${this._apiKeys.size} key(s)) + JWT`
          : this.options.auth
            ? 'JWT only'
            : 'DISABLED';
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     TIMPS MemoryServer (horizontal scale)                 ║
║     Stateless — all state externalized                    ║
║                                                           ║
║     HTTP:  http://localhost:${String(this.options.port).padEnd(36)}║
║     WS:    ws://localhost:${String(this.options.port)}${(this.options.wsPath ?? '/ws').padEnd(29)}║
║     Auth:  ${authStatus.padEnd(41)}║
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
║     - POST /auth/key              Generate API key        ║
║     - GET  /auth/keys             List API keys           ║
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

  // ─── API Key Management ────────────────────────────────────────────────

  /** Load API keys from disk, or auto-generate one if empty. */
  private _loadApiKeys(apiKeyAuth: boolean | string): void {
    try {
      if (fs.existsSync(this._apiKeysPath)) {
        const data = JSON.parse(fs.readFileSync(this._apiKeysPath, 'utf-8')) as ApiKeyRecord[];
        for (const record of data) {
          this._apiKeys.set(record.id, record);
        }
        console.log(`[MemoryServer] Loaded ${this._apiKeys.size} API key(s) from ${this._apiKeysPath}`);
      }
    } catch (err) {
      console.error('[MemoryServer] Failed to load API keys:', err);
    }

    // Auto-generate first key if none exist
    if (this._apiKeys.size === 0) {
      const { key, id } = this.generateNewApiKey('auto-generated');
      console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
      console.log(`║  🔑  FIRST API KEY GENERATED                             ║`);
      console.log(`║                                                           ║`);
      console.log(`║  ${key.padEnd(55)}║`);
      console.log(`║                                                           ║`);
      console.log(`║  Save this key — it will NOT be shown again.              ║`);
      console.log(`║  Use: Authorization: Bearer ${key.slice(0, 12)}...${' '.padEnd(21)}║`);
      console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
    }
  }

  /** Generate a new API key and persist it. Returns the plaintext key (shown once). */
  generateNewApiKey(name: string): { key: string; id: string } {
    const { key, hash, id } = generateApiKey(name);
    const record: ApiKeyRecord = {
      id,
      hash,
      name,
      createdAt: new Date().toISOString(),
    };
    this._apiKeys.set(id, record);
    this._saveApiKeys();
    return { key, id };
  }

  /** Revoke an API key by ID. */
  revokeApiKey(id: string): boolean {
    const existed = this._apiKeys.delete(id);
    if (existed) this._saveApiKeys();
    return existed;
  }

  /** List API key metadata (hashes redacted). */
  listApiKeys(): Array<Omit<ApiKeyRecord, 'hash'> & { hash: string }> {
    return Array.from(this._apiKeys.values()).map((r) => ({
      id: r.id,
      hash: r.hash.slice(0, 8) + '...',
      name: r.name,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
    }));
  }

  /** Save API keys to disk (hash only, never plaintext). */
  private _saveApiKeys(): void {
    try {
      const dir = path.dirname(this._apiKeysPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._apiKeysPath, JSON.stringify(Array.from(this._apiKeys.values()), null, 2), 'utf-8');
    } catch (err) {
      console.error('[MemoryServer] Failed to save API keys:', err);
    }
  }

  /** Update lastUsedAt timestamp for a key. */
  private _touchApiKey(keyId: string): void {
    const record = this._apiKeys.get(keyId);
    if (record) {
      record.lastUsedAt = new Date().toISOString();
      // Don't save on every request — just update in-memory
    }
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
