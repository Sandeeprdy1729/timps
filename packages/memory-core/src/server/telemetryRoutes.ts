import { Router } from 'express';
import type { TelemetryManager } from '../telemetry/TelemetryManager';

/**
 * Express router for telemetry endpoints.
 *
 * GET  /metrics          — Prometheus-compatible metrics export
 * GET  /metrics/json     — JSON format metrics (for anonymous export preview)
 * POST /telemetry/reset  — Reset all metrics (admin)
 */
export function createTelemetryRoutes(telemetry: TelemetryManager): Router {
  const router = Router();

  // Prometheus text format — for scraping by Prometheus/OTel Collector
  router.get('/', (_req, res) => {
    try {
      const body = telemetry.metrics.prometheusExport();
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(body);
    } catch (err) {
      res.status(500).json({ error: 'Failed to export metrics' });
    }
  });

  // JSON format — for debugging and anonymous export preview
  router.get('/json', (_req, res) => {
    try {
      const points = telemetry.metrics.getMetricPoints();
      const spans = telemetry.metrics.getSpans().slice(-100);
      res.json({
        level: telemetry.level,
        metrics: points,
        recentSpans: spans.length,
        uptime: process.uptime(),
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to export metrics' });
    }
  });

  // Reset all metrics
  router.post('/reset', (_req, res) => {
    telemetry.metrics.reset();
    res.json({ status: 'ok' });
  });

  return router;
}
