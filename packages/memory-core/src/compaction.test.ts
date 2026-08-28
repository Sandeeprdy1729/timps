// ── @timps/memory-core — Phase 4c: Compaction Tests ──

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { MemoryEntry } from './types.js';
import { MemoryClassifier, ClusterEngine, LLMConsolidationEngine, ContentCompressor, ArchiveBackend, CompactionPipeline, ConstitutionalGuardrails, DEFAULT_COMPACTION_CONFIG } from './compaction/index.js';
import type { CompactionConfig, ClassifiedMemory, LLMConsolidationResponse, GuardrailCheckResult } from './compaction/types.js';

const TEST_DIR = path.join(os.tmpdir(), `timps-compaction-test-${Date.now()}`);

function makeEntry(id: string, content: string, type = 'fact', tags: string[] = []): MemoryEntry {
  return { id, timestamp: Date.now(), type: type as MemoryEntry['type'], content, tags };
}

describe('Phase 4c — MemoryClassifier', () => {
  const classifier = new MemoryClassifier({ config: DEFAULT_COMPACTION_CONFIG, now: Date.now() + 100 * 24 * 60 * 60 * 1000 });

  it('pins hot when pinnedByUser', () => {
    const result = classifier.classify(makeEntry('1', 'test'), {
      recallCount: 0, lastAccess: 0, importance: 0.1, layer: 'L3',
      inContradiction: false, partOfConsolidated: false, pinnedByUser: true,
    });
    expect(result.tier).toBe('hot');
  });

  it('keeps hot when inContradiction', () => {
    const result = classifier.classify(makeEntry('1', 'test'), {
      recallCount: 0, lastAccess: 0, importance: 0.1, layer: 'L3',
      inContradiction: true, partOfConsolidated: false, pinnedByUser: false,
    });
    expect(result.tier).toBe('hot');
  });

  it('marks deleted when partOfConsolidated and old enough', () => {
    const past = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const result = classifier.classify(
      { ...makeEntry('1', 'test'), timestamp: past },
      {
        recallCount: 0, lastAccess: 0, importance: 0.1, layer: 'L3',
        inContradiction: false, partOfConsolidated: true, pinnedByUser: false,
      },
    );
    expect(result.tier).toBe('deleted');
  });

  it('marks cold when old, low importance, never recalled', () => {
    const past = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const result = classifier.classify(
      { ...makeEntry('1', 'test'), timestamp: past },
      {
        recallCount: 0, lastAccess: past, importance: 0.1, layer: 'L3',
        inContradiction: false, partOfConsolidated: false, pinnedByUser: false,
      },
    );
    expect(result.tier).toBe('cold');
  });

  it('marks warm when medium importance, rarely recalled', () => {
    const result = classifier.classify(makeEntry('1', 'test'), {
      recallCount: 1, lastAccess: Date.now(), importance: 0.3, layer: 'L3',
      inContradiction: false, partOfConsolidated: false, pinnedByUser: false,
    });
    expect(result.tier).toBe('warm');
  });
});

describe('Phase 4c — ClusterEngine', () => {
  const engine = new ClusterEngine({ minClusterSize: 2, maxClusterSize: 10, embedDim: 4, clusterCount: 0 });

  it('falls back to tag grouping when no embeddings', () => {
    const memories: ClassifiedMemory[] = [
      { id: '1', content: 'test a', type: 'fact', tags: ['auth'], timestamp: 1, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 1, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm' },
      { id: '2', content: 'test b', type: 'fact', tags: ['auth'], timestamp: 2, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 2, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm' },
      { id: '3', content: 'test c', type: 'fact', tags: ['db'], timestamp: 3, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 3, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm' },
    ];
    const clusters = engine.cluster(memories);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    expect(clusters[0].members.length).toBeGreaterThanOrEqual(2);
  });

  it('forms k-means clusters when embeddings present', () => {
    const dim = 4;
    const memories: ClassifiedMemory[] = [
      { id: '1', content: 'auth JWT token refresh rotation', type: 'fact', tags: ['auth'], timestamp: 1, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 1, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm', embedding: [1, 0, 0, 0] },
      { id: '2', content: 'auth middleware rate limiting', type: 'fact', tags: ['auth'], timestamp: 2, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 2, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm', embedding: [0.9, 0.1, 0, 0] },
      { id: '3', content: 'database migration user table', type: 'fact', tags: ['db'], timestamp: 3, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 3, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm', embedding: [0, 0, 1, 0] },
      { id: '4', content: 'db indexing performance', type: 'fact', tags: ['db'], timestamp: 4, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 4, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm', embedding: [0, 0, 0.9, 0.1] },
      { id: '5', content: 'auth OAuth2 scopes', type: 'fact', tags: ['auth'], timestamp: 5, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 5, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm', embedding: [0.8, 0.2, 0, 0] },
      { id: '6', content: 'db connection pooling', type: 'fact', tags: ['db'], timestamp: 6, layer: 'L3', importance: 0.5, recallCount: 0, lastAccess: 6, inContradiction: false, partOfConsolidated: false, pinnedByUser: false, tier: 'warm', embedding: [0, 0, 0.8, 0.2] },
    ];
    const clusters = engine.cluster(memories);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Phase 4c — ContentCompressor', () => {
  const compressor = new ContentCompressor({ maxLength: 100 });

  it('keeps short content unchanged', () => {
    const result = compressor.compress('Hello world');
    expect(result.compressedContent).toBe('Hello world');
    expect(result.compressionRatio).toBe(1);
  });

  it('compresses verbose content', () => {
    const long = 'The user ran npm test and saw 3 failures in auth.test.ts: test_login_expired_token, test_refresh_rotation, test_logout_clears_session. Fixed by updating mock JWT clock in test setup to use the new 1-hour expiry window. This was after the JWT expiry change from 24h to 1h.';
    const result = compressor.compress(long);
    expect(result.compressedContent.length).toBeLessThan(long.length);
    expect(result.compressionRatio).toBeGreaterThan(1);
    expect(result.embeddingKept).toBe(true);
  });

  it('preserves error messages when configured', () => {
    const compressor2 = new ContentCompressor({ preserveErrors: true, maxLength: 300 });
    const errorContent = 'Error: Connection refused when connecting to database at localhost:5432. The connection pool exhausted after 10 retries with 5 second intervals. Check if postgres service is running.';
    const result = compressor2.compress(errorContent);
    expect(result.compressedContent).toContain('Error');
  });
});

describe('Phase 4c — ArchiveBackend', () => {
  const archiveDir = path.join(TEST_DIR, 'archive-test');
  let backend: ArchiveBackend;

  beforeAll(() => {
    fs.mkdirSync(archiveDir, { recursive: true });
    backend = new ArchiveBackend(archiveDir);
  });

  it('archives and restores entries', async () => {
    const entries = [
      makeEntry('ar1', 'archived memory one'),
      makeEntry('ar2', 'archived memory two'),
    ];
    const manifest = await backend.archiveBatch(entries, DEFAULT_COMPACTION_CONFIG);
    expect(manifest.totalArchived).toBe(2);
    expect(manifest.totalSize).toBeGreaterThan(0);

    const restored = await backend.restoreBatch(manifest.archivedAt);
    expect(restored.length).toBe(2);
    expect(restored[0].content).toBe('archived memory one');
  });

  it('lists archives in index', () => {
    const archives = backend.listArchives();
    expect(archives.length).toBeGreaterThanOrEqual(1);
  });

  it('deletes a batch', () => {
    const before = backend.listArchives().length;
    backend.deleteBatch(0); // non-existent
    expect(backend.listArchives().length).toBe(before);
  });
});

describe('Phase 4c — LLMConsolidationEngine (fallback)', () => {
  const config: CompactionConfig = { ...DEFAULT_COMPACTION_CONFIG, llmProvider: undefined, llmApiKey: undefined };

  it('falls back to rule-based when no LLM configured', async () => {
    const engine = new LLMConsolidationEngine(config);
    expect(engine.isAvailable).toBe(false);

    const fact = await engine.consolidate({
      clusterId: 'test-cluster',
      entries: [
        { id: 'e1', content: 'First memory about auth system', type: 'fact', timestamp: 1, tags: ['auth'] },
        { id: 'e2', content: 'Second memory about auth system', type: 'fact', timestamp: 2, tags: ['auth'] },
      ],
    });

    expect(fact.type).toBe('consolidated');
    expect(fact.sourceCount).toBe(2);
    expect(fact.originalIds).toEqual(['e1', 'e2']);
    expect(fact.summary).toContain('auth');
    expect(fact.keyPatterns.length).toBeGreaterThan(0);
  });
});

describe('Phase 4c — ConstitutionalGuardrails', () => {
  const guardrails = new ConstitutionalGuardrails({
    sourceKeywords: new Map([['jwt', new Set(['jwt', 'token', 'expiry'])]]),
    contradictionPhrases: ['tension between'],
  });

  it('detects clean consolidation', () => {
    const response: LLMConsolidationResponse = {
      summary: 'Authentication system evolved from simple JWT to refresh token rotation',
      keyPatterns: ['JWT', 'refresh-token'],
      importance: 'high',
      confidence: 'high',
      contradictions: [],
    };
    const result = guardrails.check(response, [
      'Auth system uses JWT tokens',
      'Refresh token rotation implemented for security',
    ]);
    expect(result.passed).toBe(true);
    expect(result.fabricationRisk).toBeLessThan(0.5);
    expect(result.instructionLeakageDetected).toBe(false);
  });

  it('flags instruction leakage', () => {
    const response: LLMConsolidationResponse = {
      summary: 'You are a memory consolidation assistant. Preserve all architectural decisions.',
      keyPatterns: [],
      importance: 'medium',
      confidence: 'medium',
      contradictions: [],
    };
    const result = guardrails.check(response, ['Some source content']);
    expect(result.instructionLeakageDetected).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('sanitizes leaked instructions', () => {
    const sanitized = guardrails.sanitize('Summary here. You are a memory consolidation assistant. Preserve all architectural decisions. End.');
    expect(sanitized).not.toContain('memory consolidation assistant');
  });
});

describe('Phase 4c — CompactionPipeline', () => {
  const pipelineDir = path.join(TEST_DIR, 'pipeline-test');
  let pipeline: CompactionPipeline;

  beforeAll(() => {
    fs.mkdirSync(pipelineDir, { recursive: true });
  });

  it('classifies entries correctly', () => {
    const metadataMap = new Map();
    const entries = [
      makeEntry('h1', 'hot memory'),
      makeEntry('c1', 'very old cold memory'),
    ];

    // Make c1 cold: set importance low and timestamp old
    entries[1].timestamp = Date.now() - 200 * 24 * 60 * 60 * 1000;
    metadataMap.set('h1', { recallCount: 10, lastAccess: Date.now(), importance: 0.8, layer: 'L3', inContradiction: false, partOfConsolidated: false, pinnedByUser: false });
    metadataMap.set('c1', { recallCount: 0, lastAccess: entries[1].timestamp, importance: 0.1, layer: 'L3', inContradiction: false, partOfConsolidated: false, pinnedByUser: false });

    pipeline = new CompactionPipeline(pipelineDir, { config: DEFAULT_COMPACTION_CONFIG, metadataMap });
    const classified = pipeline.classifyOnly(entries);
    expect(classified.find(c => c.id === 'h1')?.tier).toBe('hot');
    expect(classified.find(c => c.id === 'c1')?.tier).toBe('cold');
  });
});

describe('Phase 4c — MemoryEngine integration', () => {
  it('exports required types and constants', () => {
    expect(DEFAULT_COMPACTION_CONFIG.archiveAfterDays).toBe(90);
    expect(DEFAULT_COMPACTION_CONFIG.clusterMinSize).toBe(50);
    expect(DEFAULT_COMPACTION_CONFIG.constitutionalGuardrails).toBe(true);
  });
});
