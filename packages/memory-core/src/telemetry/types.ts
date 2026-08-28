export type TelemetryLevel = 'off' | 'local' | 'anonymous';

export interface TelemetryConfig {
  level: TelemetryLevel;
  /** OTel collector endpoint (e.g. http://localhost:4318/v1/traces) */
  otelEndpoint?: string;
  /** Prometheus scrape endpoint for /metrics */
  metricsPort?: number;
  /** Service name for traces/metrics */
  serviceName?: string;
  /** Sample rate (0-1) for traces */
  sampleRate?: number;
  /** Redaction: extra attribute keys to strip */
  extraRedactKeys?: string[];
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export type SpanStatusCode = 'OK' | 'ERROR' | 'UNSET';

export interface Span {
  name: string;
  startTime: number;
  endTime?: number;
  attributes: SpanAttributes;
  status: SpanStatusCode;
  events: SpanEvent[];
  parentSpanId?: string;
  spanId: string;
  traceId: string;
}

export interface MetricPoint {
  name: string;
  value: number;
  attributes: SpanAttributes;
  timestamp: number;
  type: 'counter' | 'histogram' | 'gauge';
}

export interface HistogramBuckets {
  bounds: number[];
  counts: number[];
  totalCount: number;
  totalSum: number;
  min: number;
  max: number;
}

export interface AnonymousMetricsPayload {
  timestamp: string;
  version: string;
  backend: string;
  metrics: {
    recall_latency_p99_ms: Record<string, number>;
    store_latency_p99_ms: Record<string, number>;
    contradiction_rate_per_100: number;
    memory_growth_bytes_per_day: number;
    cache_hit_rate: number;
    error_rate: number;
    recall_count: number;
    store_count: number;
    active_layers: string[];
  };
}

export const DEFAULT_HISTOGRAM_BUCKETS = [
  1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

export const METRIC_PREFIX = 'timps';
