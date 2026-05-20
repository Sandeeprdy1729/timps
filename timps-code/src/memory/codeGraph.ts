// ── TIMPS Code Graph — GraphCodeAgent-style structural understanding ──
// Parses codebases into a traversable graph: files → functions → calls → imports
// Enables deep architectural reasoning and cross-file impact analysis

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface CodeNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'method' | 'import' | 'export' | 'variable';
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  complexity?: number;        // cyclomatic complexity estimate
  docstring?: string;
  isExported: boolean;
  isAsync: boolean;
  params?: string[];
}

export interface CodeEdge {
  from: string;               // node id
  to: string;                 // node id
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'uses' | 'defines' | 'exports';
  weight: number;             // 1-10, usage frequency
  filePath: string;
  line: number;
}

export interface CodeGraphStats {
  totalNodes: number;
  totalEdges: number;
  fileCount: number;
  functionCount: number;
  classCount: number;
  avgComplexity: number;
  mostConnected: string[];    // Top 5 most-connected nodes
  orphanedFiles: string[];    // Files with no inbound edges
}

export interface ImpactAnalysis {
  directDependents: string[];
  transitiveDependents: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedFiles: string[];
  changeRadius: number;       // How many hops away the change propagates
}

const GRAPH_DIR = path.join(os.homedir(), '.timps', 'code-graph');

export class CodeGraph {
  private nodes = new Map<string, CodeNode>();
  private edges: CodeEdge[] = [];
  private adjacency = new Map<string, Set<string>>();  // from → to
  private reverseAdj = new Map<string, Set<string>>(); // to → from (for impact analysis)
  private projectHash: string;
  private persistPath: string;

  constructor(projectHash: string) {
    this.projectHash = projectHash;
    this.persistPath = path.join(GRAPH_DIR, projectHash);
    this.load();
  }

  // ── Parsing ──────────────────────────────────────────────────────────────

  /**
   * Scan a project directory and build the code graph.
   * Uses heuristic regex parsing (no heavy AST deps) for speed.
   */
  async buildFromDirectory(dir: string, options: {
    include?: string[];
    exclude?: string[];
    maxFiles?: number;
  } = {}): Promise<void> {
    const include = options.include ?? ['ts', 'js', 'tsx', 'jsx', 'py', 'rs', 'go'];
    const exclude = options.exclude ?? ['node_modules', 'dist', 'build', '.git', 'target', 'coverage'];
    const maxFiles = options.maxFiles ?? 500;

    const files = this.collectFiles(dir, include, exclude, maxFiles);

    // Parse each file and extract nodes/edges
    for (const filePath of files) {
      try {
        await this.parseFile(filePath);
      } catch {
        // Skip unparseable files
      }
    }

    this.buildAdjacency();
    this.persist();
  }

  private collectFiles(
    dir: string,
    include: string[],
    exclude: string[],
    maxFiles: number,
    collected: string[] = []
  ): string[] {
    if (collected.length >= maxFiles) return collected;
    if (!fs.existsSync(dir)) return collected;

    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return collected; }

    for (const entry of entries) {
      if (collected.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!exclude.some(ex => entry.name === ex || entry.name.startsWith('.'))) {
          this.collectFiles(fullPath, include, exclude, maxFiles, collected);
        }
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop() ?? '';
        if (include.includes(ext)) {
          collected.push(fullPath);
        }
      }
    }
    return collected;
  }

  private async parseFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const ext = filePath.split('.').pop() ?? '';
    const lang = this.detectLanguage(ext);
    const relPath = filePath;

    // Create file node
    const fileId = `file:${filePath}`;
    this.nodes.set(fileId, {
      id: fileId,
      type: 'file',
      name: path.basename(filePath),
      filePath,
      startLine: 1,
      endLine: lines.length,
      language: lang,
      isExported: false,
      isAsync: false,
    });

    if (lang === 'typescript' || lang === 'javascript') {
      this.parseTSFile(filePath, content, lines, lang);
    } else if (lang === 'python') {
      this.parsePythonFile(filePath, content, lines);
    }
  }

  private parseTSFile(filePath: string, content: string, lines: string[], lang: string): void {
    const fileId = `file:${filePath}`;

    // Extract imports
    const importRegex = /^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(content)) !== null) {
      const importPath = m[1];
      const lineNum = content.substring(0, m.index).split('\n').length;

      // Resolve relative imports
      if (importPath.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filePath), importPath);
        const targetId = `file:${resolved}.ts`;
        this.addEdge({
          from: fileId,
          to: targetId,
          type: 'imports',
          weight: 1,
          filePath,
          line: lineNum,
        });
      }
    }

    // Extract function/method declarations
    const fnRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;
    while ((m = fnRegex.exec(content)) !== null) {
      const name = m[1];
      const lineNum = content.substring(0, m.index).split('\n').length;
      const isExported = m[0].includes('export');
      const isAsync = m[0].includes('async');
      const nodeId = `fn:${filePath}:${name}`;

      this.nodes.set(nodeId, {
        id: nodeId,
        type: 'function',
        name,
        filePath,
        startLine: lineNum,
        endLine: lineNum + 20, // estimate
        language: lang,
        isExported,
        isAsync,
        complexity: this.estimateComplexity(content, m.index),
      });

      this.addEdge({ from: fileId, to: nodeId, type: 'defines', weight: 1, filePath, line: lineNum });
    }

    // Extract class declarations
    const classRegex = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/gm;
    while ((m = classRegex.exec(content)) !== null) {
      const name = m[1];
      const parent = m[2];
      const lineNum = content.substring(0, m.index).split('\n').length;
      const isExported = m[0].includes('export');
      const nodeId = `class:${filePath}:${name}`;

      this.nodes.set(nodeId, {
        id: nodeId,
        type: 'class',
        name,
        filePath,
        startLine: lineNum,
        endLine: lineNum + 50, // estimate
        language: lang,
        isExported,
        isAsync: false,
      });

      this.addEdge({ from: fileId, to: nodeId, type: 'defines', weight: 1, filePath, line: lineNum });

      if (parent) {
        this.addEdge({ from: nodeId, to: `class:${parent}`, type: 'extends', weight: 1, filePath, line: lineNum });
      }
    }

    // Extract arrow function assignments (const foo = () =>)
    const arrowRegex = /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/gm;
    while ((m = arrowRegex.exec(content)) !== null) {
      const name = m[1];
      const lineNum = content.substring(0, m.index).split('\n').length;
      const isExported = m[0].includes('export');
      const isAsync = m[0].includes('async');
      const nodeId = `fn:${filePath}:${name}`;

      if (!this.nodes.has(nodeId)) {
        this.nodes.set(nodeId, {
          id: nodeId,
          type: 'function',
          name,
          filePath,
          startLine: lineNum,
          endLine: lineNum + 15,
          language: lang,
          isExported,
          isAsync,
        });
        this.addEdge({ from: fileId, to: nodeId, type: 'defines', weight: 1, filePath, line: lineNum });
      }
    }
  }

  private parsePythonFile(filePath: string, content: string, lines: string[]): void {
    const fileId = `file:${filePath}`;

    // Imports
    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, m.index).split('\n').length;
      const module = m[1] ?? m[2];
      if (module?.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filePath), module.replace(/\./g, '/'));
        this.addEdge({ from: fileId, to: `file:${resolved}.py`, type: 'imports', weight: 1, filePath, line: lineNum });
      }
    }

    // Functions
    const fnRegex = /^(?:async\s+)?def\s+(\w+)\s*\(/gm;
    while ((m = fnRegex.exec(content)) !== null) {
      const name = m[1];
      const lineNum = content.substring(0, m.index).split('\n').length;
      const isAsync = m[0].includes('async');
      const isExported = !name.startsWith('_');
      const nodeId = `fn:${filePath}:${name}`;

      this.nodes.set(nodeId, {
        id: nodeId,
        type: 'function',
        name,
        filePath,
        startLine: lineNum,
        endLine: lineNum + 20,
        language: 'python',
        isExported,
        isAsync,
        complexity: this.estimateComplexity(content, m.index),
      });
      this.addEdge({ from: fileId, to: nodeId, type: 'defines', weight: 1, filePath, line: lineNum });
    }

    // Classes
    const classRegex = /^class\s+(\w+)(?:\(([^)]+)\))?/gm;
    while ((m = classRegex.exec(content)) !== null) {
      const name = m[1];
      const parent = m[2];
      const lineNum = content.substring(0, m.index).split('\n').length;
      const nodeId = `class:${filePath}:${name}`;

      this.nodes.set(nodeId, {
        id: nodeId,
        type: 'class',
        name,
        filePath,
        startLine: lineNum,
        endLine: lineNum + 50,
        language: 'python',
        isExported: !name.startsWith('_'),
        isAsync: false,
      });
      this.addEdge({ from: fileId, to: nodeId, type: 'defines', weight: 1, filePath, line: lineNum });
      if (parent && parent !== 'object') {
        this.addEdge({ from: nodeId, to: `class:${parent}`, type: 'extends', weight: 1, filePath, line: lineNum });
      }
    }
  }

  private estimateComplexity(content: string, startIdx: number): number {
    // Count control flow keywords in next 1000 chars as complexity proxy
    const snippet = content.slice(startIdx, startIdx + 1000);
    const keywords = ['if ', 'else ', 'for ', 'while ', 'catch ', 'case ', '&&', '||', '?'];
    return keywords.reduce((sum, kw) => sum + (snippet.split(kw).length - 1), 1);
  }

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript',
      js: 'javascript', jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp', cc: 'cpp',
    };
    return map[ext] ?? ext;
  }

  // ── Graph operations ──────────────────────────────────────────────────────

  private addEdge(edge: CodeEdge): void {
    this.edges.push(edge);
  }

  private buildAdjacency(): void {
    this.adjacency.clear();
    this.reverseAdj.clear();

    for (const edge of this.edges) {
      if (!this.adjacency.has(edge.from)) this.adjacency.set(edge.from, new Set());
      if (!this.reverseAdj.has(edge.to)) this.reverseAdj.set(edge.to, new Set());

      this.adjacency.get(edge.from)!.add(edge.to);
      this.reverseAdj.get(edge.to)!.add(edge.from);
    }
  }

  // ── Impact analysis ───────────────────────────────────────────────────────

  /**
   * Given a file or function id, analyze what would be affected if it changes.
   */
  analyzeImpact(nodeId: string): ImpactAnalysis {
    const directDependents = Array.from(this.reverseAdj.get(nodeId) ?? new Set<string>());
    const transitiveDependents = this.bfsTransitive(nodeId, this.reverseAdj);

    const affectedFiles = new Set<string>();
    for (const id of transitiveDependents) {
      const node = this.nodes.get(id);
      if (node) affectedFiles.add(node.filePath);
    }

    const changeRadius = transitiveDependents.length;
    const riskLevel: ImpactAnalysis['riskLevel'] =
      changeRadius > 50 ? 'critical' :
      changeRadius > 20 ? 'high' :
      changeRadius > 5  ? 'medium' : 'low';

    return {
      directDependents,
      transitiveDependents,
      riskLevel,
      affectedFiles: Array.from(affectedFiles),
      changeRadius,
    };
  }

  private bfsTransitive(startId: string, adjMap: Map<string, Set<string>>): string[] {
    const visited = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = adjMap.get(current) ?? new Set<string>();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }

    visited.delete(startId);
    return Array.from(visited);
  }

  // ── Query API ─────────────────────────────────────────────────────────────

  /** Find nodes related to a query string (name matching) */
  search(query: string, limit = 10): CodeNode[] {
    const q = query.toLowerCase();
    const results: Array<{ node: CodeNode; score: number }> = [];

    for (const node of this.nodes.values()) {
      if (node.name.toLowerCase().includes(q)) {
        const score = node.name.toLowerCase() === q ? 1.0 :
                      node.name.toLowerCase().startsWith(q) ? 0.8 : 0.5;
        results.push({ node, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.node);
  }

  /** Get all functions/classes in a file */
  getFileSymbols(filePath: string): CodeNode[] {
    const results: CodeNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.filePath === filePath && node.type !== 'file') {
        results.push(node);
      }
    }
    return results.sort((a, b) => a.startLine - b.startLine);
  }

  /** Get callers of a function */
  getCallers(nodeId: string): CodeNode[] {
    const callerIds = this.reverseAdj.get(nodeId) ?? new Set<string>();
    return Array.from(callerIds)
      .map(id => this.nodes.get(id))
      .filter(Boolean) as CodeNode[];
  }

  /** Get callees of a function (what it calls) */
  getCallees(nodeId: string): CodeNode[] {
    const calleeIds = this.adjacency.get(nodeId) ?? new Set<string>();
    return Array.from(calleeIds)
      .map(id => this.nodes.get(id))
      .filter(Boolean) as CodeNode[];
  }

  /** Get import chain for a file */
  getImportChain(filePath: string): string[] {
    const fileId = `file:${filePath}`;
    return this.bfsTransitive(fileId, this.adjacency)
      .filter(id => id.startsWith('file:'))
      .map(id => id.replace('file:', ''));
  }

  /** Compute graph statistics */
  getStats(): CodeGraphStats {
    const complexities: number[] = [];
    const connectivity = new Map<string, number>();

    for (const node of this.nodes.values()) {
      if (node.complexity !== undefined) complexities.push(node.complexity);
      connectivity.set(node.id, (connectivity.get(node.id) ?? 0));
    }

    for (const edge of this.edges) {
      connectivity.set(edge.from, (connectivity.get(edge.from) ?? 0) + 1);
      connectivity.set(edge.to, (connectivity.get(edge.to) ?? 0) + 1);
    }

    const sortedByConnectivity = Array.from(connectivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const fileIds = new Set(
      Array.from(this.nodes.values())
        .filter(n => n.type !== 'file')
        .map(n => `file:${n.filePath}`)
    );

    const orphans: string[] = [];
    for (const node of this.nodes.values()) {
      if (node.type === 'file') {
        const inbound = this.reverseAdj.get(node.id)?.size ?? 0;
        if (inbound === 0) orphans.push(node.filePath);
      }
    }

    const fileCount = Array.from(this.nodes.values()).filter(n => n.type === 'file').length;
    const functionCount = Array.from(this.nodes.values()).filter(n => n.type === 'function').length;
    const classCount = Array.from(this.nodes.values()).filter(n => n.type === 'class').length;
    const avgComplexity = complexities.length > 0
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length
      : 0;

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      fileCount,
      functionCount,
      classCount,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      mostConnected: sortedByConnectivity,
      orphanedFiles: orphans.slice(0, 20),
    };
  }

  /** Generate a natural-language summary for the agent's context */
  summarize(): string {
    const stats = this.getStats();
    if (stats.totalNodes === 0) return '';

    const lines = [
      `## Code Structure Graph`,
      `- ${stats.fileCount} files, ${stats.functionCount} functions, ${stats.classCount} classes`,
      `- ${stats.totalEdges} dependency edges`,
      `- Avg cyclomatic complexity: ${stats.avgComplexity}`,
    ];

    if (stats.mostConnected.length > 0) {
      const nodeNames = stats.mostConnected
        .map(id => this.nodes.get(id)?.name ?? id.split(':').pop())
        .join(', ');
      lines.push(`- Most connected symbols: ${nodeNames}`);
    }

    return lines.join('\n');
  }

  /** Summarize impact before a change — inject into agent context */
  impactSummary(filePath: string): string {
    const fileId = `file:${filePath}`;
    if (!this.nodes.has(fileId)) return '';

    const impact = this.analyzeImpact(fileId);
    if (impact.changeRadius === 0) return `${path.basename(filePath)}: isolated (no dependents)`;

    return [
      `## Change Impact for ${path.basename(filePath)}`,
      `- Risk level: **${impact.riskLevel.toUpperCase()}**`,
      `- ${impact.directDependents.length} direct dependents`,
      `- ${impact.transitiveDependents.length} transitive dependents`,
      `- Affects ${impact.affectedFiles.length} files`,
    ].join('\n');
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private persist(): void {
    try {
      fs.mkdirSync(this.persistPath, { recursive: true });
      const nodesArr = Array.from(this.nodes.entries());
      fs.writeFileSync(
        path.join(this.persistPath, 'nodes.json'),
        JSON.stringify(nodesArr, null, 2)
      );
      fs.writeFileSync(
        path.join(this.persistPath, 'edges.json'),
        JSON.stringify(this.edges, null, 2)
      );
    } catch { /* ignore persist errors */ }
  }

  private load(): void {
    try {
      const nodesFile = path.join(this.persistPath, 'nodes.json');
      const edgesFile = path.join(this.persistPath, 'edges.json');

      if (fs.existsSync(nodesFile)) {
        const data = JSON.parse(fs.readFileSync(nodesFile, 'utf-8')) as [string, CodeNode][];
        this.nodes = new Map(data);
      }
      if (fs.existsSync(edgesFile)) {
        this.edges = JSON.parse(fs.readFileSync(edgesFile, 'utf-8'));
        this.buildAdjacency();
      }
    } catch { /* start fresh if corrupt */ }
  }

  /** Check if graph is stale (older than 10 minutes) */
  isStale(): boolean {
    try {
      const nodesFile = path.join(this.persistPath, 'nodes.json');
      if (!fs.existsSync(nodesFile)) return true;
      const stat = fs.statSync(nodesFile);
      const ageMs = Date.now() - stat.mtimeMs;
      return ageMs > 10 * 60 * 1000; // 10 minutes
    } catch { return true; }
  }

  get nodeCount(): number { return this.nodes.size; }
  get edgeCount(): number { return this.edges.length; }
}
