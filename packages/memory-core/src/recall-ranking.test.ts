// ── @timps/memory-core — recall ranking regression tests ──
// recall() fed raw (unbounded) BM25 scores into ConfidenceCalibrator, which
// expects a 0–1 similarity. Every candidate clamped to confidence 1, so the
// final order came from false-memory-risk noise and the best match often
// ranked last (benchmark R@5 was 15%).

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { MemoryEngine } from './MemoryEngine.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'recall-ranking-test-'));
}

const CORPUS = [
  'Authentication uses JWT tokens stored in httpOnly cookies',
  'API documentation is generated from OpenAPI specs in /api/openapi.yaml',
  'Customer support is handled by Intercom',
  'Sprint planning is bi-weekly on Mondays, retros on Fridays',
  'Deployment uses Docker Compose on a single VPS',
  'API rate limiting is implemented via Redis counter with sliding window',
];

describe('MemoryEngine.recall ranking', () => {
  it('ranks the strongest keyword match first', async () => {
    const engine = new MemoryEngine(tmpDir());
    for (const content of CORPUS) engine.store({ content, type: 'fact', tags: [] });

    const auth = await engine.recall('How do we handle authentication?', { limit: 5 });
    expect(auth[0]?.content).toContain('JWT');

    const rate = await engine.recall('What rate limiting approach did we pick?', { limit: 5 });
    expect(rate[0]?.content).toContain('Redis');
  });

  it('produces distinct, descending scores rather than a flat tie', async () => {
    const engine = new MemoryEngine(tmpDir());
    for (const content of CORPUS) engine.store({ content, type: 'fact', tags: [] });

    const results = await engine.recall('How do we handle authentication?', { limit: 5 });
    const scores = results.map(r => r.score ?? 0);
    expect(scores[0]).toBeGreaterThan(scores[scores.length - 1]);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
    expect(results.every(r => r.calibratedConfidence < 1)).toBe(true);
  });
});
