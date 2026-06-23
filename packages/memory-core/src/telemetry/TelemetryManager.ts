import { MetricsRegistry } from './MetricsRegistry.js';
import { Tracer, NoopTracer } from './TracerProvider.js';
import { RedactionPipeline } from './RedactionPipeline.js';
import type { TelemetryConfig, TelemetryLevel } from './types.js';

export type { TelemetryConfig, TelemetryLevel };

/**
 * Central telemetry manager for TIMPS memory-core.
 *
 * Three modes:
 *   off       — zero allocation, no-op tracer (default)
 *   local     — metrics + traces kept in-memory, exposed via /metrics endpoint
 *               for self-hosted Prometheus + Grafana
 *   anonymous — same as local + periodic redacted export
 *
 * OTel SDK is NOT required. When available (optional peer dep), the metrics
 * registry can bridge to OTel-compatible format for the Collector.
 */
export class TelemetryManager {
  readonly level: TelemetryLevel;
  readonly metrics: MetricsRegistry;
  readonly tracer: Tracer | NoopTracer;
  readonly redaction: RedactionPipeline;
  readonly config: TelemetryConfig;

  private _exportInterval: ReturnType<typeof setInterval> | null = null;
  private _version = '2.5.0';
  private _backend = 'file';

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.level = config.level;

    if (config.level === 'off') {
      this.metrics = new MetricsRegistry();
      this.tracer = new NoopTracer();
      this.redaction = new RedactionPipeline([]);
      return;
    }

    this.metrics = new MetricsRegistry();
    this.tracer = new Tracer(
      this.metrics,
      config.serviceName ?? 'timps-memory',
      config.sampleRate ?? 1,
    );
    this.redaction = new RedactionPipeline(config.extraRedactKeys ?? []);

    if (config.level === 'anonymous') {
      this._startAnonymousExport();
    }
  }

  setVersion(version: string): void {
    this._version = version;
  }

  setBackend(backend: string): void {
    this._backend = backend;
  }

  get version(): string {
    return this._version;
  }

  get backend(): string {
    return this._backend;
  }

  /**
   * Register an anonymous export callback.
   * Called periodically with redacted metrics payload.
   */
  onAnonymousExport: ((payload: unknown) => void) | null = null;

  private _startAnonymousExport(): void {
    this._exportInterval = setInterval(() => {
      if (!this.onAnonymousExport) return;
      try {
        const payload = this.redaction.buildAnonymousPayload(
          this.metrics,
          this._backend,
          this._version,
        );
        this.onAnonymousExport(payload);
        this.metrics.reset();
      } catch {
        /* silent */
      }
    }, 3600000); // every hour
  }

  /**
   * Stop telemetry — cancel export interval, reset metrics.
   */
  stop(): void {
    if (this._exportInterval) {
      clearInterval(this._exportInterval);
      this._exportInterval = null;
    }
    this.metrics.reset();
  }
}
