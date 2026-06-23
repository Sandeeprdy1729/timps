import { createHash, randomBytes } from 'node:crypto';
import type { StorageBackend } from '../backends/types.js';
import type { PluginInfo, PluginRelease, PluginPackage, PluginManifest, SubmissionResult, RatingReview, AnalyticsEvent } from './types.js';
import { runStaticAnalysis, verifyChecksum, approved } from './scanner.js';

const PLUGIN_KEY = 'marketplace:plugins';
const REVIEW_KEY = 'marketplace:reviews';
const ANALYTICS_KEY = 'marketplace:analytics';

function pluginKey(name: string): string { return `${PLUGIN_KEY}:${name}`; }

export class PluginRegistry {
  constructor(private backend: StorageBackend) {}

  list(): PluginInfo[] {
    const keys = this.backend.list(`${PLUGIN_KEY}:`) as string[];
    return keys.map(k => this.backend.read(k) as PluginInfo).filter(Boolean);
  }

  get(name: string): PluginInfo | null {
    return this.backend.read(pluginKey(name)) as PluginInfo | null;
  }

  search(query: string): PluginInfo[] {
    const q = query.toLowerCase();
    return this.list().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  submit(pkg: PluginPackage): SubmissionResult {
    if (!verifyChecksum(pkg.payload, pkg.checksum)) {
      return { id: '', status: 'rejected', scanResults: [], message: 'Checksum mismatch' };
    }

    const scanResults = runStaticAnalysis(pkg.payload, pkg.manifest);
    const isApproved = approved(scanResults);
    const status = isApproved ? 'approved' : 'rejected';

    const releaseId = randomBytes(6).toString('hex');
    const release: PluginRelease = {
      id: releaseId,
      name: pkg.manifest.name,
      version: pkg.manifest.version,
      manifest: pkg.manifest,
      format: pkg.format,
      checksum: pkg.checksum,
      size: pkg.size,
      downloads: 0,
      publishedAt: Date.now(),
      status: isApproved ? 'approved' : 'pending_review',
      reviewNotes: isApproved ? 'Auto-approved by static analysis' : 'Flagged by static analysis',
    };

    if (isApproved) {
      const existing = this.get(pkg.manifest.name);
      if (existing) {
        existing.releases.push(release);
        existing.latestVersion = pkg.manifest.version;
        existing.updatedAt = Date.now();
        this.backend.write(pluginKey(pkg.manifest.name), existing);
      } else {
        const info: PluginInfo = {
          id: randomBytes(6).toString('hex'),
          name: pkg.manifest.name,
          description: pkg.manifest.description,
          author: pkg.manifest.author,
          license: pkg.manifest.license,
          tags: [],
          permissions: pkg.manifest.timps.permissions,
          releases: [release],
          latestVersion: pkg.manifest.version,
          totalDownloads: 0,
          avgRating: 0,
          reviewCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.backend.write(pluginKey(pkg.manifest.name), info);
      }
    }

    return {
      id: releaseId,
      status,
      scanResults,
      message: isApproved ? 'Plugin approved and published' : 'Plugin requires review',
    };
  }

  addRating(pluginName: string, userId: string, rating: number, review?: string): RatingReview {
    const entry: RatingReview = {
      id: randomBytes(6).toString('hex'),
      pluginId: pluginName,
      userId,
      rating: Math.max(1, Math.min(5, rating)),
      review: review?.slice(0, 2000),
      createdAt: Date.now(),
    };
    const existing = this.backend.read(`${REVIEW_KEY}:${pluginName}`) as RatingReview[] ?? [];
    existing.push(entry);
    this.backend.write(`${REVIEW_KEY}:${pluginName}`, existing);

    const plugin = this.get(pluginName);
    if (plugin) {
      const ratings = existing.map(r => r.rating);
      plugin.avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      plugin.reviewCount = ratings.length;
      plugin.updatedAt = Date.now();
      this.backend.write(pluginKey(pluginName), plugin);
    }
    return entry;
  }

  getRatings(pluginName: string): RatingReview[] {
    return this.backend.read(`${REVIEW_KEY}:${pluginName}`) as RatingReview[] ?? [];
  }

  trackEvent(event: AnalyticsEvent): void {
    const key = `${ANALYTICS_KEY}:${event.pluginId}`;
    const events = this.backend.read(key) as AnalyticsEvent[] ?? [];
    events.push(event);
    if (events.length > 10000) events.splice(0, events.length - 10000);
    this.backend.write(key, events);

    const plugin = this.get(event.pluginId);
    if (plugin && event.event === 'install') {
      plugin.totalDownloads++;
      this.backend.write(pluginKey(event.pluginId), plugin);
    }
  }

  getAnalytics(pluginId: string, since?: number): AnalyticsEvent[] {
    const events = this.backend.read(`${ANALYTICS_KEY}:${pluginId}`) as AnalyticsEvent[] ?? [];
    if (since) return events.filter(e => e.timestamp >= since);
    return events.slice(-1000);
  }

  getPluginInfo(name: string): { info: PluginInfo | null; downloads: number; errorRate: number } {
    const info = this.get(name);
    if (!info) return { info: null, downloads: 0, errorRate: 0 };
    const events = this.getAnalytics(name);
    const recent = events.filter(e => e.timestamp > Date.now() - 86400000 * 7);
    const errors = recent.filter(e => !e.success);
    return {
      info,
      downloads: info.totalDownloads,
      errorRate: recent.length > 0 ? errors.length / recent.length : 0,
    };
  }
}
