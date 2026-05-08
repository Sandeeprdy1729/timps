import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class TestPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/test',
    name: 'Testing',
    version: '1.0.0',
    description: 'Testing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['test', 'mock', 'spy', 'stub'],
  };

  public capabilities: PluginCapabilities = {};

  createMock<T>(): Mock<T> {
    return new Mock<T>();
  }

  createSpy(fn: (...args: unknown[]) => unknown): Spy {
    return new Spy(fn);
  }

  createStub(): Stub {
    return new Stub();
  }

  mock<T>(fn: (...args: unknown[]) => unknown):jest.fn) {
    const mockFn = (...args: unknown[]) => {
      mockFn.calls.push(args);
      return mockFn.mockImplementation ? mockFn.mockImplementation(...args) : undefined;
    };
    mockFn.calls = [];
    mockFn.mockReturnValue = undefined;
    mockFn.mockImplementation = undefined;
    return mockFn;
  }

  spyOn(obj: Record<string, unknown>, method: string): Spy {
    const original = obj[method] as (...args: unknown[]) => unknown;
    const spy = this.createSpy(original);

    obj[method] = (...args: unknown[]) => spy(...args);

    return spy;
  }

  stub(obj: Record<string, unknown>, method: string, returnValue?: unknown): void {
    obj[method] = () => returnValue;
  }

  restore(obj: Record<string, unknown>, method: string, original: (...args: unknown[]) => unknown): void {
    obj[method] = original;
  }

  fn<T extends (...args: unknown[]) => unknown>(implementation?: T): T {
    const mockFn = (...args: unknown[]) => {
      if (implementation) return implementation(...args);
    };
    return mockFn as T;
  }

  fn.mock<T>(implementation?: T): T {
    return this.fn<T>(implementation);
  }

  mockReturnValue<T>(mock: Mock<T>, value: T): void {
    (mock as unknown as { mockReturnValue: T }).mockReturnValue = value;
  }

  mockImplementation<T>(mock: Mock<T>, fn: T): void {
    (mock as unknown as { mockImplementation: T }).mockImplementation = fn;
  }

  expect(value: unknown): Expectation {
    return new Expectation(value);
  }

  expectEqual(actual: unknown, expected: unknown): void {
    if (actual !== expected) {
      throw new Error(`Expected ${expected} but got ${actual}`);
    }
  }

  expectNotEqual(actual: unknown, expected: unknown): void {
    if (actual === expected) {
      throw new Error(`Expected ${expected} not to equal ${actual}`);
    }
  }

  expectTrue(value: unknown): void {
    if (value !== true) {
      throw new Error(`Expected true but got ${value}`);
    }
  }

  expectFalse(value: unknown): void {
    if (value !== false) {
      throw new Error(`Expected false but got ${value}`);
    }
  }

  expectNull(value: unknown): void {
    if (value !== null) {
      throw new Error(`Expected null but got ${value}`);
    }
  }

  expectUndefined(value: unknown): void {
    if (value !== undefined) {
      throw new Error(`Expected undefined but got ${value}`);
    }
  }

  expectThrow(fn: () => void, errorType?: string): void {
    try {
      fn();
      throw new Error(`Expected function to throw${errorType ? ` ${errorType}` : ''}`);
    } catch (e) {
      if (errorType && !(e instanceof Error && e.message.includes(errorType))) {
        throw e;
      }
    }
  }
}

export class Mock<T> {
  private calls: unknown[][] = [];
}

export class Spy {
  constructor(private fn: (...args: unknown[]) => unknown) {}

  calls: unknown[][] = [];
  mockReturnValue: unknown = undefined;

  call(...args: unknown[]): unknown {
    this.calls.push(args);
    return this.mockReturnValue;
  }
}

export class Stub {}

export interface Expectation {
  toBe(value: unknown): void;
  toEqual(value: unknown): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(value: unknown): void;
  toThrow(): void;
}

export class Expectation {
  constructor(private value: unknown) {}

  toBe(value: unknown): void {
    if (this.value !== value) {
      throw new Error(`Expected ${value} but got ${this.value}`);
    }
  }

  toEqual(value: unknown): void {
    if (JSON.stringify(this.value) !== JSON.stringify(value)) {
      throw new Error(`Expected ${JSON.stringify(value)} but got ${JSON.stringify(this.value)}`);
    }
  }

  toBeNull(): void {
    if (this.value !== null) {
      throw new Error(`Expected null but got ${this.value}`);
    }
  }

  toBeUndefined(): void {
    if (this.value !== undefined) {
      throw new Error(`Expected undefined but got ${this.value}`);
    }
  }

  toBeTruthy(): void {
    if (!this.value) {
      throw new Error(`Expected truthy but got ${this.value}`);
    }
  }

  toBeFalsy(): void {
    if (this.value) {
      throw new Error(`Expected falsy but got ${this.value}`);
    }
  }

  toContain(value: unknown): void {
    if (!String(this.value).includes(String(value))) {
      throw new Error(`Expected ${this.value} to contain ${value}`);
    }
  }

  toThrow(): void {
    if (!(this.value instanceof Function)) {
      throw new Error(`Expected function to throw`);
    }
  }
}

export class BenchmarkPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/benchmark',
    name: 'Benchmark',
    version: '1.0.0',
    description: 'Benchmarking utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['benchmark', 'performance', 'profile', 'measure'],
  };

  public capabilities: PluginCapabilities = {};

  measure(fn: () => void, iterations = 1000): BenchmarkResult {
    const times: number[] = [];
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();
      fn();
      times.push(performance.now() - iterStart);
    }

    const total = performance.now() - start;
    times.sort((a, b) => a - b);

    return {
      total,
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      min: times[0],
      max: times[times.length - 1],
      iterations,
      opsPerSec: (iterations / total) * 1000
    };
  }

  async measureAsync(fn: () => Promise<void>, iterations = 1000): Promise<BenchmarkResult> {
    const times: number[] = [];
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();
      await fn();
      times.push(performance.now() - iterStart);
    }

    const total = performance.now() - start;
    times.sort((a, b) => a - b);

    return {
      total,
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      min: times[0],
      max: times[times.length - 1],
      iterations,
      opsPerSec: (iterations / total) * 1000
    };
  }

  compare(...results: BenchmarkResult[]): BenchmarkComparison {
    const baseline = results[0];
    const comparisons: Array<{ name: string; faster: number; percent: number }> = [];

    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      const faster = (baseline.mean - result.mean) / baseline.mean * 100;
      comparisons.push({
        name: `Run ${i}`,
        faster,
        percent: faster
      });
    }

    return { baseline, comparisons };
  }
}

export interface BenchmarkResult {
  total: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  iterations: number;
  opsPerSec: number;
}

export interface BenchmarkComparison {
  baseline: BenchmarkResult;
  comparisons: Array<{ name: string; faster: number; percent: number }>;
}

export class FuzzPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/fuzz',
    name: 'Fuzz Testing',
    version: '1.0.0',
    description: 'Fuzzy testing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['fuzz', 'random', 'testing', 'gen'],
  };

  public capabilities: PluginCapabilities = {};

  random<T>(generator: () => T): Fuzz<T> {
    return new Fuzz(generator);
  }

  generate<T>(generator: () => T, count: number): T[] {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
      results.push(generator());
    }
    return results;
  }

  string(chars = 'abcdefghijklmnopqrstuvwxyz', minLen = 0, maxLen = 10): string {
    const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  number(min = 0, max = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  boolean(): boolean {
    return Math.random() > 0.5;
  }

  array<T>(generator: () => T>, minLen = 0, maxLen = 10): T[] {
    const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
    const result: T[] = [];
    for (let i = 0; i < len; i++) {
      result.push(generator());
    }
    return result;
  }

  oneOf<T>(...values: T[]): T {
    return values[Math.floor(Math.random() * values.length)];
  }

  date(start = new Date(0), end = new Date()): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
}

export class Fuzz<T> {
  constructor(private generator: () => T) {}

  generate(count: number): T[] {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.generator());
    }
    return results;
  }

  filter(predicate: (value: T) => boolean): Fuzz<T> {
    let result: T[];
    do {
      result = this.generate(100);
      result = result.filter(predicate);
    } while (result.length === 0);

    return new Fuzz(() => result[Math.floor(Math.random() * result.length)]);
  }
}

export class PropertyPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/property',
    name: 'Property Testing',
    version: '1.0.0',
    description: 'Property-based testing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['property', 'testing', 'quickcheck', 'gen'],
  };

  public capabilities: PluginCapabilities = {};

  forAll<T>(property: (value: T) => boolean, generator: () => T, iterations = 100): PropertyTestResult {
    const failures: Array<{ value: T; iteration: number }> = [];

    for (let i = 0; i < iterations; i++) {
      const value = generator();
      if (!property(value)) {
        failures.push({ value, iteration: i });
        if (failures.length >= 10) break;
      }
    }

    return {
      passed: failures.length === 0,
      iterations,
      failures: failures.length,
      counterExamples: failures
    };
  }

  check<T>(property: (value: T) => boolean, generator: () => T): PropertyTestResult {
    return this.forAll(property, generator, 100);
  }

  shrink<T>(value: T, shrinker: (value: T) => T[], property: (value: T) => boolean): T | null {
    if (property(value)) return null;

    const queue = [value];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (property(current)) return current;

      const shrinks = shrinker(current);
      queue.push(...shrinks);
    }

    return value;
  }
}

export interface PropertyTestResult {
  passed: boolean;
  iterations: number;
  failures: number;
  counterExamples: Array<{ value: unknown; iteration: number }>;
}

export class MockServerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/mock-server',
    name: 'Mock Server',
    version: '1.0.0',
    description: 'Mock HTTP server',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['mock', 'server', 'http', 'test'],
  };

  public capabilities: PluginCapabilities = {};

  private handlers: Map<string, RequestHandler> = new Map();

  get(url: string, handler: RequestHandler): void {
    this.handlers.set('GET:' + url, handler);
  }

  post(url: string, handler: RequestHandler): void {
    this.handlers.set('POST:' + url, handler);
  }

  put(url: string, handler: RequestHandler): void {
    this.handlers.set('PUT:' + url, handler);
  }

  delete(url: string, handler: RequestHandler): void {
    this.handlers.set('DELETE:' + url, handler);
  }

  handle(method: string, url: string, request: Request): Response {
    const key = method + ':' + url;
    const handler = this.handlers.get(key);

    if (handler) {
      return handler(request);
    }

    return { status: 404, body: 'Not Found', headers: {} };
  }

  clear(): void {
    this.handlers.clear();
  }
}

type RequestHandler = (request: Request) => Response;

export interface Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface Response {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export class FixturesPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/fixtures',
    name: 'Test Fixtures',
    version: '1.0.0',
    description: 'Test fixture utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['fixtures', 'test', 'data', 'mock'],
  };

  public capabilities: PluginCapabilities = {};

  private fixtures: Map<string, unknown> = new Map();

  create<T>(name: string, factory: () => T): T {
    if (!this.fixtures.has(name)) {
      this.fixtures.set(name, factory());
    }
    return this.fixtures.get(name) as T;
  }

  createEach<T>(name: string, factory: () => T, count: number): T[] {
    const fixtures: T[] = [];

    for (let i = 0; i < count; i++) {
      fixtures.push(factory());
    }

    this.fixtures.set(name, fixtures);
    return fixtures;
  }

  get<T>(name: string): T | null {
    return (this.fixtures.get(name) as T) || null;
  }

  clear(name?: string): void {
    if (name) {
      this.fixtures.delete(name);
    } else {
      this.fixtures.clear();
    }
  }

  users(count = 5): UserFixture[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: i % 2 === 0 ? 'admin' : 'user'
    }));
  }

  posts(count = 10): PostFixture[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Post ${i + 1}`,
      content: `Content for post ${i + 1}`,
      authorId: (i % 5) + 1,
      published: i % 2 === 0
    }));
  }

  comments(count = 20): CommentFixture[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      postId: (i % 10) + 1,
      authorId: (i % 5) + 1,
      content: `Comment ${i + 1}`
    }));
  }
}

export interface UserFixture {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface PostFixture {
  id: number;
  title: string;
  content: string;
  authorId: number;
  published: boolean;
}

export interface CommentFixture {
  id: number;
  postId: number;
  authorId: number;
  content: string;
}