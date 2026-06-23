import type { TelemetryManager } from './TelemetryManager.js';
import type { IMemoryLayer } from '../IMemoryLayer.js';
import type { StorageBackend, OrgScope } from '../backends/types.js';

/**
 * Wrap an IMemoryLayer with telemetry spans and metrics.
 */
const ILAYER_METHODS = new Set([
  'store', 'retrieve', 'verify', 'contradict', 'archive',
  'getProvenance', 'explain', 'audit', 'decay',
]);

export function instrumentLayer<T extends IMemoryLayer>(
  layer: T,
  layerName: string,
  telemetry: TelemetryManager,
): T {
  if (telemetry.level === 'off') return layer;

  const { metrics, tracer } = telemetry;

  return new Proxy(layer, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string' || !ILAYER_METHODS.has(prop)) {
        return Reflect.get(target, prop, receiver);
      }

      const methodName = prop as string;
      const originalFn = (target as any)[methodName];
      if (typeof originalFn !== 'function') return originalFn;

      return async (...args: any[]): Promise<any> => {
        const span = tracer.startSpan(`${layerName}.${methodName}`, {
          'timps.layer': layerName,
          'timps.operation': methodName,
        });

        const start = Date.now();
        try {
          const result = await originalFn.apply(target, args);
          const duration = Date.now() - start;

          metrics.histogram(`${methodName}.latency`, duration, { layer: layerName });
          metrics.counter(`${methodName}.count`, 1, { layer: layerName });

          span.setAttribute('duration_ms', duration);
          span.setStatus('OK');

          return result;
        } catch (err) {
          const duration = Date.now() - start;
          metrics.histogram(`${methodName}.latency`, duration, { layer: layerName });
          metrics.counter('errors', 1, { layer: layerName, operation: methodName });
          metrics.counter(`${methodName}.errors`, 1, { layer: layerName });

          span.recordException(err instanceof Error ? err : new Error(String(err)));
          span.setAttribute('duration_ms', duration);
          span.setStatus('ERROR');

          throw err;
        } finally {
          span.end();
        }
      };
    },
  }) as T;
}

/**
 * Wrap a StorageBackend with telemetry spans and metrics.
 */
export function instrumentBackend(
  backend: StorageBackend,
  backendType: string,
  telemetry: TelemetryManager,
): StorageBackend {
  if (telemetry.level === 'off') return backend;

  const { metrics, tracer } = telemetry;

  const wrapAsync = <T>(method: string, fn: (...args: any[]) => Promise<T> | T): (...args: any[]) => Promise<T> => {
    return async (...args: any[]): Promise<T> => {
      const span = tracer.startSpan(`${backendType}.${method}`, {
        'db.system': backendType,
        'db.operation': method,
      });

      const start = Date.now();
      try {
        const result = await fn.apply(backend, args);
        const duration = Date.now() - start;

        metrics.histogram(`backend.latency`, duration, { backend: backendType, operation: method });
        metrics.counter(`backend.ops`, 1, { backend: backendType, operation: method });

        span.setAttribute('duration_ms', duration);
        if (method === 'read' || method === 'list' || method === 'query') {
          const count = Array.isArray(result) ? result.length : (result !== null && result !== undefined ? 1 : 0);
          span.setAttribute('result.count', count);
        }
        span.setStatus('OK');

        return result;
      } catch (err) {
        const duration = Date.now() - start;
        metrics.histogram(`backend.latency`, duration, { backend: backendType, operation: method });
        metrics.counter('errors', 1, { backend: backendType, operation: method });

        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setAttribute('duration_ms', duration);
        span.setStatus('ERROR');

        throw err;
      } finally {
        span.end();
      }
    };
  };

  return {
    read: wrapAsync('read', backend.read.bind(backend)),
    write: wrapAsync('write', backend.write.bind(backend)),
    delete: wrapAsync('delete', backend.delete.bind(backend)),
    list: wrapAsync('list', backend.list.bind(backend)),
    query: backend.query ? wrapAsync('query', backend.query.bind(backend)) : undefined,
    exists: backend.exists ? wrapAsync('exists', backend.exists.bind(backend)) : undefined,
    append: wrapAsync('append', backend.append.bind(backend)),
    beginTxn: backend.beginTxn ? wrapAsync('beginTxn', backend.beginTxn.bind(backend)) : undefined,
    setScope: backend.setScope ? ((scope: OrgScope | null) => backend.setScope!(scope)) as any : undefined,
    getScope: backend.getScope ? (() => backend.getScope!()) as any : undefined,
  } as StorageBackend;
}

/**
 * Track CRDT conflict metrics.
 */
export function instrumentCRDT(
  telemetry: TelemetryManager | { level: string },
): {
  recordConflict: (resolution: string) => void;
  recordMerge: (durationMs: number) => void;
  recordCheck: () => void;
} {
  if (telemetry.level === 'off') {
    return { recordConflict: () => {}, recordMerge: () => {}, recordCheck: () => {} };
  }

  const tm = telemetry as TelemetryManager;
  const metrics = tm.metrics;

  return {
    recordConflict(resolution: string): void {
      metrics.counter('crdt.conflict.detected', 1, { resolution });
    },
    recordMerge(durationMs: number): void {
      metrics.histogram('crdt.merge.latency', durationMs);
    },
    recordCheck(): void {
      metrics.counter('crdt.check', 1);
    },
  };
}
