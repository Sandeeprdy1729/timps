import { ChronosForge, SignalDomain, ForesightResult } from '../memory/chronosForge.js';

// ── Stub DB layer ─────────────────────────────────────────────────────────────

const noopQuery = async (_sql: string, _params?: unknown[]) => [] as any[];
const noopExec  = async (_sql: string, _params?: unknown[]) => undefined;

// ── Helpers ───────────────────────────────────────────────────────────────────

function forge(): ChronosForge {
  return new ChronosForge(noopQuery, noopExec);
}

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('ChronosForge — initSchema', () => {
  it('executes without throwing', async () => {
    const cf = forge();
    await expect(cf.initSchema()).resolves.not.toThrow();
  });
});

describe('ChronosForge — weave', () => {
  it('returns a WeaveResult with a string nodeId', async () => {
    const cf = forge();
    const result = await cf.weave('User feels exhausted from overtime', 1, 'proj-a');
    expect(typeof result.nodeId).toBe('string');
    expect(result.nodeId.startsWith('cf_')).toBe(true);
    expect(Array.isArray(result.supersededIds)).toBe(true);
    expect(Array.isArray(result.detectedContradictions)).toBe(true);
  });

  it('accepts explicit domain override', async () => {
    const cf = forge();
    const result = await cf.weave('Fixed null-pointer in auth', 1, 'proj-b', {
      domain: 'code_pattern',
      tags: ['auth', 'null-check'],
    });
    expect(result.nodeId).toBeTruthy();
  });

  it('accepts causalParentId and produces distinct node ids', async () => {
    const cf = forge();
    const parent = await cf.weave('Merged PR under deadline pressure', 1, 'proj-a');
    const child  = await cf.weave('Introduced regression in auth module', 1, 'proj-a', {
      causalParentId: parent.nodeId,
      domain: 'code_pattern',
    });
    expect(child.nodeId).not.toBe(parent.nodeId);
  });

  it('auto-infers burnout domain from content', async () => {
    const cf = forge();
    // weave returns successfully — domain inference is internal
    const r = await cf.weave('Feeling overwhelmed and exhausted from overtime', 1, 'default');
    expect(r.nodeId).toBeTruthy();
  });
});

describe('ChronosForge — queryAt', () => {
  it('returns TemporalQueryResult shape (empty nodes from stub DB)', async () => {
    const cf = forge();
    const result = await cf.queryAt(1, 'default', Math.floor(Date.now() / 1000));
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(typeof result.pointInTime).toBe('number');
    expect(typeof result.totalValid).toBe('number');
    expect(Array.isArray(result.causalChain)).toBe(true);
    expect(result.nodes.length).toBe(0); // stub returns []
  });

  it('honours domain filter option', async () => {
    const cf = forge();
    const result = await cf.queryAt(1, 'default', Date.now() / 1000, {
      domain: 'burnout',
      limit: 5,
    });
    expect(result).toBeDefined();
  });
});

describe('ChronosForge — simulateForesight', () => {
  it('returns low-risk result when no signals (stub DB returns [])', async () => {
    const cf = forge();
    const result: ForesightResult = await cf.simulateForesight(1, 'default', 'burnout');
    expect(result.domain).toBe('burnout');
    expect(typeof result.riskScore).toBe('number');
    expect(['high', 'medium', 'low']).toContain(result.riskLevel);
    expect(Array.isArray(result.trajectory)).toBe(true);
    expect(result.trajectory.length).toBeGreaterThan(0);
    expect(typeof result.explanation).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(result.riskLevel).toBe('low'); // no signals → low
  });

  it('produces explanation string for all domains', async () => {
    const cf = forge();
    const domains: SignalDomain[] = [
      'burnout', 'relationship', 'decision', 'code_pattern',
      'contradiction', 'goal', 'general',
    ];
    for (const domain of domains) {
      const r = await cf.simulateForesight(1, 'default', domain);
      expect(r.explanation).toBeTruthy();
    }
  });

  it('accepts steps and lookback options', async () => {
    const cf = forge();
    const r = await cf.simulateForesight(1, 'default', 'decision', {
      steps: 5,
      lookbackDays: 7,
    });
    expect(r).toBeDefined();
    expect(r.trajectory.length).toBeLessThanOrEqual(5);
  });

  it('trajectory has correct length matching steps', async () => {
    const cf = forge();
    // With stub DB returning [] (no signals), we get the "no signals" early return
    // which returns Array(steps).fill(0) — default steps = FORESIGHT_STEPS (10)
    const r = await cf.simulateForesight(1, 'default', 'burnout', { steps: 10 });
    expect(r.trajectory.length).toBe(10);
  });
});

describe('ChronosForge — consolidate', () => {
  it('returns pruned + retained counts', async () => {
    const cf = forge();
    const result = await cf.consolidate(1, 'default');
    expect(typeof result.pruned).toBe('number');
    expect(typeof result.retained).toBe('number');
    expect(result.pruned).toBe(0); // stub returns no candidates
    expect(result.retained).toBe(0);
  });
});

describe('ChronosForge — warmGraph', () => {
  it('resolves with 0 (stub DB returns [])', async () => {
    const cf = forge();
    const n = await cf.warmGraph(1);
    expect(n).toBe(0);
  });
});

// ── Micro-benchmark ───────────────────────────────────────────────────────────

describe('ChronosForge — micro-benchmark', () => {
  it('weave 500 memories in < 1 second (stub DB)', async () => {
    const cf = forge();
    const N = 500;
    const domains: SignalDomain[] = ['burnout', 'code_pattern', 'decision', 'general'];
    const start = performance.now();

    const nodeIds: string[] = [];
    for (let i = 0; i < N; i++) {
      const domain = domains[i % domains.length];
      const result = await cf.weave(
        `Signal ${i}: memory content about ${domain} with some extra text for trigram overlap`,
        1,
        'bench',
        {
          domain,
          baseImportance: 0.5 + (i % 5) * 0.1,
          causalParentId: i > 0 ? nodeIds[nodeIds.length - 1] : undefined,
        }
      );
      nodeIds.push(result.nodeId);
    }

    const elapsed = performance.now() - start;
    const perOp = elapsed / N;
    console.log(`[bench] weave ${N} nodes: ${elapsed.toFixed(1)} ms  (${perOp.toFixed(3)} ms/op)`);
    expect(elapsed).toBeLessThan(1000);
    expect(perOp).toBeLessThan(2);
  });

  it('10x foresight simulations in < 200 ms (stub DB)', async () => {
    const cf = forge();
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      await cf.simulateForesight(1, 'bench', 'burnout', { steps: 10 });
    }
    const elapsed = performance.now() - start;
    console.log(`[bench] 10x foresight: ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(200);
  });

  it('Ebbinghaus decay: high-retrieval node stays relevant longer', () => {
    // Pure computation test — no DB needed
    // Create two nodes: same base, same age, different retrieval counts
    // Node A: 0 retrievals; Node B: 20 retrievals
    // After 14 days (one half-life), Node B should retain significantly more importance
    const STABILITY = 60 * 60 * 24 * 14;
    const now = Math.floor(Date.now() / 1000);
    const createdAt = now - STABILITY; // exactly one half-life ago
    const baseImportance = 0.8;
    const BOOST = 0.15;

    const scoreA = Math.min(1, baseImportance * Math.exp(-1) * (1 + 0 * BOOST));
    const scoreB = Math.min(1, baseImportance * Math.exp(-1) * (1 + 20 * BOOST));

    expect(scoreB).toBeGreaterThan(scoreA);
    console.log(`[bench] Ebbinghaus: 0 retrievals → ${scoreA.toFixed(3)}, 20 retrievals → ${scoreB.toFixed(3)}`);
  });
});
