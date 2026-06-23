import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryBackend } from './backends/InMemoryBackend.js';
import { PluginRegistry } from './marketplace/registry.js';
import { runStaticAnalysis, verifyChecksum, approved } from './marketplace/scanner.js';
import { resolveDependencies } from './marketplace/resolver.js';
import type { PluginPackage, PluginManifest } from './marketplace/types.js';

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: '@test/hello',
    version: '1.0.0',
    description: 'Test plugin',
    author: 'test',
    license: 'MIT',
    timps: {
      version: '>=2.0.0',
      permissions: ['memory:read', 'memory:write'],
      ...overrides.timps,
    },
    ...overrides,
  };
}

function makePackage(manifest: PluginManifest, code = 'const x = 1;'): PluginPackage {
  const payload = Buffer.from(code).toString('base64');
  const checksum = require('crypto').createHash('sha256').update(payload).digest('hex');
  return { manifest, payload, format: 'js', checksum, size: payload.length };
}

describe('Scanner', () => {
  it('approves clean code', () => {
    const results = runStaticAnalysis(Buffer.from('const x = 1;').toString('base64'), makeManifest());
    expect(approved(results)).toBe(true);
  });

  it('rejects eval usage', () => {
    const results = runStaticAnalysis(Buffer.from('eval(userInput)').toString('base64'), makeManifest());
    expect(results.some(r => r.rule === 'eval')).toBe(true);
    expect(approved(results)).toBe(false);
  });

  it('rejects undeclared network access', () => {
    const results = runStaticAnalysis(
      Buffer.from('fetch("https://evil.com")').toString('base64'),
      makeManifest({ timps: { version: '>=2.0.0', permissions: ['memory:read'] } })
    );
    const undeclared = results.find(r => r.rule === 'undeclared-permission');
    expect(undeclared?.passed).toBe(false);
    expect(approved(results)).toBe(false);
  });

  it('rejects oversized payload', () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 'x').toString('base64');
    const results = runStaticAnalysis(big, makeManifest());
    expect(results.some(r => r.rule === 'package-size' && !r.passed)).toBe(true);
  });

  it('checksum verification works', () => {
    const payload = Buffer.from('test').toString('base64');
    const good = require('crypto').createHash('sha256').update(payload).digest('hex');
    const bad = 'bad';
    expect(verifyChecksum(payload, good)).toBe(true);
    expect(verifyChecksum(payload, bad)).toBe(false);
  });
});

describe('Registry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry(new InMemoryBackend());
  });

  it('submits and approves clean plugin', () => {
    const pkg = makePackage(makeManifest());
    const result = registry.submit(pkg);
    expect(result.status).toBe('approved');
    const info = registry.get('@test/hello');
    expect(info).not.toBeNull();
    expect(info!.name).toBe('@test/hello');
    expect(info!.latestVersion).toBe('1.0.0');
  });

  it('rejects plugin with bad checksum', () => {
    const pkg = makePackage(makeManifest());
    pkg.checksum = 'bad';
    const result = registry.submit(pkg);
    expect(result.status).toBe('rejected');
    expect(result.message).toContain('Checksum');
  });

  it('lists approved plugins', () => {
    registry.submit(makePackage(makeManifest({ name: '@test/a', version: '1.0.0' })));
    registry.submit(makePackage(makeManifest({ name: '@test/b', version: '1.0.0' })));
    const list = registry.list();
    expect(list.length).toBe(2);
  });

  it('searches plugins by name and description', () => {
    registry.submit(makePackage(makeManifest({ name: '@test/hello', description: 'A hello world plugin' })));
    registry.submit(makePackage(makeManifest({ name: '@test/bye', description: 'A goodbye plugin' })));
    const results = registry.search('hello');
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe('@test/hello');
  });

  it('tracks downloads on install event', () => {
    registry.submit(makePackage(makeManifest()));
    registry.trackEvent({ pluginId: '@test/hello', version: '1.0.0', event: 'install', success: true, timestamp: Date.now() });
    const info = registry.get('@test/hello');
    expect(info!.totalDownloads).toBe(1);
  });

  it('stores and aggregates ratings', () => {
    registry.submit(makePackage(makeManifest()));
    registry.addRating('@test/hello', 'user1', 5, 'Great!');
    registry.addRating('@test/hello', 'user2', 3, 'OK');
    const reviews = registry.getRatings('@test/hello');
    expect(reviews.length).toBe(2);
    const info = registry.get('@test/hello');
    expect(info!.avgRating).toBe(4);
    expect(info!.reviewCount).toBe(2);
  });
});

describe('Resolver', () => {
  it('resolves simple dependencies', () => {
    const available = new Map([
      ['@timps/utils', ['1.0.0', '1.1.0', '2.0.0']],
      ['@timps/http', ['1.0.0']],
    ]);
    const result = resolveDependencies({ '@timps/utils': '^1.0.0' }, available);
    expect(result.conflicts.length).toBe(0);
    expect(result.flat.get('@timps/utils')).toBe('1.1.0');
  });

  it('detects version conflicts', () => {
    const available = new Map([
      ['@timps/utils', ['1.0.0']],
    ]);
    const result = resolveDependencies({ '@timps/utils': '^2.0.0' }, available);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('handles no dependencies', () => {
    const result = resolveDependencies(undefined, new Map());
    expect(result.flat.size).toBe(0);
    expect(result.conflicts.length).toBe(0);
  });
});
