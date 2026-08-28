// ── TIMPS Knowledge Graph ──
// Semantic memory as (subject, relation, object) triples with multi-hop traversal

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from '../utils/utils.js';
import type { KnowledgeNode, KnowledgeEdge, MemoryEntry } from './types.js';

export class KnowledgeGraphStore {
  private dir: string;
  private graphFile: string;

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.graphFile = path.join(this.dir, 'knowledge-graph.json');
  }

  private load(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    try {
      if (!fs.existsSync(this.graphFile)) return { nodes: [], edges: [] };
      return JSON.parse(fs.readFileSync(this.graphFile, 'utf-8'));
    } catch { return { nodes: [], edges: [] }; }
  }

  private save(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): void {
    fs.writeFileSync(this.graphFile, JSON.stringify({ nodes, edges }, null, 2), 'utf-8');
  }

  // ── Core Operations ─────────────────────────────────────────

  addNode(entity: string, entityType: KnowledgeNode['entityType'], attributes: Record<string, unknown> = {}): void {
    const data = this.load();
    const existing = data.nodes.find(n => n.entity === entity);
    if (existing) {
      existing.attributes = { ...existing.attributes, ...attributes };
      existing.updatedAt = Date.now();
    } else {
      data.nodes.push({
        id: generateId('node'),
        entity,
        entityType,
        attributes: { ...attributes, createdAt: Date.now() },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    this.save(data.nodes, data.edges);
  }

  addEdge(subject: string, relation: string, object: string, weight = 1.0): void {
    const data = this.load();
    const existing = data.edges.find(e => e.subject === subject && e.relation === relation && e.object === object);
    if (existing) {
      existing.weight = weight;
      existing.timestamp = Date.now();
    } else {
      data.edges.push({
        id: generateId('edge'),
        subject,
        relation,
        object,
        weight,
        timestamp: Date.now(),
      });
    }
    this.save(data.nodes, data.edges);
  }

  // ── Extraction from Memory Entries ──────────────────────────

  extractFromMemoryEntry(entry: MemoryEntry): void {
    const content = entry.content.toLowerCase();

    const timpsConcepts = [
      { pattern: /\b(timps|timps-code|timps-mcp)\b/gi, type: 'component' as KnowledgeNode['entityType'] },
      { pattern: /\b(memory|memory-system|layer)\b/gi, type: 'concept' as KnowledgeNode['entityType'] },
      { pattern: /\b(agent|swarm|coder|reviewer|orchestrator)\b/gi, type: 'concept' as KnowledgeNode['entityType'] },
      { pattern: /\b(mcp|provider|ollama|claude|gpt|gemini)\b/gi, type: 'technology' as KnowledgeNode['entityType'] },
      { pattern: /\b(tool|cli|vscode|neovim|jetbrains|plugin)\b/gi, type: 'concept' as KnowledgeNode['entityType'] },
      { pattern: /\b(typescript|python|lua|kotlin|rust|go|node)\b/gi, type: 'technology' as KnowledgeNode['entityType'] },
      { pattern: /\b(database|sqlite|postgres|mysql|redis|mongodb)\b/gi, type: 'technology' as KnowledgeNode['entityType'] },
      { pattern: /\b(benchmark|performance|retrieval|rag|bm25|vector)\b/gi, type: 'concept' as KnowledgeNode['entityType'] },
    ];

    for (const { pattern, type } of timpsConcepts) {
      let m: RegExpExecArray | null;
      const r = new RegExp(pattern.source, pattern.flags);
      while ((m = r.exec(content)) !== null) {
        const value = m[0].toLowerCase();
        this.addNode(value, type, { tags: entry.tags, memoryId: entry.id });
        if (content.includes('uses') || content.includes('has') || content.includes('with')) {
          this.addEdge(value, 'described_by', entry.content.slice(0, 100));
        }
      }
    }

    const techPatterns = [
      /\b(react|vue|angular|express|fastify|nest|next|nuxt|svelte|docker|kubernetes)\b/gi,
    ];

    let foundTech: string[] = [];
    for (const pattern of techPatterns) {
      let m: RegExpExecArray | null;
      const r = new RegExp(pattern.source, pattern.flags);
      while ((m = r.exec(content)) !== null) {
        foundTech.push(m[0]);
      }
    }

    if (foundTech.length > 0) {
      this.addNode(foundTech[0], 'technology', { tags: entry.tags });
      if (content.includes('use') || content.includes('using') || content.includes('built with') || content.includes('api')) {
        for (const t of foundTech.slice(1)) {
          this.addEdge(foundTech[0], 'often_used_with', t);
        }
      }
    }

    const frameworkMatch = content.match(/using\s+([A-Z][a-z]+(?:\.[a-z]+)?)/);
    if (frameworkMatch) {
      this.addNode(frameworkMatch[1], 'technology');
      this.addEdge(frameworkMatch[1], 'used_in', 'this_project');
    }

    if (content.includes('error') || content.includes('bug') || content.includes('incident') || content.includes('issue')) {
      this.addEdge('this_project', 'has_incident', foundTech[0] || 'unknown');
    }
  }

  // ── Multi-hop Traversal ─────────────────────────────────────

  traverse(startEntity: string, relations: string[], maxHops = 3): { path: string[]; score: number }[] {
    const data = this.load();
    const results: { path: string[]; score: number }[] = [];
    const visitedEdges = new Set<string>();

    function dfs(current: string, visited: string[], depth: number, path: string[]): void {
      if (depth >= maxHops) return;
      const nextEdges = data.edges.filter(e =>
        e.subject === current && !visited.includes(e.object)
      );
      for (const edge of nextEdges) {
        const edgeKey = `${edge.subject}|${edge.relation}|${edge.object}`;
        if (visitedEdges.has(edgeKey)) continue;
        visitedEdges.add(edgeKey);
        const newPath = [...path, `${current} --[${edge.relation}]--> ${edge.object}`];
        results.push({ path: newPath, score: edge.weight * (1 / (depth + 1)) });
        dfs(edge.object, [...visited, current], depth + 1, newPath);
      }
    }

    dfs(startEntity, [], 0, [`Start: ${startEntity}`]);
    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  query(question: string): { answer: string; confidence: number; hops: number } {
    const { nodes, edges } = this.load();
    const tokens = question.toLowerCase().split(/\s+/);

    const relevantEntities = nodes.filter(n =>
      tokens.some(t => n.entity.toLowerCase().includes(t) || Object.values(n.attributes).some(v => String(v).toLowerCase().includes(t)))
    );

    if (relevantEntities.length === 0) {
      return { answer: 'No relevant knowledge found in graph.', confidence: 0, hops: 0 };
    }

    const entity = relevantEntities[0];
    const relatedEdges = edges.filter(e => e.subject === entity.entity || e.object === entity.entity);

    if (relatedEdges.length > 0) {
      const relations = relatedEdges.map(e => `${e.subject} ${e.relation} ${e.object}`).join('; ');
      return {
        answer: `${entity.entity}: ${relations}`,
        confidence: Math.min(entity.attributes.confidence as number || 0.5 + 0.2, 1),
        hops: 1,
      };
    }

    return { answer: entity.entity, confidence: 0.5, hops: 0 };
  }

  // ── Utility ────────────────────────────────────────────────

  getStats(): { nodeCount: number; edgeCount: number; relationTypes: string[] } {
    const data = this.load();
    const relTypes = [...new Set(data.edges.map(e => e.relation))];
    return { nodeCount: data.nodes.length, edgeCount: data.edges.length, relationTypes: relTypes };
  }

  exportGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return this.load();
  }

  clearGraph(): void {
    this.save([], []);
  }
}