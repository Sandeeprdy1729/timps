import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class GraphPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/graph',
    name: 'Graph',
    version: '1.0.0',
    description: 'Graph algorithms and data structures',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['graph', 'node', 'edge', 'traversal'],
  };

  public capabilities: PluginCapabilities = {};

  create(directed = false): Graph {
    return new Graph(directed);
  }

  bfs(graph: Graph, start: string,visit: (node: string) => void): void {
    const visited = new Set<string>();
    const queue: string[] = [start];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;

      visit(node);
      visited.add(node);

      for (const neighbor of graph.getNeighbors(node)) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  dfs(graph: Graph, start: string, visit: (node: string) => void): void {
    const visited = new Set<string>();
    const stack = [start];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;

      visit(node);
      visited.add(node);

      for (const neighbor of graph.getNeighbors(node)) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
  }

  dijkstra(graph: Graph, start: string, end: string): number | null {
    const distances: Record<string, number> = {};
    const visited = new Set<string>();
    const pq: Array<{ node: string; distance: number }> = [];

    for (const node of graph.getNodes()) {
      distances[node] = node === start ? 0 : Infinity;
    }

    pq.push({ node: start, distance: 0 });

    while (pq.length > 0) {
      pq.sort((a, b) => a.distance - b.distance);
      const { node, distance } = pq.shift()!;

      if (visited.has(node)) continue;
      if (node === end) return distance;

      visited.add(node);

      for (const neighbor of graph.getNeighbors(node)) {
        if (visited.has(neighbor)) continue;

        const edgeWeight = graph.getWeight(node, neighbor) || 1;
        const newDist = distance + edgeWeight;

        if (newDist < distances[neighbor]) {
          distances[neighbor] = newDist;
          pq.push({ node: neighbor, distance: newDist });
        }
      }
    }

    return null;
  }

  topologicalSort(graph: Graph): string[] {
    const inDegree: Record<string, number> = {};
    const result: string[] = [];
    const visited = new Set<string>();

    for (const node of graph.getNodes()) {
      inDegree[node] = 0;
    }

    for (const node of graph.getNodes()) {
      for (const neighbor of graph.getNeighbors(node)) {
        inDegree[neighbor] = (inDegree[neighbor] || 0) + 1;
      }
    }

    const queue = Object.entries(inDegree)
      .filter(([, degree]) => degree === 0)
      .map(([node]) => node);

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      visited.add(node);

      for (const neighbor of graph.getNeighbors(node)) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== graph.getNodes().size) {
      return [];
    }

    return result;
  }

  findCycles(graph: Graph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string, onStack: Set<string>): void => {
      visited.add(node);
      onStack.add(node);
      path.push(node);

      for (const neighbor of graph.getNeighbors(node)) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, onStack);
        } else if (onStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }

      path.pop();
      onStack.delete(node);
    };

    for (const node of graph.getNodes()) {
      if (!visited.has(node)) {
        dfs(node, new Set());
      }
    }

    return cycles;
  }
}

export class Graph {
  private nodes: Set<string> = new Set();
  private edges: Map<string, Set<string>> = new Map();
  private weights: Map<string, number> = new Map();
  private directed: boolean;

  constructor(directed = false) {
    this.directed = directed;
  }

  addNode(node: string): this {
    this.nodes.add(node);
    if (!this.edges.has(node)) {
      this.edges.set(node, new Set());
    }
    return this;
  }

  addEdge(from: string, to: string, weight?: number): this {
    this.addNode(from);
    this.addNode(to);

    this.edges.get(from)!.add(to);
    if (weight !== undefined) {
      this.weights.set(`${from}->${to}`, weight);
    }

    if (!this.directed) {
      this.edges.get(to)!.add(from);
      if (weight !== undefined) {
        this.weights.set(`${to}->${from}`, weight);
      }
    }

    return this;
  }

  getNodes(): Set<string> {
    return this.nodes;
  }

  getNeighbors(node: string): string[] {
    return Array.from(this.edges.get(node) || []);
  }

  getWeight(from: string, to: string): number | undefined {
    return this.weights.get(`${from}->${to}`);
  }

  hasNode(node: string): boolean {
    return this.nodes.has(node);
  }

  hasEdge(from: string, to: string): boolean {
    return this.edges.get(from)?.has(to) || false;
  }

  removeNode(node: string): void {
    this.nodes.delete(node);
    this.edges.delete(node);

    for (const neighbors of this.edges.values()) {
      neighbors.delete(node);
    }

    for (const key of this.weights.keys()) {
      if (key.startsWith(`${node}->`) || key.endsWith(`->${node}`)) {
        this.weights.delete(key);
      }
    }
  }

  removeEdge(from: string, to: string): void {
    this.edges.get(from)?.delete(to);
    if (!this.directed) {
      this.edges.get(to)?.delete(from);
    }
    this.weights.delete(`${from}->${to}`);
    if (!this.directed) {
      this.weights.delete(`${to}->${from}`);
    }
  }

  size(): number {
    return this.nodes.size;
  }
}

export class TreePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/tree',
    name: 'Tree',
    version: '1.0.0',
    description: 'Tree data structures',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['tree', 'node', 'binary', 'search'],
  };

  public capabilities: PluginCapabilities = {};

  create<T>(value: T): TreeNode<T> {
    return new TreeNode(value);
  }

  bstInsert<T>(root: TreeNode<T> | null, value: T): TreeNode<T> {
    if (!root) return new TreeNode(value);

    if (value < root.value) {
      root.left = this.bstInsert(root.left, value);
    } else if (value > root.value) {
      root.right = this.bstInsert(root.right, value);
    }

    return root;
  }

  bstSearch<T>(root: TreeNode<T> | null, value: T): TreeNode<T> | null {
    if (!root) return null;
    if (value === root.value) return root;
    if (value < root.value) return this.bstSearch(root.left, value);
    return this.bstSearch(root.right, value);
  }

  bstDelete<T>(root: TreeNode<T> | null, value: T): TreeNode<T> | null {
    if (!root) return null;

    if (value < root.value) {
      root.left = this.bstDelete(root.left, value);
    } else if (value > root.value) {
      root.right = this.bstDelete(root.right, value);
    } else {
      if (!root.left) return root.right;
      if (!root.right) return root.left;

      const minLarger = this.findMin(root.right);
      root.value = minLarger.value;
      root.right = this.bstDelete(root.right, minLarger.value);
    }

    return root;
  }

  inorder<T>(root: TreeNode<T> | null, visit: (node: TreeNode<T>) => void): void {
    if (!root) return;
    this.inorder(root.left, visit);
    visit(root);
    this.inorder(root.right, visit);
  }

  preorder<T>(root: TreeNode<T> | null, visit: (node: TreeNode<T>) => void): void {
    if (!root) return;
    visit(root);
    this.preorder(root.left, visit);
    this.preorder(root.right, visit);
  }

  postorder<T>(root: TreeNode<T> | null, visit: (node: TreeNode<T>) => void): void {
    if (!root) return;
    this.postorder(root.left, visit);
    this.postorder(root.right, visit);
    visit(root);
  }

  height<T>(root: TreeNode<T> | null): number {
    if (!root) return -1;
    return 1 + Math.max(this.height(root.left), this.height(root.right));
  }

  balance<T>(root: TreeNode<T> | null): number {
    if (!root) return 0;
    return this.height(root.left) - this.height(root.right);
  }

  private findMin<T>(root: TreeNode<T>): TreeNode<T> {
    let current = root;
    while (current.left) {
      current = current.left;
    }
    return current;
  }
}

export class TreeNode<T> {
  public value: T;
  public left: TreeNode<T> | null = null;
  public right: TreeNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

export class HeapPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/heap',
    name: 'Heap',
    version: '1.0.0',
    description: 'Min/Max heap',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['heap', 'priority', 'queue', 'binary'],
  };

  public capabilities: PluginCapabilities = {};

  min(): MinHeap {
    return new MinHeap();
  }

  max(): MaxHeap {
    return new MaxHeap();
  }
}

export class MinHeap {
  private heap: number[] = [];

  insert(value: number): void {
    this.heap.push(value);
    this.bubbleUp(this.heap.length - 1);
  }

  extractMin(): number | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);

    return min;
  }

  peek(): number | null {
    return this.heap[0] || null;
  }

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent] <= this.heap[index]) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.heap[left] < this.heap[smallest]) {
        smallest = left;
      }

      if (right < this.heap.length && this.heap[right] < this.heap[smallest]) {
        smallest = right;
      }

      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

export class MaxHeap {
  private heap: number[] = [];

  insert(value: number): void {
    this.heap.push(value);
    this.bubbleUp(this.heap.length - 1);
  }

  extractMax(): number | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;

    const max = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);

    return max;
  }

  peek(): number | null {
    return this.heap[0] || null;
  }

  size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent] >= this.heap[index]) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let largest = index;

      if (left < this.heap.length && this.heap[left] > this.heap[largest]) {
        largest = left;
      }

      if (right < this.heap.length && this.heap[right] > this.heap[largest]) {
        largest = right;
      }

      if (largest === index) break;
      [this.heap[largest], this.heap[index]] = [this.heap[index], this.heap[largest]];
      index = largest;
    }
  }
}