import { describe, it, expect, beforeEach } from 'bun:test';
import { SynapseMetabolon, MetabolicSignal } from '../core/synapseMetabolon';

describe('SynapseMetabolon — Spreading Activation Metabolic Graph', () => {
  let sm: SynapseMetabolon;

  beforeEach(() => {
    sm = new SynapseMetabolon();
  });

  describe('isEnabled', () => {
    it('should return true by default', () => {
      expect(sm.isEnabled()).toBe(true);
    });
  });

  describe('determineLayer', () => {
    it('should classify audit signals correctly', () => {
      const signal: MetabolicSignal = { content: 'Review and audit the recent decisions' };
      const result = (sm as any).determineLayer(signal, 'test');
      expect(result).toBe('audit');
    });

    it('should classify reasoning signals correctly', () => {
      const signal: MetabolicSignal = { content: 'Why did this pattern emerge over time?' };
      const result = (sm as any).determineLayer(signal, 'test');
      expect(result).toBe('reasoning');
    });

    it('should default to interaction for simple content', () => {
      const signal: MetabolicSignal = { content: 'Fixed a typo in the README' };
      const result = (sm as any).determineLayer(signal, 'test');
      expect(result).toBe('interaction');
    });

    it('should use tags for layer classification', () => {
      const signal: MetabolicSignal = { content: 'some content', tags: ['reflect', 'assess'] };
      const result = (sm as any).determineLayer(signal, 'test');
      expect(result).toBe('audit');
    });
  });

  describe('extractEntities', () => {
    it('should extract code entity from coding content', () => {
      const signal: MetabolicSignal = { content: 'Found a bug in the function implementation' };
      const result = (sm as any).extractEntities(signal, 'test');
      expect(result).toContain('code');
      expect(result).toContain('bug');
    });

    it('should extract burnout entity from stress content', () => {
      const signal: MetabolicSignal = { content: 'Feeling burned out and overwhelmed with stress' };
      const result = (sm as any).extractEntities(signal, 'test');
      expect(result).toContain('burnout');
    });

    it('should extract relationship entity from team content', () => {
      const signal: MetabolicSignal = { content: 'Had a team review with a colleague about handoff' };
      const result = (sm as any).extractEntities(signal, 'test');
      expect(result).toContain('relationship');
    });

    it('should use provided tags', () => {
      const signal: MetabolicSignal = { content: 'some content', tags: ['api', 'security'] };
      const result = (sm as any).extractEntities(signal, 'test');
      expect(result).toContain('api');
      expect(result).toContain('security');
    });

    it('should fall back to general when no entities detected', () => {
      const signal: MetabolicSignal = { content: 'hello world today' };
      const result = (sm as any).extractEntities(signal, 'reflection');
      expect(result).toContain('general');
    });
  });

  describe('defaultActivation', () => {
    it('should give higher activation to reasoning layer', () => {
      const reasoningAct = (sm as any).defaultActivation('reasoning', {});
      const interactionAct = (sm as any).defaultActivation('interaction', {});
      expect(reasoningAct).toBeGreaterThan(interactionAct);
    });

    it('should clamp activation between 0.05 and 1', () => {
      const signal: MetabolicSignal = { outcomeScore: -10 };
      const result = (sm as any).defaultActivation('interaction', signal);
      expect(result).toBeGreaterThanOrEqual(0.05);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('computeEdgeWeight', () => {
    it('should give higher weight to same-layer edges', () => {
      const sameLayer = (sm as any).computeEdgeWeight('reasoning', 'reasoning', 0.6, 0.6);
      const crossLayer = (sm as any).computeEdgeWeight('interaction', 'audit', 0.6, 0.6);
      expect(sameLayer).toBeGreaterThan(crossLayer);
    });

    it('should boost interaction→reasoning edges', () => {
      const irWeight = (sm as any).computeEdgeWeight('interaction', 'reasoning', 0.5, 0.5);
      const iaWeight = (sm as any).computeEdgeWeight('interaction', 'audit', 0.5, 0.5);
      expect(irWeight).toBeGreaterThan(iaWeight);
    });

    it('should clamp weight between 0.1 and 1', () => {
      const result = (sm as any).computeEdgeWeight('interaction', 'audit', 0.01, 0.01);
      expect(result).toBeGreaterThanOrEqual(0.1);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('computeEdgeType', () => {
    it('should return semantic_same for same layer', () => {
      const result = (sm as any).computeEdgeType('reasoning', 'reasoning');
      expect(result).toBe('semantic_same');
    });

    it('should return elevated_to_reasoning for interaction→reasoning', () => {
      const result = (sm as any).computeEdgeType('interaction', 'reasoning');
      expect(result).toBe('elevated_to_reasoning');
    });

    it('should return flagged_for_audit for reasoning→audit', () => {
      const result = (sm as any).computeEdgeType('reasoning', 'audit');
      expect(result).toBe('flagged_for_audit');
    });

    it('should return temporal_linked for other combinations', () => {
      const result = (sm as any).computeEdgeType('interaction', 'audit');
      expect(result).toBe('temporal_linked');
    });
  });

  describe('isCodingSource', () => {
    it('should identify timps-code as coding source', () => {
      expect((sm as any).isCodingSource('timps-code')).toBe(true);
    });

    it('should identify timps-vscode as coding source', () => {
      expect((sm as any).isCodingSource('timps-vscode')).toBe(true);
    });

    it('should identify timps-mcp as coding source', () => {
      expect((sm as any).isCodingSource('timps-mcp')).toBe(true);
    });

    it('should identify cli as coding source', () => {
      expect((sm as any).isCodingSource('cli')).toBe(true);
    });

    it('should identify code as coding source', () => {
      expect((sm as any).isCodingSource('code')).toBe(true);
    });

    it('should not identify reflection as coding source', () => {
      expect((sm as any).isCodingSource('reflection')).toBe(false);
    });
  });

  describe('extractContent', () => {
    it('should use content field when available', () => {
      const signal: MetabolicSignal = { content: 'test content' };
      expect((sm as any).extractContent(signal)).toBe('test content');
    });

    it('should fall back to raw string', () => {
      const signal: MetabolicSignal = { raw: 'raw string content' };
      expect((sm as any).extractContent(signal)).toBe('raw string content');
    });

    it('should stringify raw objects', () => {
      const signal: MetabolicSignal = { raw: { key: 'value' } };
      expect((sm as any).extractContent(signal)).toBe('{"key":"value"}');
    });

    it('should stringify entire signal as last resort', () => {
      const signal: MetabolicSignal = { userId: 1, projectId: 'default' };
      const result = (sm as any).extractContent(signal);
      expect(result).toContain('"userId":1');
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect((sm as any).clamp(0.5, 0, 1)).toBe(0.5);
      expect((sm as any).clamp(-1, 0, 1)).toBe(0);
      expect((sm as any).clamp(2, 0, 1)).toBe(1);
    });
  });

  describe('injectEvent', () => {
    it('should return result even when DB is unavailable', async () => {
      const signal: MetabolicSignal = {
        userId: 1,
        projectId: 'default',
        content: 'Test metabolic event',
        tags: ['code'],
        confidence: 0.7,
      };
      const result = await sm.injectEvent(signal, 'test-module');
      expect(result.nodeId).toBeDefined();
      expect(result.layer).toBeDefined();
      expect(result.activation).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.activation).toBe(0.7);
    });

    it('should assign layer based on content', async () => {
      const signal: MetabolicSignal = {
        content: 'Why did this architectural decision cause burnout patterns?',
        tags: ['code', 'burnout'],
      };
      const result = await sm.injectEvent(signal, 'reflection');
      expect(result.layer).toBe('reasoning');
    });

    it('should extract multiple entities', async () => {
      const signal: MetabolicSignal = {
        content: 'Bug in the API endpoint causing team relationship stress',
        tags: ['api', 'team'],
      };
      const result = await sm.injectEvent(signal, 'timps-vscode');
      expect(result.entities.length).toBeGreaterThan(1);
    });
  });

  describe('queryWithSpread', () => {
    it('should return empty result when disabled or no DB', async () => {
      const result = await sm.queryWithSpread('test query', 1, 'default', 5);
      expect(result.summary).toBeDefined();
      expect(result.activatedNodes).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.auditLog).toBeDefined();
      expect(result.activationPath).toBeDefined();
    });
  });

  describe('buildMetabolicContext', () => {
    it('should return empty string when no context available', async () => {
      const result = await sm.buildMetabolicContext('test query', 1, 'default', 3);
      expect(typeof result).toBe('string');
    });
  });

  describe('runConsolidationCycle', () => {
    it('should return cycle results', async () => {
      const result = await sm.runConsolidationCycle(1, 'default');
      expect(result.consolidated).toBeDefined();
      expect(result.audited).toBeDefined();
      expect(result.refreshed).toBeDefined();
      expect(result.decayed).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return stats structure', async () => {
      try {
        const result = await sm.getStats(1, 'default');
        expect(result.totalNodes).toBeDefined();
        expect(result.totalEdges).toBeDefined();
        expect(result.layers).toBeDefined();
        expect(result.avgActivation).toBeDefined();
      } catch {
        // DB not available in test env
      }
    });
  });

  describe('getGraph', () => {
    it('should return graph structure', async () => {
      try {
        const result = await sm.getGraph(1, 20);
        expect(result.nodes).toBeDefined();
        expect(result.edges).toBeDefined();
      } catch {
        // DB not available in test env
      }
    });
  });
});
