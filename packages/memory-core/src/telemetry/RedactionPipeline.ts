import type { Span, SpanAttributes, MetricPoint, AnonymousMetricsPayload } from './types.js';

/**
 * Privacy redaction pipeline.
 * Strips all content/identifiers from telemetry data.
 * Keeps only aggregate performance metrics, error types, and structural metadata.
 */
export class RedactionPipeline {
  private _extraRedactKeys: string[];

  /** Attribute keys that contain content or identifiers — MUST be stripped */
  private static readonly CONTENT_KEYS = new Set([
    'query',
    'query.text',
    'content',
    'memory.content',
    'entry.content',
    'file.path',
    'file_path',
    'org_id',
    'orgId',
    'project_id',
    'projectId',
    'team_id',
    'teamId',
    'actor_id',
    'actorId',
    'user.id',
    'user_id',
    'user.name',
    'agent.id',
    'agent_id',
    'agent.name',
    'entry.id',
    'entry_id',
    'span.name',
  ]);

  /** Attribute keys that are SAFE to keep */
  private static readonly SAFE_KEYS = new Set([
    'service.name',
    'timps.layer',
    'timps.version',
    'timps.operation',
    'layer',
    'operation',
    'db.system',
    'db.operation',
    'vector.dimensions',
    'error.type',
    'error.code',
    'status.code',
    'backend.type',
    'cache.hit',
    'cache.miss',
    'plugin.name',
    'store.result',
    'recall.result',
    'resolution',
    'result.count',
    'duration_ms',
    'query.length',
  ]);

  constructor(extraRedactKeys: string[] = []) {
    this._extraRedactKeys = extraRedactKeys;
  }

  /**
   * Redact span attributes in-place.
   * All content/identifier attributes are removed.
   * Only safe attributes are preserved.
   */
  redactSpan(span: Span): void {
    const safe: SpanAttributes = {};
    for (const [key, value] of Object.entries(span.attributes)) {
      if (this._isSafe(key)) {
        safe[key] = value;
      }
    }
    span.attributes = safe;

    for (const event of span.events) {
      if (event.attributes) {
        const safeEvent: SpanAttributes = {};
        for (const [key, value] of Object.entries(event.attributes)) {
          if (this._isSafe(key)) {
            safeEvent[key] = value;
          }
        }
        event.attributes = safeEvent;
      }
    }
  }

  /**
   * Redact metric attributes in-place.
   */
  redactMetric(point: MetricPoint): void {
    const safe: SpanAttributes = {};
    for (const [key, value] of Object.entries(point.attributes)) {
      if (this._isSafe(key)) {
        safe[key] = value;
      }
    }
    point.attributes = safe;
  }

  /**
   * Build an anonymous metrics payload from raw metrics.
   * This is the strictest redaction — only aggregate numbers survive.
   */
  buildAnonymousPayload(
    metricsRegistry: {
      histogramPercentiles(name: string, attrs?: SpanAttributes): Record<string, number> | null;
      getCounter(name: string, attrs?: SpanAttributes): number;
      getGauge(name: string, attrs?: SpanAttributes): number | null;
    },
    backendType: string,
    version: string,
  ): AnonymousMetricsPayload {
    const layers = ['echo', 'chronos', 'harmonic', 'aether', 'resonance', 'supra', 'provenance', 'engram', 'context'];

    const recallLatency: Record<string, number> = {};
    const storeLatency: Record<string, number> = {};

    for (const layer of layers) {
      const recallP99 = metricsRegistry.histogramPercentiles('recall.latency', { layer });
      if (recallP99) recallLatency[layer] = recallP99.p99;
      const storeP99 = metricsRegistry.histogramPercentiles('store.latency', { layer });
      if (storeP99) storeLatency[layer] = storeP99.p99;
    }

    const contradictions = metricsRegistry.getCounter('contradiction.detected');
    const totalStores = metricsRegistry.getCounter('store.count');
    const contradictionRate = totalStores > 0 ? (contradictions / totalStores) * 100 : 0;

    const cacheHits = metricsRegistry.getCounter('cache.hit');
    const cacheMisses = metricsRegistry.getCounter('cache.miss');
    const totalCache = cacheHits + cacheMisses;
    const cacheHitRate = totalCache > 0 ? cacheHits / totalCache : 0;

    const errors = this._collectErrorRates(metricsRegistry);
    const recallCount = metricsRegistry.getCounter('recall.count');
    const storeCount = metricsRegistry.getCounter('store.count');
    const memoryGrowth = metricsRegistry.getGauge('memory.storage_size_bytes');

    return {
      timestamp: new Date().toISOString(),
      version,
      backend: backendType,
      metrics: {
        recall_latency_p99_ms: recallLatency,
        store_latency_p99_ms: storeLatency,
        contradiction_rate_per_100: Math.round(contradictionRate * 10) / 10,
        memory_growth_bytes_per_day: memoryGrowth ?? 0,
        cache_hit_rate: Math.round(cacheHitRate * 100) / 100,
        error_rate: errors,
        recall_count: recallCount,
        store_count: storeCount,
        active_layers: layers.filter(l => recallLatency[l] !== undefined || storeLatency[l] !== undefined),
      },
    };
  }

  private _collectErrorRates(registry: {
    getCounter(name: string, attrs?: Record<string, string | number>): number;
  }): number {
    const layerErrors = ['echo', 'chronos', 'harmonic', 'aether'];
    let totalErrors = 0;
    for (const layer of layerErrors) {
      totalErrors += registry.getCounter('errors', { layer });
      totalErrors += registry.getCounter('recall.errors', { layer });
      totalErrors += registry.getCounter('store.errors', { layer });
    }
    const totalOps = registry.getCounter('recall.count') + registry.getCounter('store.count');
    return totalOps > 0 ? totalErrors / totalOps : 0;
  }

  private _isSafe(key: string): boolean {
    if (this._extraRedactKeys.includes(key)) return false;
    if (RedactionPipeline.SAFE_KEYS.has(key)) return true;
    if (RedactionPipeline.CONTENT_KEYS.has(key)) return false;

    if (
      key.startsWith('exception.') ||
      key.startsWith('http.') ||
      key.startsWith('net.') ||
      key.startsWith('db.')
    ) return true;

    return false;
  }
}
