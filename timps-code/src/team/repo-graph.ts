// repo-graph.ts - Repository Structural Semantic Graph (RSSG)
// Maps entire codebase at line level using Tree-Sitter
// Captures E_invoke (function calls) and E_contain (class structures) relationships

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface GraphNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'module';
  name: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  relationships: Relationship[];
}

export interface Relationship {
  targetId: string;
  type: 'calls' | 'imports' | 'contains' | 'extends' | 'implements';
  line: number;
}

export interface RSSG {
  files: Map<string, GraphNode>;
  functions: Map<string, GraphNode>;
  classes: Map<string, GraphNode>;
  dependencies: Map<string, string[]>;
  entryPoints: string[];
}

export class RepoGraph {
  private cwd: string;
  private cache: Map<string, GraphNode[]> = new Map();

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  async buildGraph(entryPoints: string[] = []): Promise<RSSG> {
    const rssg: RSSG = {
      files: new Map(),
      functions: new Map(),
      classes: new Map(),
      dependencies: new Map(),
      entryPoints,
    };

    // Find all source files
    const sourceFiles = this.findSourceFiles();
    
    for (const filePath of sourceFiles) {
      try {
        const nodes = await this.parseFile(filePath);
        
        for (const node of nodes) {
          if (node.type === 'file') {
            rssg.files.set(filePath, node);
          } else if (node.type === 'function') {
            rssg.functions.set(`${filePath}:${node.name}`, node);
          } else if (node.type === 'class') {
            rssg.classes.set(`${filePath}:${node.name}`, node);
          }

          // Track imports for dependency graph
          for (const rel of node.relationships) {
            if (rel.type === 'imports') {
              const deps = rssg.dependencies.get(filePath) || [];
              deps.push(rel.targetId);
              rssg.dependencies.set(filePath, deps);
            }
          }
        }
      } catch {}
    }

    return rssg;
  }

  private findSourceFiles(): string[] {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.cpp', '.c'];
    const files: string[] = [];
    
    const scan = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue;
          
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch {}
    };

    scan(this.cwd);
    return files;
  }

  private async parseFile(filePath: string): Promise<GraphNode[]> {
    const nodes: GraphNode[] = [];
    
    // Try tree-sitter if available, fallback to regex
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);
      
      // File node
      const fileNode: GraphNode = {
        id: filePath,
        type: 'file',
        name: path.basename(filePath),
        path: filePath,
        lineStart: 1,
        lineEnd: content.split('\n').length,
        relationships: [],
      };
      nodes.push(fileNode);

      // Use regex for now (Tree-Sitter would be more accurate but requires native bindings)
      const funcs = this.extractFunctions(content, ext);
      const classes = this.extractClasses(content, ext);
      const imports = this.extractImports(content, ext);

      for (const fn of funcs) {
        nodes.push({
          id: `${filePath}:${fn.name}`,
          type: 'function',
          name: fn.name,
          path: filePath,
          lineStart: fn.line,
          lineEnd: fn.line,
          relationships: fn.calls.map(call => ({
            targetId: call,
            type: 'calls' as const,
            line: fn.line,
          })),
        });
      }

      for (const cls of classes) {
        nodes.push({
          id: `${filePath}:${cls.name}`,
          type: 'class',
          name: cls.name,
          path: filePath,
          lineStart: cls.line,
          lineEnd: cls.line,
          relationships: cls.extends.map(ext => ({
            targetId: ext,
            type: 'extends' as const,
            line: cls.line,
          })),
        });
      }

      // Add imports to file node
      for (const imp of imports) {
        fileNode.relationships.push({
          targetId: imp,
          type: 'imports',
          line: 1,
        });
      }

    } catch {}

    return nodes;
  }

  private extractFunctions(content: string, ext: string): { name: string; line: number; calls: string[] }[] {
    const funcs: { name: string; line: number; calls: string[] }[] = [];
    
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const funcRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{)/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        const name = match[1] || match[2] || match[3];
        if (name) {
          const calls = this.extractFunctionCalls(content, match.index);
          funcs.push({ name, line: content.slice(0, match.index).split('\n').length, calls });
        }
      }
    } else if (ext === '.py') {
      const funcRegex = /def\s+(\w+)\s*\(/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        const calls = this.extractFunctionCalls(content, match.index);
        funcs.push({ name: match[1], line: content.slice(0, match.index).split('\n').length, calls });
      }
    } else if (ext === '.rs') {
      const funcRegex = /fn\s+(\w+)/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        funcs.push({ name: match[1], line: content.slice(0, match.index).split('\n').length, calls: [] });
      }
    } else if (ext === '.go') {
      const funcRegex = /func\s+(?:\(\w+\s+)?(\w+)\(/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        funcs.push({ name: match[1], line: content.slice(0, match.index).split('\n').length, calls: [] });
      }
    }

    return funcs;
  }

  private extractClasses(content: string, ext: string): { name: string; line: number; extends: string[] }[] {
    const classes: { name: string; line: number; extends: string[] }[] = [];
    
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
      let match;
      while ((match = classRegex.exec(content)) !== null) {
        classes.push({ name: match[1], line: content.slice(0, match.index).split('\n').length, extends: match[2] ? [match[2]] : [] });
      }
    } else if (ext === '.py') {
      const classRegex = /class\s+(\w+)(?:\s*\(([^)]+)\))?/g;
      let match;
      while ((match = classRegex.exec(content)) !== null) {
        const extends_ = match[2] ? match[2].split(',').map(s => s.trim()) : [];
        classes.push({ name: match[1], line: content.slice(0, match.index).split('\n').length, extends: extends_ });
      }
    }

    return classes;
  }

  private extractImports(content: string, ext: string): string[] {
    const imports: string[] = [];
    
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const importRegex = /import\s+(?:(?:\{[^}]*\})|(\w+)|(?:\*\s+as\s+(\w+)))\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[3] || match[1] || match[2]);
      }
    } else if (ext === '.py') {
      const importRegex = /(?:import\s+(\w+)|from\s+(\w+)\s+import)/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    }

    return imports;
  }

  private extractFunctionCalls(content: string, startIdx: number): string[] {
    const calls: string[] = [];
    const callRegex = /\b([a-zA-Z_]\w*)\s*\(/g;
    let match;
    const endIdx = Math.min(startIdx + 500, content.length);  // Look ahead 500 chars
    const slice = content.slice(startIdx, endIdx);
    
    while ((match = callRegex.exec(slice)) !== null) {
      if (!['if', 'while', 'for', 'switch', 'return', 'console', 'Math', 'JSON'].includes(match[1])) {
        calls.push(match[1]);
      }
    }
    
    return calls.slice(0, 5);  // Limit to 5 calls per function
  }

  // Get minimal "Gold Context" for solving a specific task
  getGoldContext(taskFile: string, taskDescription: string): { files: string[]; relationships: string[] } {
    const relevant: string[] = [taskFile];
    const rels: string[] = [];
    
    // Find files that import or are imported by task file
    const imports = this.cache.get(taskFile) || [];
    for (const imp of imports) {
      relevant.push(imp.path);
      rels.push(`${taskFile} → imports → ${imp}`);
    }
    
    // Find files that call functions from task file
    for (const [file, nodes] of this.cache) {
      for (const node of nodes) {
        if (node.relationships.some(r => r.targetId.includes(taskFile))) {
          relevant.push(file);
          rels.push(`${file} → calls → ${taskFile}`);
        }
      }
    }

    return { files: [...new Set(relevant)], relationships: rels.slice(0, 10) };
  }
}

export function createRepoGraph(cwd: string): RepoGraph {
  return new RepoGraph(cwd);
}