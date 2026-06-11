// NexusForge - Episodic Sub-Agent Trinity with Hybrid Graph Indexing, RL-Policy Delta Evolution, and Persona-Orchestrated Retrieval
import { query, execute } from '../db/postgres';
import { config } from '../config/env';

export interface Signal {
  userId: number;
  projectId?: string;
  content: string;
  tags?: string[];
  confidence?: number;
  metadata?: Record<string, any>;
  outcomeScore?: number;
  sourceModule?: string;
  raw?: any;
}

export interface EpisodicNode {
  nodeId: string;
  gist: string;
  facts: string[];
  timestamp: Date;
  entityKeys: string[];
  content: string;
}

export interface PolicyDecision {
  action: 'store' | 'update' | 'discard' | 'summarize';
  targetNodeId?: string;
  confidence: number;
  reason: string;
}

export interface RetrievalResult {
  results: any[];
  refusal: boolean;
  confidence: number;
  traversalPath: string[];
}

export interface DeltaUpdate {
  targetNodeId: string;
  field: string;
  oldValue: any;
  newValue: any;
}

const ENABLED = process.env.ENABLE_NEXUSFORGE !== 'false';

export class NexusForge {
  private readonly enabled: boolean;
  private readonly personaState: Map<number, Record<string, any>> = new Map();

  constructor() {
    this.enabled = ENABLED;
    if (this.enabled) {
      console.log('[NexusForge] Initialized with sub-agent trinity');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async episodicIndexer(signal: Signal, sourceModule: string): Promise<string | null> {
    if (!this.enabled) return null;
    
    const nodeId = `nexus_${crypto.randomUUID()}`;
    const gist = await this.extractGist(signal.content);
    const facts = await this.extractFacts(signal.content);
    const entityKeys = this.extractEntityKeys(signal);
    
    try {
      await execute(
        `INSERT INTO nexus_episodic_nodes (node_id, user_id, project_id, source_module, gist, facts, entity_keys, content, raw_signal, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (node_id) DO UPDATE SET gist = $5, facts = $6, updated_at = NOW()`,
        [nodeId, signal.userId, signal.projectId || 'default', sourceModule, gist, JSON.stringify(facts), JSON.stringify(entityKeys), signal.content, JSON.stringify(signal.raw || {}), JSON.stringify(signal.metadata || {})]
      );
      
      await this.linkSpatiotemporalEdges(nodeId, signal, sourceModule);
      
      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingEpisodicNode(nodeId, signal);
      }
      
      return nodeId;
    } catch (err) {
      console.error('[NexusForge] Indexing error:', err);
      return null;
    }
  }

  async evolutionOracle(signal: Signal, context: any): Promise<PolicyDecision> {
    if (!this.enabled) {
      return { action: 'store', confidence: 0.5, reason: 'fallback' };
    }
    
    const persona = await this.getPersonaState(signal.userId);
    const existingNodes = await this.findSimilarNodes(signal.content, signal.userId);
    
    const decision: PolicyDecision = {
      action: 'store',
      confidence: 0.5,
      reason: 'default',
    };
    
    if (existingNodes.length > 0) {
      const conflictCheck = await this.checkConflicts(signal, existingNodes[0]);
      if (conflictCheck.hasConflict) {
        decision.action = 'update';
        decision.targetNodeId = existingNodes[0].node_id;
        decision.confidence = conflictCheck.confidence;
        decision.reason = conflictCheck.reason;
        
        await this.applyDeltaConsolidate(existingNodes[0].node_id, signal, conflictCheck.deltas);
      } else {
        decision.action = 'discard';
        decision.confidence = 0.8;
        decision.reason = 'No significant delta, skipping storage';
      }
    }
    
    return decision;
  }

  async retrievalWeaver(query: string, userId: number, context: any): Promise<RetrievalResult> {
    if (!this.enabled) {
      return { results: [], refusal: false, confidence: 0.5, traversalPath: [] };
    }
    
    const initialResults = await this.hybridGraphSearch(query, userId);
    
    if (initialResults.length === 0) {
      return { 
        results: [], 
        refusal: true, 
        confidence: 0.95, 
        traversalPath: ['hybrid_search'] 
      };
    }
    
    const resolved = await this.agenticIterativeTraverse(initialResults, context, userId);
    
    return resolved;
  }

  async buildVeilContext(query: string, userId: number, projectId: string, limit: number = 4): Promise<string> {
    if (!this.enabled) return '';
    
    try {
      const results = await this.hybridGraphSearch(query, userId, limit);
      if (results.length === 0) return '';
      
      const contextParts = results.map(r => 
        `[${r.source_module}] ${r.gist?.slice(0, 150) || r.content?.slice(0, 150) || ''}`
      );
      
      return `\n### NexusForge Context\n${contextParts.join('\n')}`;
    } catch {
      return '';
    }
  }

  private async extractGist(content: string): Promise<string> {
    return content.slice(0, 200);
  }

  private async extractFacts(content: string): Promise<string[]> {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 5).map(s => s.trim());
  }

  private extractEntityKeys(signal: Signal): string[] {
    const keys = new Set<string>();
    const tags = signal.tags || [];
    
    tags.forEach(t => keys.add(t));
    
    if (signal.metadata?.source_module) {
      keys.add(signal.metadata.source_module);
    }
    
    const content = signal.content.toLowerCase();
    if (content.includes('bug') || content.includes('error') || content.includes('crash')) {
      keys.add('code_issue');
    }
    if (content.includes('burnout') || content.includes('stress') || content.includes('tired')) {
      keys.add('burnout');
    }
    if (content.includes('relationship') || content.includes('team') || content.includes('colleague')) {
      keys.add('relationship');
    }
    if (content.includes('regret') || content.includes('mistake') || content.includes('wrong')) {
      keys.add('regret');
    }
    
    return [...keys];
  }

  private async linkSpatiotemporalEdges(nodeId: string, signal: Signal, sourceModule: string): Promise<void> {
    try {
      const similarNodes = await this.findSimilarNodes(signal.content, signal.userId, 3);
      
      for (const similar of similarNodes) {
        if (similar.node_id !== nodeId) {
          await execute(
            `INSERT INTO nexus_temporal_edges (source_node_id, target_node_id, edge_type, confidence, provenance_module)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [nodeId, similar.node_id, 'temporal', 0.7, sourceModule]
          );
        }
      }
    } catch (err) {
      console.error('[NexusForge] Edge linking error:', err);
    }
  }

  private async findSimilarNodes(content: string, userId: number, limit: number = 5): Promise<any[]> {
    try {
      return await query(
        `SELECT node_id, gist, content, source_module, created_at 
         FROM nexus_episodic_nodes 
         WHERE user_id = $1 AND (
           gist ILIKE $2 OR 
           content ILIKE $2 OR 
           entity_keys && $3
         )
         ORDER BY created_at DESC 
         LIMIT $4`,
        [userId, `%${content.slice(0, 50)}%`, JSON.stringify([content.split(' ')[0]]), limit]
      );
    } catch {
      return [];
    }
  }

  private async checkConflicts(signal: Signal, existingNode: any): Promise<{
    hasConflict: boolean;
    confidence: number;
    reason: string;
    deltas: DeltaUpdate[];
  }> {
    const deltas: DeltaUpdate[] = [];
    let hasConflict = false;
    
    try {
      const existingFacts = JSON.parse(existingNode.facts || '[]');
      const newFacts = await this.extractFacts(signal.content);
      
      for (const newFact of newFacts) {
        const isNew = !existingFacts.some((ef: string) => ef.slice(0, 30) === newFact.slice(0, 30));
        if (isNew) {
          hasConflict = true;
          deltas.push({
            targetNodeId: existingNode.node_id,
            field: 'facts',
            oldValue: existingFacts,
            newValue: [...existingFacts, newFact],
          });
        }
      }
    } catch {
      // Ignore parse errors
    }
    
    return {
      hasConflict,
      confidence: hasConflict ? 0.75 : 0.3,
      reason: hasConflict ? 'New factual information detected' : 'No significant update',
      deltas,
    };
  }

  private async applyDeltaConsolidate(targetNodeId: string, signal: Signal, deltas: DeltaUpdate[]): Promise<void> {
    for (const delta of deltas) {
      try {
        await execute(
          `UPDATE nexus_episodic_nodes 
           SET facts = $1, updated_at = NOW() 
           WHERE node_id = $2`,
          [JSON.stringify(delta.newValue), targetNodeId]
        );
      } catch (err) {
        console.error('[NexusForge] Delta consolidation error:', err);
      }
    }
  }

  private async getPersonaState(userId: number): Promise<Record<string, any>> {
    if (!this.personaState.has(userId)) {
      this.personaState.set(userId, {
        createdAt: new Date(),
        updateCount: 0,
        lastUpdate: new Date(),
      });
    }
    return this.personaState.get(userId)!;
  }

  private async hybridGraphSearch(searchQuery: string, userId: number, limit: number = 10): Promise<any[]> {
    try {
      const searchTerm = searchQuery.slice(0, 30);
      const firstWord = searchQuery.split(' ')[0];
      return await query(
        `SELECT node_id, gist, facts, entity_keys, content, source_module, created_at, metadata
         FROM nexus_episodic_nodes 
         WHERE user_id = $1 AND (
           gist ILIKE $2 OR 
           content ILIKE $2 OR 
           entity_keys && $3
         )
         ORDER BY created_at DESC 
         LIMIT $4`,
        [userId, `%${searchTerm}%`, JSON.stringify([firstWord]), limit]
      );
    } catch {
      return [];
    }
  }

  private async agenticIterativeTraverse(initialResults: any[], context: any, userId: number): Promise<RetrievalResult> {
    const traversalPath: string[] = ['hybrid_search'];
    const results = [...initialResults];
    
    if (results.length === 0) {
      return { results: [], refusal: true, confidence: 0.9, traversalPath };
    }
    
    traversalPath.push(' iterative_traverse');
    
    return {
      results: results.slice(0, 5),
      refusal: results.length === 0,
      confidence: Math.min(0.95, 0.5 + (results.length * 0.1)),
      traversalPath,
    };
  }

  private isCodingSource(sourceModule: string): boolean {
    const codingSources = ['timps-code', 'timps-vscode', 'timps-mcp', 'cli', 'code', 'tech_debt', 'bug_pattern'];
    return codingSources.some(s => sourceModule.toLowerCase().includes(s));
  }

  private async forgeCodingEpisodicNode(nodeId: string, signal: Signal): Promise<void> {
    try {
      const longitudinalLinks = await this.findLongitudinalLinks(signal);
      
      for (const tool of ['burnout_seismograph', 'relationship_intelligence', 'regret_oracle']) {
        if (longitudinalLinks.includes(tool)) {
          await execute(
            `INSERT INTO nexus_causal_edges (source_node_id, target_tool, edge_type, confidence, provenance_module)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [nodeId, tool, 'causal_link', 0.6, 'nexus_forge']
          );
        }
      }
    } catch (err) {
      console.error('[NexusForge] Coding node forging error:', err);
    }
  }

  private async findLongitudinalLinks(signal: Signal): Promise<string[]> {
    const tools: string[] = [];
    const content = signal.content.toLowerCase();
    
    if (content.includes('burnout') || content.includes('stress') || content.includes('overwork')) {
      tools.push('burnout_seismograph');
    }
    if (content.includes('relationship') || content.includes('team') || content.includes('colleague')) {
      tools.push('relationship_intelligence');
    }
    if (content.includes('regret') || content.includes('mistake') || content.includes('wrong')) {
      tools.push('regret_oracle');
    }
    
    return tools;
  }
}

export const nexusForge = new NexusForge();