import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsRegistry } from './MetricsRegistry.js';
import { Tracer } from './TracerProvider.js';
import { RedactionPipeline } from './RedactionPipeline.js';
import { TelemetryManager } from './TelemetryManager.js';
import type { TelemetryConfig } from './types.js';
import { instrumentLayer, instrumentBackend, instrumentCRDT } from './instrumentation.js';

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  it('increments counter', () => {
    registry.counter('test.ops', 1, { layer: 'echo' });
    registry.counter('test.ops', 2, { layer: 'echo' });
    expect(registry.getCounter('test.ops', { layer: 'echo' })).toBe(3);
  });

  it('supports multiple counter label sets', () => {
    registry.counter('test.ops', 1, { layer: 'echo' });
    registry.counter('test.ops', 5, { layer: 'chronos' });
    expect(registry.getCounter('test.ops', { layer: 'echo' })).toBe(1);
    expect(registry.getCounter('test.ops', { layer: 'chronos' })).toBe(5);
    expect(registry.getCounter('test.ops')).toBe(6);
  });

  it('records histogram and computes percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      registry.histogram('test.latency', i, { layer: 'echo' });
    }
    const p = registry.histogramPercentiles('test.latency', { layer: 'echo' });
    expect(p).not.toBeNull();
    expect(p!.p50).toBeGreaterThanOrEqual(50);
    expect(p!.p95).toBeGreaterThanOrEqual(95);
    expect(p!.p99).toBeGreaterThanOrEqual(99);
  });

  it('returns null for unknown histogram', () => {
    expect(registry.histogramPercentiles('nonexistent')).toBeNull();
  });

  it('records gauge', () => {
    registry.gauge('memory.size', 1000, { org: 'test' });
    expect(registry.getGauge('memory.size', { org: 'test' })).toBe(1000);
    registry.gauge('memory.size', 2000, { org: 'test' });
    expect(registry.getGauge('memory.size', { org: 'test' })).toBe(2000);
  });

  it('exports in Prometheus text format', () => {
    registry.counter('test.ops', 42, { layer: 'echo' });
    registry.histogram('test.latency', 10, { layer: 'echo' });
    const output = registry.prometheusExport();
    expect(output).toContain('TYPE timps.test.ops counter');
    expect(output).toContain('timps.test.ops{layer="echo"} 42');
    expect(output).toContain('TYPE timps.test.latency_bucket histogram');
    expect(output).toContain('_bucket{layer="echo"}{le=');
  });

  it('resets all metrics', () => {
    registry.counter('test.ops', 10);
    expect(registry.getCounter('test.ops')).toBe(10);
    registry.reset();
    expect(registry.getCounter('test.ops')).toBe(0);
  });
});

describe('Tracer', () => {
  it('creates and records spans', () => {
    const registry = new MetricsRegistry();
    const tracer = new Tracer(registry, 'test-service', 1);
    const span = tracer.startSpan('test.op', { layer: 'echo' });
    span.setAttribute('key', 'value');
    span.addEvent('test-event', { detail: 'test' });
    span.setStatus('OK');
    span.end();

    const spans = registry.getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('test.op');
    expect(spans[0].attributes['key']).toBe('value');
    expect(spans[0].events).toHaveLength(1);
    expect(spans[0].status).toBe('OK');
  });

  it('records exceptions on spans', () => {
    const registry = new MetricsRegistry();
    const tracer = new Tracer(registry, 'test', 1);
    const span = tracer.startSpan('test.op');
    span.recordException(new Error('test error'));
    span.setStatus('ERROR');
    span.end();

    expect(span.span.events.some(e => e.name === 'exception')).toBe(true);
    expect(span.span.status).toBe('ERROR');
  });

  it('does not double-record spans', () => {
    const registry = new MetricsRegistry();
    const tracer = new Tracer(registry, 'test', 1);
    const span = tracer.startSpan('test.op');
    span.end();
    span.end(); // second call should be no-op
    expect(registry.getSpans()).toHaveLength(1);
  });
});

describe('RedactionPipeline', () => {
  let redactor: RedactionPipeline;

  beforeEach(() => {
    redactor = new RedactionPipeline();
  });

  it('strips content attributes', () => {
    const span = {
      name: 'test',
      startTime: 0,
      attributes: {
        'timps.layer': 'echo',
        'query.text': 'how does auth work?',
        'content': 'JWT tokens are used for authentication',
        'timps.operation': 'recall',
        'db.system': 'postgresql',
      },
      status: 'OK' as const,
      events: [],
      spanId: 'abc',
      traceId: 'def',
    };

    redactor.redactSpan(span as any);

    expect(span.attributes['timps.layer']).toBe('echo');
    expect(span.attributes['timps.operation']).toBe('recall');
    expect(span.attributes['db.system']).toBe('postgresql');
    expect(span.attributes['query.text']).toBeUndefined();
    expect(span.attributes['content']).toBeUndefined();
  });

  it('strips org_id and project_id', () => {
    const span = {
      name: 'test',
      startTime: 0,
      attributes: { org_id: 'org_123', project_id: 'proj_456', 'timps.version': '2.5.0' },
      status: 'OK' as const,
      events: [],
      spanId: 'a',
      traceId: 'b',
    };
    redactor.redactSpan(span as any);
    expect(span.attributes['org_id']).toBeUndefined();
    expect(span.attributes['project_id']).toBeUndefined();
    expect(span.attributes['timps.version']).toBe('2.5.0');
  });

  it('builds anonymous payload with aggregated metrics', () => {
    const registry = new MetricsRegistry();
    for (let i = 1; i <= 100; i++) {
      registry.histogram('recall.latency', i, { layer: 'echo' });
      registry.histogram('store.latency', i * 2, { layer: 'echo' });
    }
    registry.counter('contradiction.detected', 3);
    registry.counter('store.count', 100);
    registry.counter('recall.count', 200);
    registry.counter('cache.hit', 80);
    registry.counter('cache.miss', 20);
    registry.gauge('memory.storage_size_bytes', 500000);

    const payload = redactor.buildAnonymousPayload(registry, 'file', '2.5.0');
    expect(payload.version).toBe('2.5.0');
    expect(payload.backend).toBe('file');
    expect(payload.metrics.contradiction_rate_per_100).toBeGreaterThan(0);
    expect(payload.metrics.cache_hit_rate).toBe(0.8);
    expect(payload.metrics.recall_count).toBe(200);
    expect(payload.metrics.store_count).toBe(100);
    expect(payload.metrics.recall_latency_p99_ms['echo']).toBeGreaterThan(0);
    expect(payload.metrics.store_latency_p99_ms['echo']).toBeGreaterThan(0);
  });
});

describe('TelemetryManager', () => {
  it('creates no-op tracer when level is off', () => {
    const config: TelemetryConfig = { level: 'off' };
    const tm = new TelemetryManager(config);
    expect(tm.level).toBe('off');
    const span = tm.tracer.startSpan('test');
    span.end(); // should not throw
  });

  it('creates real tracer when level is local', () => {
    const config: TelemetryConfig = { level: 'local', serviceName: 'test', sampleRate: 1 };
    const tm = new TelemetryManager(config);
    expect(tm.level).toBe('local');
    const span = tm.tracer.startSpan('test.op');
    span.setStatus('OK');
    span.end();
    expect(tm.metrics.getSpans()).toHaveLength(1);
  });

  it('sets version and backend', () => {
    const config: TelemetryConfig = { level: 'local' };
    const tm = new TelemetryManager(config);
    tm.setVersion('3.0.0');
    tm.setBackend('postgres');
    expect(tm.version).toBe('3.0.0');
    expect(tm.backend).toBe('postgres');
  });

  it('stops cleans up intervals', () => {
    const config: TelemetryConfig = { level: 'local' };
    const tm = new TelemetryManager(config);
    tm.stop();
    expect(tm.metrics.getSpans()).toHaveLength(0);
  });
});

describe('instrumentLayer', () => {
  it('wraps IMemoryLayer methods with telemetry', async () => {
    const layer: any = {
      store: async () => 'mem_123',
      retrieve: async () => [],
      verify: async () => {},
      contradict: async () => {},
      archive: async () => {},
      getProvenance: async () => null,
      explain: async () => 'explanation',
      audit: async () => ({ totalEntries: 0, weak: 0, contradicted: 0, outdated: 0, unsourced: 0, layerBreakdown: {}, timestamp: 0 }),
      decay: async () => 0,
      customMethod: () => 'custom',
    };

    const config: TelemetryConfig = { level: 'local', sampleRate: 1 };
    const tm = new TelemetryManager(config);
    const wrapped = instrumentLayer(layer, 'test', tm);

    expect(wrapped.customMethod()).toBe('custom');

    const result = await wrapped.store('L3', {} as any);
    expect(result).toBe('mem_123');
  });

  it('returns original layer when telemetry is off', () => {
    const config: TelemetryConfig = { level: 'off' };
    const tm = new TelemetryManager(config);
    const layer = { store: async () => 'id' } as any;
    expect(instrumentLayer(layer, 'test', tm)).toBe(layer);
  });
});

describe('instrumentBackend', () => {
  it('wraps StorageBackend methods with telemetry', async () => {
    const backend: any = {
      read: async () => ({ data: 'test' }),
      write: async () => {},
      delete: async () => {},
      list: async () => ['key1'],
      append: async () => {},
      exists: async () => true,
    };

    const config: TelemetryConfig = { level: 'local', sampleRate: 1 };
    const tm = new TelemetryManager(config);
    const wrapped = instrumentBackend(backend, 'memory', tm);

    const result = await wrapped.read('test-key');
    expect(result).toEqual({ data: 'test' });

    const listResult = await wrapped.list('prefix');
    expect(listResult).toEqual(['key1']);
  });

  it('returns original backend when telemetry is off', () => {
    const config: TelemetryConfig = { level: 'off' };
    const tm = new TelemetryManager(config);
    const backend = { read: async () => null } as any;
    expect(instrumentBackend(backend, 'file', tm)).toBe(backend);
  });
});

describe('instrumentCRDT', () => {
  it('provides no-op functions when telemetry is off', () => {
    const crdt = instrumentCRDT({ level: 'off' } as any);
    expect(() => {
      crdt.recordConflict('auto_merged');
      crdt.recordMerge(5);
      crdt.recordCheck();
    }).not.toThrow();
  });

  it('records CRDT metrics when telemetry is on', () => {
    const config: TelemetryConfig = { level: 'local' };
    const tm = new TelemetryManager(config);
    const crdt = instrumentCRDT(tm);

    crdt.recordConflict('auto_merged');
    crdt.recordMerge(42);
    crdt.recordCheck();

    expect(tm.metrics.getCounter('crdt.conflict.detected', { resolution: 'auto_merged' })).toBe(1);
    expect(tm.metrics.getCounter('crdt.check')).toBe(1);
  });
});
