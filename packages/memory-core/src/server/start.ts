// ── TIMPS MemoryServer — env-var entry point ──
// Reads environment variables and starts MemoryServer with proper backends.
// Used by docker-compose and k8s deployments.
//
// Environment variables:
//   MEMORY_PROJECT_PATH  - storage directory (default: /data)
//   MEMORY_PORT          - HTTP port (default: 4100)
//   MEMORY_GRPC_PORT     - gRPC port (default: 4101)
//   POSTGRES_PRIMARY     - Postgres connection string for primary
//   POSTGRES_REPLICAS    - comma-separated replica connection strings
//   REDIS_URL            - Redis URL for cache + pub/sub
//   QDRANT_URL           - Qdrant URL for vector search
//   TIMPS_TELEMETRY_LEVEL   - 'off' | 'local' | 'anonymous' (default: off)
//   TIMPS_TELEMETRY_OTEL_ENDPOINT - OTel HTTP exporter endpoint
//   TIMPS_API_KEY_AUTH    - Enable API key auth. 'true' = auto-generate, or a master secret string.
//   TIMPS_JWT_SECRET      - JWT secret for Bearer token auth.

import { MemoryServer } from './MemoryServer';
import type { MemoryServerOptions } from './MemoryServer';
import type { MemoryEngineOptions } from '../MemoryEngine';
import type { TelemetryConfig } from '../telemetry/types';

async function main(): Promise<void> {
  const projectPath = process.env.MEMORY_PROJECT_PATH || '/data';
  const port = parseInt(process.env.MEMORY_PORT || '4100', 10);
  const grpcPort = parseInt(process.env.MEMORY_GRPC_PORT || '4101', 10);

  const engineOptions: MemoryEngineOptions = {};

  // ── PostgresBackend (primary + replicas) ──
  const postgresPrimary = process.env.POSTGRES_PRIMARY;
  if (postgresPrimary) {
    const { PostgresBackend } = await import('../backends/PostgresBackend');
    const replicas = process.env.POSTGRES_REPLICAS
      ? process.env.POSTGRES_REPLICAS.split(',').map(s => s.trim())
      : undefined;
    engineOptions.backend = new PostgresBackend({ primary: postgresPrimary, replicas });
  }

  // ── QdrantBackend (vector search) ──
  const qdrantUrl = process.env.QDRANT_URL;
  if (qdrantUrl) {
    const { QdrantBackend } = await import('../backends/QdrantBackend');
    engineOptions.qdrant = new QdrantBackend({ url: qdrantUrl });
  }

  // ── CacheManager (Redis-backed forge state cache) ──
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const { CacheManager } = await import('../cache/CacheManager');
    engineOptions.cacheManager = new CacheManager({ url: redisUrl });
  }

  // ── Telemetry ──
  let telemetry: TelemetryConfig | undefined;
  const telemetryLevel = process.env.TIMPS_TELEMETRY_LEVEL;
  if (telemetryLevel === 'local' || telemetryLevel === 'anonymous') {
    telemetry = {
      level: telemetryLevel,
      otelEndpoint: process.env.TIMPS_TELEMETRY_OTEL_ENDPOINT,
    };
  }

  // ── EventBus (Redis pub/sub, MemoryServer creates it when eventBus !== false) ──
  const eventBusOpts = redisUrl ? { url: redisUrl } : false;

  // ── Auth configuration ──
  const jwtSecret = process.env.TIMPS_JWT_SECRET;
  const apiKeyAuthEnv = process.env.TIMPS_API_KEY_AUTH;

  const options: MemoryServerOptions = {
    projectPath,
    port,
    grpc: { port: grpcPort },
    eventBus: eventBusOpts,
    engineOptions,
    telemetry,
  };

  // Enable API key auth if TIMPS_API_KEY_AUTH is set
  if (apiKeyAuthEnv) {
    options.apiKeyAuth = apiKeyAuthEnv === 'true' ? true : apiKeyAuthEnv;
  }

  // Enable JWT auth if TIMPS_JWT_SECRET is set
  if (jwtSecret) {
    options.auth = { secret: jwtSecret };
  }

  const server = new MemoryServer(options);
  await server.start();

  console.log(`[start] MemoryServer listening on :${port}`);
}

main().catch((err) => {
  console.error('[start] Fatal error:', err);
  process.exit(1);
});
