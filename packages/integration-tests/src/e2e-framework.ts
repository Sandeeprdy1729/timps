import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TimpsClient } from './client.js';
import { IntegrationBase } from './integration-base.js';

export interface E2EConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export interface TestContext {
  client: TimpsClient;
  user: TestUser;
  integrations: Map<string, IntegrationBase>;
}

export class E2ETestFramework {
  private client: TimpsClient | null = null;
  private config: E2EConfig;
  private testUsers: TestUser[] = [];
  private cleanupTasks: Array<() => Promise<void>> = [];

  constructor(config: E2EConfig) {
    this.config = config;
  }

  async setup(): Promise<void> {
    this.client = new TimpsClient({
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout || 30000,
    });

    await this.client.connect();
  }

  async teardown(): Promise<void> {
    for (const task of this.cleanupTasks.reverse()) {
      try {
        await task();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    }
    this.cleanupTasks = [];

    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  getClient(): TimpsClient {
    if (!this.client) {
      throw new Error('E2E framework not initialized. Call setup() first.');
    }
    return this.client;
  }

  registerCleanup(task: () => Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  async createTestUser(overrides?: Partial<TestUser>): Promise<TestUser> {
    const user: TestUser = {
      id: `user_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      name: 'Test User',
      ...overrides,
    };

    this.testUsers.push(user);
    this.registerCleanup(async () => {
      await this.deleteTestUser(user.id);
    });

    return user;
  }

  async deleteTestUser(userId: string): Promise<void> {
    const index = this.testUsers.findIndex(u => u.id === userId);
    if (index !== -1) {
      this.testUsers.splice(index, 1);
    }
  }
}

export function createE2ETest(name: string, config: E2EConfig) {
  const framework = new E2ETestFramework(config);

  describe(name, () => {
    beforeAll(async () => {
      await framework.setup();
    });

    afterAll(async () => {
      await framework.teardown();
    });

    return framework;
  });
}

export interface ScenarioOptions {
  name: string;
  timeout?: number;
  retries?: number;
}

export class TestScenario {
  private framework: E2ETestFramework;
  private options: ScenarioOptions;

  constructor(framework: E2ETestFramework, options: ScenarioOptions) {
    this.framework = framework;
    this.options = options;
  }

  async run(fn: (ctx: TestContext) => Promise<void>): Promise<void> {
    const client = this.framework.getClient();
    const user = await this.framework.createTestUser();

    const ctx: TestContext = {
      client,
      user,
      integrations: new Map(),
    };

    try {
      await fn(ctx);
    } finally {
      for (const [, integration] of ctx.integrations) {
        try {
          await integration.disconnect();
        } catch (error) {
          console.error('Integration disconnect failed:', error);
        }
      }
    }
  }
}

export function describeScenario(name: string, fn: (scenario: TestScenario) => void) {
  describe(name, () => {
    const framework = new E2ETestFramework({
      baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3000',
      apiKey: process.env.E2E_API_KEY,
    });

    beforeAll(async () => {
      await framework.setup();
    });

    afterAll(async () => {
      await framework.teardown();
    });

    const scenario = new TestScenario(framework, { name });
    fn(scenario);
  });
}

export interface IntegrationTestCase {
  name: string;
  input: any;
  expected: any;
  error?: string;
}

export async function runIntegrationTests(
  name: string,
  integration: IntegrationBase,
  cases: IntegrationTestCase[]
): Promise<void> {
  describe(name, () => {
    for (const testCase of cases) {
      it(testCase.name, async () => {
        if (testCase.error) {
          await expect(integration.apiCall(testCase.input)).rejects.toThrow(testCase.error);
        } else {
          const result = await integration.apiCall(testCase.input);
          expect(result).toEqual(testCase.expected);
        }
      });
    }
  });
}

export interface PerformanceBenchmark {
  name: string;
  fn: () => Promise<any> | (() => any;
  iterations: number;
  warmup?: number;
}

export async function runBenchmark(benchmark: PerformanceBenchmark): Promise<number> {
  const { name, fn, iterations, warmup = 3 } = benchmark;
  const times: number[] = [];

  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    times.push(duration);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`${name}: avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms`);

  return avg;
}

export function describePerformance(name: string, benchmarks: PerformanceBenchmark[]) {
  describe(name, () => {
    for (const benchmark of benchmarks) {
      it(benchmark.name, async () => {
        await runBenchmark(benchmark);
      });
    }
  });
}

export interface LoadTestConfig {
  users: number;
  duration: number;
  rampUp?: number;
}

export async function runLoadTest(
  name: string,
  fn: (userId: number) => Promise<void>,
  config: LoadTestConfig
): Promise<void> {
  const { users, duration, rampUp = 10 } = config;
  const startTime = Date.now();
  const promises: Promise<void>[] = [];

  for (let user = 0; user < users; user++) {
    const delay = (user * rampUp * 1000) / users;
    await new Promise(resolve => setTimeout(resolve, delay));

    promises.push(
      (async () => {
        while (Date.now() - startTime < duration) {
          try {
            await fn(user);
          } catch (error) {
            console.error(`User ${user} error:`, error);
          }
        }
      })()
    );
  }

  await Promise.all(promises);
}

export function describeLoad(name: string, fn: () => Promise<void>, config: LoadTestConfig) {
  it(name, async () => {
    await runLoadTest(name, fn, config);
  }, config.duration * 2);
}