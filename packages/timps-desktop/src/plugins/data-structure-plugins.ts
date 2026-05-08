import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class GraphPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/graph',
    name: 'Graph',
    version: '1.0.0',
    description: 'Graph data structure',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['graph', 'nodes', 'edges'],
  };

  public capabilities: PluginCapabilities = {};

  private nodes: Map<string, unknown> = new Map();
  private edges: Array<{ from: string; to: string; weight?: number }> = new Map();

  addNode(id: string, data: unknown): void {
    this.nodes.set(id, data);
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
  }

  addEdge(from: string, to: string, weight?: number): void {
    this.edges.push({ from, to, weight });
  }

  removeEdge(from: string, to: string): void {
    this.edges = this.edges.filter(e => !(e.from === from && e.to === to));
  }

  getNode(id: string): unknown {
    return this.nodes.get(id);
  }

  getNeighbors(id: string): string[] {
    return this.edges.filter(e => e.from === id).map(e => e.to);
  }

  getConnected(id: string): string[] {
    return [...this.edges.filter(e => e.from === id || e.to === id)]
      .map(e => e.from === id ? e.to : e.from);
  }

  hasPath(from: string, to: string): boolean {
    const visited = new Set<string>();
    const queue = [from];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...this.getNeighbors(current));
    }

    return false;
  }
}

export class TreePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/tree',
    name: 'Tree',
    version: '1.0.0',
    description: 'Tree data structure',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['tree', 'hierarchy', 'nodes'],
  };

  public capabilities: PluginCapabilities = {};

  private root: { id: string; data: unknown; children: Array<{ id: string; data: unknown }> } | null = null;

  setRoot(id: string, data: unknown): void {
    this.root = { id, data, children: [] };
  }

  addChild(parentId: string, id: string, data: unknown): void {
    const node = this.findNode(parentId);
    if (node) {
      node.children.push({ id, data });
    }
  }

  removeNode(id: string): void {
    if (!this.root) return;
    if (this.root.id === id) {
      this.root = null;
      return;
    }
    this.removeFromChildren(this.root.children, id);
  }

  private removeFromChildren(children: Array<{ id: string; data: unknown; children: Array<{ id: string; data: unknown }> }>, id: string): void {
    for (const child of children) {
      if (child.id === id) {
        children = children.filter(c => c.id !== id);
        return;
      }
      if (child.children) {
        this.removeFromChildren(child.children as Array<{ id: string; data: unknown; children: Array<{ id: string; data: unknown }> }>, id);
      }
    }
  }

  private findNode(id: string): { id: string; data: unknown; children: Array<{ id: string; data: unknown }> } | null {
    if (!this.root) return null;
    if (this.root.id === id) return this.root as { id: string; data: unknown; children: Array<{ id: string; data: unknown }> };
    return this.searchChildren(this.root.children, id);
  }

  private searchChildren(children: Array<{ id: string; data: unknown; children: Array<{ id: string; data: unknown }> }>, id: string): { id: string; data: unknown; children: Array<{ id: string; data: unknown }> } | null {
    for (const child of children) {
      if (child.id === id) return child as { id: string; data: unknown; children: Array<{ id: string; data: unknown }> };
      if (child.children) {
        const found = this.searchChildren(child.children as Array<{ id: string; data: unknown; children: Array<{ id: string; data: unknown }> }>, id);
        if (found) return found;
      }
    }
    return null;
  }

  getDepth(): number {
    if (!this.root) return 0;
    return this.calculateDepth(this.root.children);
  }

  private calculateDepth(children: Array<{ id: string; data: unknown; children: Array<{ id: string; data: unknown }> }>): number {
    if (children.length === 0) return 1;
    let maxDepth = 0;
    for (const child of children) {
      if (child.children) {
        maxDepth = Math.max(maxDepth, this.calculateDepth(child.children as Array<{ id: string; data: unknown; children: Array<{ id: string; data: unknown }> }));
      }
    }
    return maxDepth + 1;
  }

  traverse(callback: (id: string, data: unknown, depth: number) => void): void {
    if (!this.root) return;
    this.traverseNode(this.root, callback, 0);
  }

  private traverseNode(node: { id: string; data: unknown; children: Array<{ id: string; data: unknown }> }, callback: (id: string, data: unknown, depth: number) => void, depth: number): void {
    callback(node.id, node.data, depth);
    for (const child of node.children) {
      this.traverseNode(child as { id: string; data: unknown; children: Array<{ id: string; data: unknown }> }, callback, depth + 1);
    }
  }
}

export class HeapPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/heap',
    name: 'Heap',
    version: '1.0.0',
    description: 'Heap data structure',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['heap', 'priority', 'queue'],
  };

  public capabilities: PluginCapabilities = {};

  private heap: Array<{ id: string; priority: number }> = [];
  private isMinHeap = true;

  constructor(isMinHeap = true) {
    this.isMinHeap = isMinHeap;
  }

  push(id: string, priority: number): void {
    this.heap.push({ id, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: string; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return top;
  }

  peek(): { id: string; priority: number } | undefined {
    return this.heap[0];
  }

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) {
        [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.compare(this.heap[left], this.heap[smallest])) {
        smallest = left;
      }

      if (right < length && this.compare(this.heap[right], this.heap[smallest])) {
        smallest = right;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }

  private compare(a: { id: string; priority: number }, b: { id: string; priority: number }): boolean {
    if (this.isMinHeap) {
      return a.priority < b.priority;
    }
    return a.priority > b.priority;
  }
}

export class SetPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/set',
    name: 'Set Operations',
    version: '1.0.0',
    description: 'Set operations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['set', 'union', 'intersection'],
  };

  public capabilities: PluginCapabilities = {};

  union<T>(a: T[], b: T[]): T[] {
    return [...new Set([...a, ...b])];
  }

  intersection<T>(a: T[], b: T[]): T[] {
    const setB = new Set(b);
    return a.filter(x => setB.has(x));
  }

  difference<T>(a: T[], b: T[]): T[] {
    const setB = new Set(b);
    return a.filter(x => !setB.has(x));
  }

  symmetricDifference<T>(a: T[], b: T[]): T[] {
    return [...new Set([...this.difference(a, b), ...this.difference(b, a)])];
  }

  isSubset<T>(a: T[], b: T[]): boolean {
    const setA = new Set(a);
    return b.every(x => setA.has(x));
  }

  isSuperset<T>(a: T[], b: T[]): boolean {
    const setA = new Set(a);
    return b.every(x => setA.has(x));
  }

  powerSet<T>(elements: T[]): T[][] {
    const result: T[][] = [[]];

    for (const element of elements) {
      const current = result.map(set => [...set, element]);
      result.push(...current);
    }

    return result;
  }
}

export class DisjointSetPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/disjoint-set',
    name: 'Disjoint Set',
    version: '1.0.0',
    description: 'Disjoint set union find',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['dsu', 'union', 'find'],
  };

  public capabilities: PluginCapabilities = {};

  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  makeSet(id: string): void {
    this.parent.set(id, id);
    this.rank.set(id, 0);
  }

  find(id: string): string {
    if (this.parent.get(id) !== id) {
      this.parent.set(id, this.find(this.parent.get(id)!));
    }
    return this.parent.get(id)!;
  }

  union(id1: string, id2: string): void {
    const root1 = this.find(id1);
    const root2 = this.find(id2);

    if (root1 === root2) return;

    const rank1 = this.rank.get(root1) || 0;
    const rank2 = this.rank.get(root2) || 0;

    if (rank1 < rank2) {
      this.parent.set(root1, root2);
    } else if (rank1 > rank2) {
      this.parent.set(root2, root1);
    } else {
      this.parent.set(root2, root1);
      this.rank.set(root1, rank1 + 1);
    }
  }

  connected(id1: string, id2: string): boolean {
    return this.find(id1) === this.find(id2);
  }
}

export class TriePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/trie',
    name: 'Trie',
    version: '1.0.0',
    description: 'Prefix tree',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['trie', 'prefix', 'autocomplete'],
  };

  public capabilities: PluginCapabilities = {};

  private root: Map<string, Map<string, unknown>> = new Map();

  insert(word: string, value?: unknown): void {
    let current = this.root;

    for (const char of word) {
      if (!current.has(char)) {
        current.set(char, new Map());
      }
      current = current.get(char) as Map<string, unknown>;
    }

    current.set('EOF', value ?? true);
  }

  search(word: string): boolean {
    const node = this.getNode(word);
    return node ? node.has('EOF') : false;
  }

  startsWith(prefix: string): string[] {
    const results: string[] = [];
    let current = this.root;

    for (const char of prefix) {
      if (!current.has(char)) return results;
      current = current.get(char) as Map<string, unknown>;
    }

    this.collectWords(current, prefix, results);
    return results;
  }

  private getNode(word: string): Map<string, unknown> | null {
    let current = this.root;

    for (const char of word) {
      if (!current.has(char)) return null;
      current = current.get(char) as Map<string, unknown>;
    }

    return current;
  }

  private collectWords(node: Map<string, unknown>, prefix: string, results: string[]): void {
    for (const [char, value] of node) {
      if (char === 'EOF') {
        results.push(prefix);
      } else {
        this.collectWords(value as Map<string, unknown>, prefix + char, results);
      }
    }
  }
}

export const graphPlugin = new GraphPlugin();
export const treePlugin = new TreePlugin();
export const heapPlugin = new HeapPlugin();
export const setPlugin = new SetPlugin();
export const disjointSetPlugin = new DisjointSetPlugin();
export const triePlugin = new TriePlugin();

export function registerDataStructurePlugins(): Plugin[] {
  return [
    graphPlugin,
    treePlugin,
    heapPlugin,
    setPlugin,
    disjointSetPlugin,
    triePlugin,
  ];
}