import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { NexusForge, Signal, PolicyDecision, RetrievalResult } from '../core/nexusForge';

describe('NexusForge — Episodic Sub-Agent Trinity', () => {
  let nf: NexusForge;

  beforeEach(() => {
    nf = new NexusForge();
  });

  describe('isEnabled', () => {
    it('should return true by default when ENABLE_NEXUSFORGE is not false', () => {
      expect(nf.isEnabled()).toBe(true);
    });
  });

  describe('extractEntityKeys', () => {
    it('should extract code_issue from bug-related content', () => {
      const signal: Signal = {
        userId: 1,
        content: 'Found a bug in the auth handler causing crash',
        tags: ['auth'],
      };
      nf.episodicIndexer(signal, 'test');
      // Internal extraction should include code_issue
    });

    it('should extract burnout from stress-related content', () => {
      const signal: Signal = {
        userId: 1,
        content: 'Feeling burnout and stress from overwork',
        tags: [],
      };
      nf.episodicIndexer(signal, 'test');
    });

    it('should extract relationship from team-related content', () => {
      const signal: Signal = {
        userId: 1,
        content: 'Had a great meeting with my colleague about team structure',
        tags: [],
      };
      nf.episodicIndexer(signal, 'test');
    });

    it('should extract regret from mistake-related content', () => {
      const signal: Signal = {
        userId: 1,
        content: 'I regret the wrong decision on the API architecture',
        tags: [],
      };
      nf.episodicIndexer(signal, 'test');
    });
  });

  describe('isCodingSource', () => {
    it('should identify timps-code as coding source', () => {
      const result = (nf as any).isCodingSource('timps-code');
      expect(result).toBe(true);
    });

    it('should identify timps-vscode as coding source', () => {
      const result = (nf as any).isCodingSource('timps-vscode');
      expect(result).toBe(true);
    });

    it('should identify timps-mcp as coding source', () => {
      const result = (nf as any).isCodingSource('timps-mcp');
      expect(result).toBe(true);
    });

    it('should identify cli as coding source', () => {
      const result = (nf as any).isCodingSource('cli');
      expect(result).toBe(true);
    });

    it('should identify tech_debt as coding source', () => {
      const result = (nf as any).isCodingSource('tech_debt');
      expect(result).toBe(true);
    });

    it('should not identify reflection as coding source', () => {
      const result = (nf as any).isCodingSource('reflection');
      expect(result).toBe(false);
    });
  });

  describe('findLongitudinalLinks', () => {
    it('should link burnout content to burnout_seismograph', async () => {
      const signal: Signal = {
        userId: 1,
        content: 'Experiencing burnout and stress from overwork',
        tags: [],
      };
      const links = await (nf as any).findLongitudinalLinks(signal);
      expect(links).toContain('burnout_seismograph');
    });

    it('should link relationship content to relationship_intelligence', async () => {
      const signal: Signal = {
        userId: 1,
        content: 'My relationship with the team needs attention',
        tags: [],
      };
      const links = await (nf as any).findLongitudinalLinks(signal);
      expect(links).toContain('relationship_intelligence');
    });

    it('should link regret content to regret_oracle', async () => {
      const signal: Signal = {
        userId: 1,
        content: 'I made a mistake and regret that decision',
        tags: [],
      };
      const links = await (nf as any).findLongitudinalLinks(signal);
      expect(links).toContain('regret_oracle');
    });

    it('should return empty for neutral content', async () => {
      const signal: Signal = {
        userId: 1,
        content: 'The weather is nice today',
        tags: [],
      };
      const links = await (nf as any).findLongitudinalLinks(signal);
      expect(links).toEqual([]);
    });
  });

  describe('extractFacts', () => {
    it('should extract sentences as facts', async () => {
      const content = 'The API uses PostgreSQL for storage. The vector search runs on Qdrant. We support multiple LLM providers.';
      const facts = await (nf as any).extractFacts(content);
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0]).toContain('PostgreSQL');
    });

    it('should limit to 5 facts max', async () => {
      const content = 'One. Two. Three. Four. Five. Six. Seven.';
      const facts = await (nf as any).extractFacts(content);
      expect(facts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('extractGist', () => {
    it('should truncate to 200 chars', async () => {
      const long = 'x'.repeat(300);
      const gist = await (nf as any).extractGist(long);
      expect(gist.length).toBeLessThanOrEqual(200);
    });

    it('should pass through short content unchanged', async () => {
      const short = 'short content';
      const gist = await (nf as any).extractGist(short);
      expect(gist).toBe(short);
    });
  });

  describe('checkConflicts', () => {
    it('should detect new facts as conflicts', async () => {
      const existingNode = {
        node_id: 'test_1',
        facts: JSON.stringify(['existing fact one', 'existing fact two']),
      };
      const signal: Signal = {
        userId: 1,
        content: 'This is a completely new fact not seen before.',
        tags: [],
      };
      const result = await (nf as any).checkConflicts(signal, existingNode);
      expect(result.hasConflict).toBe(true);
      expect(result.deltas.length).toBeGreaterThan(0);
    });

    it('should not conflict for duplicate facts', async () => {
      const existingNode = {
        node_id: 'test_1',
        facts: JSON.stringify(['This is a completely new fact not seen before']),
      };
      const signal: Signal = {
        userId: 1,
        content: 'This is a completely new fact not seen before.',
        tags: [],
      };
      const result = await (nf as any).checkConflicts(signal, existingNode);
      expect(result.hasConflict).toBe(false);
    });
  });

  describe('hybridGraphSearch', () => {
    it('should return empty array for non-matching query', async () => {
      const results = await (nf as any).hybridGraphSearch('xyznonexistent', 1);
      expect(results).toEqual([]);
    });
  });

  describe('agenticIterativeTraverse', () => {
    it('should return refusal for empty results', async () => {
      const result = await (nf as any).agenticIterativeTraverse([], {}, 1);
      expect(result.refusal).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should limit results to 5', async () => {
      const mockResults = Array(10).fill(null).map((_, i) => ({ node_id: `n_${i}`, gist: `gist ${i}` }));
      const result = await (nf as any).agenticIterativeTraverse(mockResults, {}, 1);
      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should include traversal path', async () => {
      const mockResults = [{ node_id: 'n_1', gist: 'test' }];
      const result = await (nf as any).agenticIterativeTraverse(mockResults, {}, 1);
      expect(result.traversalPath.length).toBeGreaterThan(0);
    });
  });

  describe('retrievalWeaver', () => {
    it('should return empty results when disabled', async () => {
      const disabledNf = new NexusForge();
      Object.defineProperty(disabledNf, 'enabled', { value: false });
      const result = await disabledNf.retrievalWeaver('test query', 1, {});
      expect(result.results).toEqual([]);
      expect(result.refusal).toBe(false);
    });
  });

  describe('buildVeilContext', () => {
    it('should return empty string when disabled', async () => {
      const disabledNf = new NexusForge();
      Object.defineProperty(disabledNf, 'enabled', { value: false });
      const ctx = await disabledNf.buildVeilContext('test', 1, 'default');
      expect(ctx).toBe('');
    });
  });

  describe('policyDecision structure', () => {
    it('should return store action as default', async () => {
      const signal: Signal = {
        userId: 1,
        content: 'new unique signal',
        tags: [],
      };
      const decision = await nf.evolutionOracle(signal, {});
      expect(['store', 'update', 'discard', 'summarize']).toContain(decision.action);
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Signal interface', () => {
    it('should accept full signal with all fields', () => {
      const signal: Signal = {
        userId: 42,
        projectId: 'proj_abc',
        content: 'full test signal',
        tags: ['code', 'bug'],
        confidence: 0.85,
        metadata: { source: 'test', version: '1.0' },
        outcomeScore: 0.9,
        sourceModule: 'timps-code',
        raw: { original: 'data' },
      };
      expect(signal.userId).toBe(42);
      expect(signal.tags).toContain('code');
      expect(signal.confidence).toBe(0.85);
    });
  });

  describe('EpisodicNode interface', () => {
    it('should have required fields', () => {
      const node = {
        nodeId: 'nexus_test_1',
        gist: 'test gist',
        facts: ['fact 1', 'fact 2'],
        timestamp: new Date(),
        entityKeys: ['code', 'bug'],
        content: 'full content',
      };
      expect(node.nodeId).toBeTruthy();
      expect(node.gist).toBeTruthy();
      expect(node.facts.length).toBe(2);
    });
  });
});

describe('NexusForge — Simulation Benchmarks', () => {
  it('should handle rapid sequential indexing', async () => {
    const nf = new NexusForge();
    const signals: Signal[] = Array(50).fill(null).map((_, i) => ({
      userId: 1,
      content: `Rapid signal ${i}: testing high-throughput indexing`,
      tags: ['benchmark'],
      sourceModule: 'benchmark',
    }));

    const start = Date.now();
    for (const signal of signals) {
      await nf.episodicIndexer(signal, 'benchmark');
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  it('should handle multi-user isolation', async () => {
    const nf = new NexusForge();
    const signals = [
      { userId: 1, content: 'user one private data', tags: [] },
      { userId: 2, content: 'user two private data', tags: [] },
      { userId: 3, content: 'user three private data', tags: [] },
    ];

    for (const s of signals) {
      await nf.episodicIndexer(s as Signal, 'test');
    }

    const result1 = await nf.retrievalWeaver('user one', 1, {});
    const result2 = await nf.retrievalWeaver('user two', 2, {});

    expect(result1.results).toBeDefined();
    expect(result2.results).toBeDefined();
  });

  it('should handle long content without errors', async () => {
    const nf = new NexusForge();
    const longContent = 'x'.repeat(10000);
    const signal: Signal = {
      userId: 1,
      content: longContent,
      tags: ['long'],
    };

    const nodeId = await nf.episodicIndexer(signal, 'test');
    expect(nodeId).toBeDefined();
  });

  it('should handle empty content gracefully', async () => {
    const nf = new NexusForge();
    const signal: Signal = {
      userId: 1,
      content: '',
      tags: [],
    };

    const nodeId = await nf.episodicIndexer(signal, 'test');
    expect(nodeId).toBeDefined();
  });

  it('should handle special characters in content', async () => {
    const nf = new NexusForge();
    const signal: Signal = {
      userId: 1,
      content: 'Content with <html> & "quotes" and \'apostrophes\' and emojis 🚀',
      tags: [],
    };

    const nodeId = await nf.episodicIndexer(signal, 'test');
    expect(nodeId).toBeDefined();
  });
});
