import type { Span, SpanAttributes, SpanEvent, SpanStatusCode } from './types.js';
import { MetricsRegistry } from './MetricsRegistry.js';
import crypto from 'crypto';

/**
 * Lightweight tracer — no OTel SDK required.
 * When OTel is configured, spans can be bridged to OTel-compatible format
 * for the OpenTelemetry Collector.
 */
export class Tracer {
  private _registry: MetricsRegistry;
  private _serviceName: string;
  private _sampleRate: number;

  constructor(registry: MetricsRegistry, serviceName = 'timps-memory', sampleRate = 1) {
    this._registry = registry;
    this._serviceName = serviceName;
    this._sampleRate = Math.max(0, Math.min(1, sampleRate));
  }

  get serviceName(): string {
    return this._serviceName;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  /**
   * Start a new span. Returns a SpanHandle that must be `.end()`called.
   * The span is recorded in the MetricsRegistry on end.
   */
  startSpan(name: string, attributes: SpanAttributes = {}): SpanHandle {
    const registry = this._registry;
    const serviceName = this._serviceName;
    const shouldSample = Math.random() < this._sampleRate;
    const span: Span = {
      name,
      startTime: Date.now(),
      attributes: {
        'service.name': this._serviceName,
        ...attributes,
      },
      status: 'UNSET' as SpanStatusCode,
      events: [],
      spanId: crypto.randomBytes(8).toString('hex'),
      traceId: crypto.randomBytes(16).toString('hex'),
    };

    const handle: SpanHandle = {
      span,
      _recorded: false,

      setAttribute(key: string, value: string | number | boolean | undefined): void {
        if (value === undefined) return;
        span.attributes[key] = value;
      },

      setAttributes(attrs: SpanAttributes): void {
        Object.assign(span.attributes, attrs);
      },

      addEvent(name: string, eventAttributes?: SpanAttributes): void {
        span.events.push({ name, timestamp: Date.now(), attributes: eventAttributes });
      },

      recordException(err: Error): void {
        span.events.push({
          name: 'exception',
          timestamp: Date.now(),
          attributes: { 'exception.message': err.message, 'exception.type': err.name },
        });
      },

      setStatus(code: SpanStatusCode): void {
        span.status = code;
      },

      end(): void {
        if (handle._recorded) return;
        handle._recorded = true;
        span.endTime = Date.now();
        const duration = span.endTime - span.startTime;

        if (!shouldSample) return;

        registry.recordSpan(span);

        registry.histogram('span.duration', duration, {
          'span.name': name,
          'service.name': serviceName,
        });

        if (span.status === 'ERROR') {
          registry.counter('span.errors', 1, {
            'span.name': name,
            'service.name': serviceName,
          });
        }
      },
    };

    return handle;
  }
}

export interface SpanHandle {
  span: Span;
  _recorded: boolean;
  setAttribute(key: string, value: string | number | boolean | undefined): void;
  setAttributes(attrs: SpanAttributes): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  recordException(err: Error): void;
  setStatus(code: SpanStatusCode): void;
  end(): void;
}

/**
 * No-op tracer — zero overhead when telemetry is off.
 * All methods are empty, no objects are allocated for spans.
 */
export class NoopTracer {
  serviceName = '';
  sampleRate = 0;

  startSpan(): NoopSpanHandle {
    return noopSpanHandle;
  }
}

export interface NoopSpanHandle {
  setAttribute(): void;
  setAttributes(): void;
  addEvent(): void;
  recordException(): void;
  setStatus(): void;
  end(): void;
}

const noopSpanHandle: NoopSpanHandle = {
  setAttribute: () => {},
  setAttributes: () => {},
  addEvent: () => {},
  recordException: () => {},
  setStatus: () => {},
  end: () => {},
};
