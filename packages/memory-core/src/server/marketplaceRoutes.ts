import { Router } from 'express';
import type { Response } from 'express';
import { PluginRegistry } from '../marketplace/registry.js';
import type { PluginPackage } from '../marketplace/types.js';
import type { AuthenticatedRequest } from './auth.js';
import type { StorageBackend } from '../backends/types.js';

export function createMarketplaceRoutes(backend: StorageBackend): Router {
  const router = Router();
  const registry = new PluginRegistry(backend);

  router.post('/submit', (req: AuthenticatedRequest, res: Response) => {
    try {
      const pkg = req.body as PluginPackage;
      if (!pkg.manifest || !pkg.payload || !pkg.checksum) {
        return res.status(400).json({ error: 'Missing required fields: manifest, payload, checksum' });
      }
      if (!pkg.manifest.name || !pkg.manifest.version) {
        return res.status(400).json({ error: 'Manifest must include name and version' });
      }
      const result = registry.submit(pkg);
      if (result.status === 'rejected') {
        return res.status(422).json(result);
      }
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/plugins', (_req: AuthenticatedRequest, res: Response) => {
    const plugins = registry.list();
    res.json(plugins.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      author: p.author,
      license: p.license,
      latestVersion: p.latestVersion,
      permissions: p.permissions,
      avgRating: p.avgRating,
      reviewCount: p.reviewCount,
      totalDownloads: p.totalDownloads,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })));
  });

  router.get('/plugins/search', (req: AuthenticatedRequest, res: Response) => {
    const q = String(req.query.q ?? '');
    if (!q) return res.json(registry.list());
    const results = registry.search(q);
    res.json(results.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      author: p.author,
      latestVersion: p.latestVersion,
      avgRating: p.avgRating,
      reviewCount: p.reviewCount,
    })));
  });

  router.get('/plugins/:name', (req: AuthenticatedRequest, res: Response) => {
    const info = registry.get(String(req.params.name));
    if (!info) return res.status(404).json({ error: 'Plugin not found' });
    res.json(info);
  });

  router.post('/plugins/:name/rate', (req: AuthenticatedRequest, res: Response) => {
    const { rating, review } = req.body;
    const userId = req.auth?.userId ?? 'anonymous';
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    const entry = registry.addRating(String(req.params.name), userId, rating, review);
    res.json(entry);
  });

  router.get('/plugins/:name/reviews', (req: AuthenticatedRequest, res: Response) => {
    const reviews = registry.getRatings(String(req.params.name));
    res.json(reviews);
  });

  router.get('/plugins/:name/analytics', (req: AuthenticatedRequest, res: Response) => {
    const since = req.query.since ? Number(req.query.since) : undefined;
    const analytics = registry.getAnalytics(String(req.params.name), since);
    const info = registry.getPluginInfo(String(req.params.name));
    res.json({ ...info, recentEvents: analytics });
  });

  router.post('/events', (req: AuthenticatedRequest, res: Response) => {
    const { pluginId, version, event, success, latencyMs, errorMessage } = req.body;
    if (!pluginId || !event) return res.status(400).json({ error: 'pluginId and event are required' });
    registry.trackEvent({
      pluginId,
      version: version ?? 'unknown',
      event,
      success: success ?? true,
      latencyMs,
      errorMessage,
      timestamp: Date.now(),
    });
    res.json({ status: 'ok' });
  });

  return router;
}
