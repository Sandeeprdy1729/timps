import type { MetricPoint, HistogramBuckets, Span, SpanAttributes } from './types.js';
import { DEFAULT_HISTOGRAM_BUCKETS, METRIC_PREFIX } from './types.js';

export class MetricsRegistry {
  private _counters = new Map<string, { value: number; attributes: SpanAttributes; lastUpdate: number }[]>();
  private _histograms = new Map<string, { buckets: HistogramBuckets; attributes: SpanAttributes }[]>();
  private _gauges = new Map<string, { value: number; attributes: SpanAttributes; lastUpdate: number }[]>();
  private _spans: Span[] = [];
  private _maxSpans = 10000;

  private _key(name: string, attrs: SpanAttributes): string {
    return `${name}:${JSON.stringify(attrs)}`;
  }

  private _attrsKey(attrs: SpanAttributes): string {
    return Object.entries(attrs)
      .filter(([, v]) => v !== undefined && v !== '')
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  /**
   * Increment a counter. Creates if not exists.
   */
  counter(name: string, value: number, attributes: SpanAttributes = {}): void {
    const fullName = `${METRIC_PREFIX}.${name}`;
    const key = this._key(fullName, attributes);
    let entries = this._counters.get(fullName);
    if (!entries) {
      entries = [];
      this._counters.set(fullName, entries);
    }
    const existing = entries.find(e => this._attrsKey(e.attributes) === this._attrsKey(attributes));
    if (existing) {
      existing.value += value;
      existing.lastUpdate = Date.now();
    } else {
      entries.push({ value, attributes: { ...attributes }, lastUpdate: Date.now() });
    }
  }

  /**
   * Record a value in a histogram with pre-defined buckets.
   */
  histogram(name: string, value: number, attributes: SpanAttributes = {}): void {
    const fullName = `${METRIC_PREFIX}.${name}`;
    let entries = this._histograms.get(fullName);
    if (!entries) {
      entries = [];
      this._histograms.set(fullName, entries);
    }
    const key = this._attrsKey(attributes);
    let existing = entries.find(e => this._attrsKey(e.attributes) === key);
    if (!existing) {
      existing = {
        buckets: {
          bounds: DEFAULT_HISTOGRAM_BUCKETS,
          counts: new Array(DEFAULT_HISTOGRAM_BUCKETS.length + 1).fill(0),
          totalCount: 0,
          totalSum: 0,
          min: value,
          max: value,
        },
        attributes: { ...attributes },
      };
      entries.push(existing);
    }
    const h = existing.buckets;
    h.totalCount++;
    h.totalSum += value;
    if (value < h.min) h.min = value;
    if (value > h.max) h.max = value;
    let placed = false;
    for (let i = 0; i < h.bounds.length; i++) {
      if (value <= h.bounds[i]) {
        h.counts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) h.counts[h.bounds.length]++;
  }

  /**
   * Set a gauge value. Overwrites previous value for the same attribute set.
   */
  gauge(name: string, value: number, attributes: SpanAttributes = {}): void {
    const fullName = `${METRIC_PREFIX}.${name}`;
    let entries = this._gauges.get(fullName);
    if (!entries) {
      entries = [];
      this._gauges.set(fullName, entries);
    }
    const key = this._attrsKey(attributes);
    const existing = entries.find(e => this._attrsKey(e.attributes) === key);
    if (existing) {
      existing.value = value;
      existing.lastUpdate = Date.now();
    } else {
      entries.push({ value, attributes: { ...attributes }, lastUpdate: Date.now() });
    }
  }

  /**
   * Record a completed span.
   */
  recordSpan(span: Span): void {
    this._spans.push(span);
    if (this._spans.length > this._maxSpans) {
      this._spans.splice(0, this._spans.length - this._maxSpans);
    }
  }

  /**
   * Get all recorded spans (traces).
   */
  getSpans(): Span[] {
    return this._spans;
  }

  /**
   * Get all metric points as a flat array.
   */
  getMetricPoints(): MetricPoint[] {
    const points: MetricPoint[] = [];
    const now = Date.now();

    for (const [, entries] of this._counters) {
      for (const e of entries) {
        for (const [name] of this._counters) {
          if (this._counters.get(name)?.includes(e)) {
            points.push({ name, value: e.value, attributes: e.attributes, timestamp: e.lastUpdate, type: 'counter' });
          }
        }
      }
    }

    for (const [name, entries] of this._histograms) {
      for (const e of entries) {
        points.push({
          name: `${name}_sum`,
          value: e.buckets.totalSum,
          attributes: e.attributes,
          timestamp: now,
          type: 'histogram',
        });
        points.push({
          name: `${name}_count`,
          value: e.buckets.totalCount,
          attributes: e.attributes,
          timestamp: now,
          type: 'histogram',
        });
      }
    }

    for (const [name, entries] of this._gauges) {
      for (const e of entries) {
        points.push({ name, value: e.value, attributes: e.attributes, timestamp: e.lastUpdate, type: 'gauge' });
      }
    }

    return points;
  }

  /**
   * Get p50/p95/p99 for a named histogram.
   */
  histogramPercentiles(name: string, attributes?: SpanAttributes): Record<string, number> | null {
    const fullName = `${METRIC_PREFIX}.${name}`;
    const entries = this._histograms.get(fullName);
    if (!entries || entries.length === 0) return null;

    const match = attributes
      ? entries.find(e => this._attrsKey(e.attributes) === this._attrsKey(attributes))
      : entries[0];
    if (!match) return null;

    const h = match.buckets;
    if (h.totalCount === 0) return { p50: 0, p95: 0, p99: 0 };

    const percentile = (p: number) => {
      const target = p * h.totalCount;
      let cumulative = 0;
      for (let i = 0; i < h.counts.length; i++) {
        cumulative += h.counts[i];
        if (cumulative >= target) {
          if (i < h.bounds.length) return h.bounds[i];
          return h.bounds[h.bounds.length - 1] * 1.5;
        }
      }
      return h.bounds[h.bounds.length - 1] * 1.5;
    };

    return { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) };
  }

  /**
   * Get the current value of a counter.
   */
  getCounter(name: string, attributes?: SpanAttributes): number {
    const fullName = `${METRIC_PREFIX}.${name}`;
    const entries = this._counters.get(fullName);
    if (!entries) return 0;
    if (!attributes) return entries.reduce((s, e) => s + e.value, 0);
    const match = entries.find(e => this._attrsKey(e.attributes) === this._attrsKey(attributes));
    return match?.value ?? 0;
  }

  /**
   * Get the current value of a gauge.
   */
  getGauge(name: string, attributes?: SpanAttributes): number | null {
    const fullName = `${METRIC_PREFIX}.${name}`;
    const entries = this._gauges.get(fullName);
    if (!entries) return null;
    if (!attributes && entries.length === 1) return entries[0].value;
    if (!attributes) return null;
    const match = entries.find(e => this._attrsKey(e.attributes) === this._attrsKey(attributes));
    return match?.value ?? null;
  }

  /**
   * Export metrics in Prometheus-compatible text format.
   */
  prometheusExport(): string {
    const lines: string[] = [];
    const now = Date.now();

    for (const [name, entries] of this._counters) {
      for (const e of entries) {
        const attrs = Object.entries(e.attributes)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labels = attrs ? `{${attrs}}` : '';
        lines.push(`# TYPE ${name} counter`);
        lines.push(`${name}${labels} ${e.value} ${now}`);
      }
    }

    for (const [name, entries] of this._histograms) {
      for (const e of entries) {
        const attrs = Object.entries(e.attributes)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labels = attrs ? `{${attrs}}` : '';
        const h = e.buckets;
        lines.push(`# TYPE ${name}_bucket histogram`);
        for (let i = 0; i < h.bounds.length; i++) {
          const le = h.bounds[i];
          lines.push(`${name}_bucket${labels}{le="${le}"} ${h.counts[i]} ${now}`);
        }
        lines.push(`${name}_bucket${labels}{le="+Inf"} ${h.counts[h.bounds.length]} ${now}`);
        lines.push(`${name}_count${labels} ${h.totalCount} ${now}`);
        lines.push(`${name}_sum${labels} ${h.totalSum} ${now}`);
      }
    }

    for (const [name, entries] of this._gauges) {
      for (const e of entries) {
        const attrs = Object.entries(e.attributes)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labels = attrs ? `{${attrs}}` : '';
        lines.push(`# TYPE ${name} gauge`);
        lines.push(`${name}${labels} ${e.value} ${e.lastUpdate}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this._counters.clear();
    this._histograms.clear();
    this._gauges.clear();
    this._spans = [];
  }
}
