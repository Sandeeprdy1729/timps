// ── TIMPS Universal Provider Mesh ──
// Auto-discovery, intelligent routing, cost optimization, unified schema

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as child_process from 'node:child_process';
import type { ModelProvider, ProviderName, Message, ToolDefinition, StreamEvent, TokenUsage } from '../config/types.js';
import { loadConfig, getApiKey, getProviderLimits, getFallbackChain } from '../config/config.js';
import { createClaudeProvider } from './claude.js';
import { createOpenAIProvider, createOpenRouterProvider, createDeepSeekProvider, createGroqProvider } from './openai.js';
import { createGeminiProvider } from './gemini.js';
import { createOllamaProvider, listOllamaModels } from './ollama.js';
import { estimateTokens, estimateCost } from '../utils/utils.js';
import { checkRateLimit, recordUsage } from '../services/providerRateLimiter.js';

export interface DiscoveredProvider {
  name: string;
  provider: ProviderName;
  model: string;
  models: string[];
  url?: string;
  apiKey?: string;
  isLocal: boolean;
  isAvailable: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  maxTokens: number;
  supportsFunctionCalling: boolean;
  latencyMs?: number;
}

export interface RoutePolicy {
  taskType: 'fast' | 'reasoning' | 'code' | 'creative' | 'fallback';
  preferLocal: boolean;
  maxCostPerTurn?: number;
  maxLatencyMs?: number;
  requireFunctionCalling: boolean;
}

export interface RoutingDecision {
  provider: DiscoveredProvider;
  reason: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
}

const MODEL_COSTS: Record<string, { input: number; output: number; maxTokens: number }> = {
  'claude-opus-4': { input: 0.015, output: 0.075, maxTokens: 200000 },
  'claude-sonnet-4': { input: 0.003, output: 0.015, maxTokens: 200000 },
  'claude-haiku-3': { input: 0.0008, output: 0.004, maxTokens: 200000 },
  'gpt-5': { input: 0.01, output: 0.03, maxTokens: 128000 },
  'gpt-4o': { input: 0.005, output: 0.015, maxTokens: 128000 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006, maxTokens: 128000 },
  'o3': { input: 0.01, output: 0.04, maxTokens: 100000 },
  'o4-mini': { input: 0.0015, output: 0.006, maxTokens: 100000 },
  'gemini-2-5-pro': { input: 0.00125, output: 0.005, maxTokens: 1000000 },
  'gemini-2-5-flash': { input: 0.000075, output: 0.0003, maxTokens: 1000000 },
  'deepseek-chat': { input: 0.00027, output: 0.0011, maxTokens: 128000 },
  'deepseek-coder': { input: 0.00055, output: 0.0022, maxTokens: 128000 },
};

export class ProviderMesh {
  private config = loadConfig();
  private discoveredProviders: Map<string, DiscoveredProvider> = new Map();
  private fallbackChain: DiscoveredProvider[] = [];
  private costTracker: { sessionCost: number; sessionTokens: number; turnCosts: number[] } = {
    sessionCost: 0,
    sessionTokens: 0,
    turnCosts: [],
  };

  constructor() {
    this.discoverAll();
  }

  async discoverAll(): Promise<void> {
    await Promise.allSettled([
      this.detectOllama(),
      this.detectEnvKeys(),
      this.detectAWSBedrock(),
      this.detectAzureOpenAI(),
      this.detectGitHubCopilot(),
      this.detectOpenRouter(),
      this.detectLocalModels(),
    ]);
    this.buildFallbackChain();
  }

  private async detectOllama(): Promise<void> {
    const url = this.config.ollamaUrl || 'http://localhost:11434';
    try {
      const start = Date.now();
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      if (res.ok) {
        const data = await res.json() as { models: { name: string }[] };
        const models = data.models?.map(m => m.name) || [];
        const defaultModel = models.find(m => m.includes('coder')) ||
          models.find(m => m.includes('2.5')) || models[0] || 'llama3.2:1b';

        this.discoveredProviders.set('ollama', {
          name: 'Ollama (Local)',
          provider: 'ollama',
          model: defaultModel,
          models,
          url,
          isLocal: true,
          isAvailable: true,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          maxTokens: 128000,
          supportsFunctionCalling: false,
          latencyMs: latency,
        });
      }
    } catch { /* Ollama not running */ }
  }

  private async detectEnvKeys(): Promise<void> {
    if (process.env.ANTHROPIC_API_KEY || this.config.keys.claude) {
      const key = getApiKey(this.config, 'claude') || process.env.ANTHROPIC_API_KEY;
      this.discoveredProviders.set('claude', {
        name: 'Claude (Anthropic)',
        provider: 'claude',
        model: 'claude-sonnet-4-5',
        models: ['claude-opus-4', 'claude-sonnet-4-5', 'claude-haiku-3-7'],
        apiKey: key,
        isLocal: false,
        isAvailable: true,
        costPer1kInput: MODEL_COSTS['claude-sonnet-4'].input,
        costPer1kOutput: MODEL_COSTS['claude-sonnet-4'].output,
        maxTokens: 200000,
        supportsFunctionCalling: true,
      });
    }

    if (process.env.OPENAI_API_KEY || this.config.keys.openai) {
      const key = getApiKey(this.config, 'openai') || process.env.OPENAI_API_KEY;
      this.discoveredProviders.set('openai', {
        name: 'GPT (OpenAI)',
        provider: 'openai',
        model: 'gpt-4o',
        models: ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
        apiKey: key,
        isLocal: false,
        isAvailable: true,
        costPer1kInput: MODEL_COSTS['gpt-4o'].input,
        costPer1kOutput: MODEL_COSTS['gpt-4o'].output,
        maxTokens: 128000,
        supportsFunctionCalling: true,
      });
    }

    if (process.env.GEMINI_API_KEY || this.config.keys.gemini) {
      const key = getApiKey(this.config, 'gemini') || process.env.GEMINI_API_KEY;
      this.discoveredProviders.set('gemini', {
        name: 'Gemini (Google)',
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        apiKey: key,
        isLocal: false,
        isAvailable: true,
        costPer1kInput: MODEL_COSTS['gemini-2-5-pro'].input,
        costPer1kOutput: MODEL_COSTS['gemini-2-5-pro'].output,
        maxTokens: 1000000,
        supportsFunctionCalling: true,
      });
    }

    if (process.env.DEEPSEEK_API_KEY || this.config.keys.deepseek) {
      const key = getApiKey(this.config, 'deepseek') || process.env.DEEPSEEK_API_KEY;
      this.discoveredProviders.set('deepseek', {
        name: 'DeepSeek',
        provider: 'deepseek',
        model: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-coder'],
        apiKey: key,
        isLocal: false,
        isAvailable: true,
        costPer1kInput: MODEL_COSTS['deepseek-chat'].input,
        costPer1kOutput: MODEL_COSTS['deepseek-chat'].output,
        maxTokens: 128000,
        supportsFunctionCalling: true,
      });
    }

    if (process.env.GROQ_API_KEY || this.config.keys.groq) {
      const key = getApiKey(this.config, 'groq') || process.env.GROQ_API_KEY;
      this.discoveredProviders.set('groq', {
        name: 'Groq',
        provider: 'groq',
        model: 'llama-3.3-70b',
        models: ['llama-3.3-70b', 'mixtral-8x7b', 'llama-3.1-8b'],
        apiKey: key,
        isLocal: false,
        isAvailable: true,
        costPer1kInput: 0,
        costPer1kOutput: 0,
        maxTokens: 8192,
        supportsFunctionCalling: true,
        latencyMs: 200,
      });
    }

    if (process.env.OPENROUTER_API_KEY || this.config.keys.openrouter) {
      const key = getApiKey(this.config, 'openrouter') || process.env.OPENROUTER_API_KEY;
      this.discoveredProviders.set('openrouter', {
        name: 'OpenRouter (75+ models)',
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
        models: [],
        apiKey: key,
        isLocal: false,
        isAvailable: true,
        maxTokens: 128000,
        supportsFunctionCalling: true,
      });
    }
  }

  private async detectAWSBedrock(): Promise<void> {
    const homeDir = os.homedir();
    const awsCredPath = path.join(homeDir, '.aws', 'credentials');
    const awsConfigPath = path.join(homeDir, '.aws', 'config');

    if (fs.existsSync(awsCredPath)) {
      const credContent = fs.readFileSync(awsCredPath, 'utf-8');
      const hasAwsAccess = credContent.includes('aws_access_key_id') || credContent.includes('[default]');
      if (hasAwsAccess) {
        this.discoveredProviders.set('bedrock', {
          name: 'AWS Bedrock',
          provider: 'openai',
          model: 'anthropic.claude-3-5-sonnet-v1',
          models: ['anthropic.claude-3-5-sonnet-v1', 'anthropic.claude-3-opus-v1', 'meta.llama-3-3-70b-instruct'],
          isLocal: false,
          isAvailable: true,
          maxTokens: 200000,
          supportsFunctionCalling: true,
          costPer1kInput: 0.003,
          costPer1kOutput: 0.015,
        });
      }
    }
  }

  private async detectAzureOpenAI(): Promise<void> {
    if (process.env.AZURE_OPENAI_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      this.discoveredProviders.set('azure', {
        name: 'Azure OpenAI',
        provider: 'openai',
        model: 'gpt-4o',
        models: [],
        url: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_KEY,
        isLocal: false,
        isAvailable: true,
        maxTokens: 128000,
        supportsFunctionCalling: true,
      });
    }
  }

  private async detectGitHubCopilot(): Promise<void> {
    if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      try {
        const res = await fetch('https://api.github.com/copilot_next/token/status', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          this.discoveredProviders.set('copilot', {
            name: 'GitHub Copilot',
            provider: 'openai',
            model: 'gpt-4o',
            models: ['gpt-4o', 'gpt-4o-mini'],
            apiKey: token,
            isLocal: false,
            isAvailable: true,
            maxTokens: 128000,
            supportsFunctionCalling: true,
            costPer1kInput: 0,
            costPer1kOutput: 0,
          });
        }
      } catch { /* Copilot not available */ }
    }
  }

  private async detectOpenRouter(): Promise<void> {
    // OpenRouter auto-detects many models
    if (this.discoveredProviders.has('openrouter')) {
      try {
        const provider = this.discoveredProviders.get('openrouter')!;
        const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json() as { data: { id: string }[] };
          provider.models = data.data?.map(m => m.id) || [];
        }
      } catch { /* ignore */ }
    }
  }

  private async detectLocalModels(): Promise<void> {
    // Check for LM Studio
    try {
      const res = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json() as { data: { id: string }[] };
        this.discoveredProviders.set('lm-studio', {
          name: 'LM Studio (Local)',
          provider: 'openai',
          model: data.data?.[0]?.id || 'local-model',
          models: data.data?.map(m => m.id) || [],
          url: 'http://localhost:1234/v1',
          isLocal: true,
          isAvailable: true,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          maxTokens: 128000,
          supportsFunctionCalling: false,
        });
      }
    } catch { /* LM Studio not running */ }

    // Check for Jan
    try {
      const res = await fetch('http://localhost:1337/v1/models', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json() as { data: { id: string }[] };
        this.discoveredProviders.set('jan', {
          name: 'Jan (Local)',
          provider: 'openai',
          model: data.data?.[0]?.id || 'local-model',
          models: data.data?.map(m => m.id) || [],
          url: 'http://localhost:1337/v1',
          isLocal: true,
          isAvailable: true,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          maxTokens: 128000,
          supportsFunctionCalling: false,
        });
      }
    } catch { /* Jan not running */ }

    // Check for vLLM
    try {
      const res = await fetch('http://localhost:8000/v1/models', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json() as { data: { id: string }[] };
        this.discoveredProviders.set('vllm', {
          name: 'vLLM (Local)',
          provider: 'openai',
          model: data.data?.[0]?.id || 'local-model',
          models: data.data?.map(m => m.id) || [],
          url: 'http://localhost:8000/v1',
          isLocal: true,
          isAvailable: true,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          maxTokens: 128000,
          supportsFunctionCalling: false,
        });
      }
    } catch { /* vLLM not running */ }
  }

  private buildFallbackChain(): void {
    const scored: Array<{ key: string; priority: number }> = [];

    for (const [key, provider] of this.discoveredProviders) {
      let p = 10;
      if (provider.isLocal) p -= 3;
      if (provider.supportsFunctionCalling) p += 2;
      if (provider.costPer1kInput === 0) p += 1;
      if (provider.latencyMs && provider.latencyMs < 500) p += 1;
      p += Math.max(0, 5 - (provider.costPer1kInput || 0) * 100);
      scored.push({ key, priority: p });
    }

    this.fallbackChain = scored
      .sort((a, b) => b.priority - a.priority)
      .map(p => this.discoveredProviders.get(p.key)!)
      .filter(Boolean);
  }

  route(taskType: string, policy: Partial<RoutePolicy> = {}): RoutingDecision {
    const query = taskType.toLowerCase();

    const isFast = query.includes('quick') || query.includes('simple') || query.includes('one-line') || query.includes('fix typo');
    const isReasoning = query.includes('why') || query.includes('explain') || query.includes('architecture') || query.includes('design');
    const isCode = query.includes('implement') || query.includes('write') || query.includes('fix') || query.includes('add') || query.includes('create');
    const isCreative = query.includes('brainstorm') || query.includes('ideas') || query.includes('suggest') || query.includes('improve');

    let candidates = [...this.discoveredProviders.values()].filter(p => p.isAvailable);

    if (policy.requireFunctionCalling) {
      candidates = candidates.filter(p => p.supportsFunctionCalling);
    }

    if (policy.preferLocal) {
      const local = candidates.filter(p => p.isLocal);
      const remote = candidates.filter(p => !p.isLocal);
      candidates = [...local, ...remote];
    }

    if (isFast || policy.taskType === 'fast') {
      const local = candidates.find(p => p.isLocal && p.latencyMs && p.latencyMs < 2000);
      if (local) {
        return {
          provider: local,
          reason: 'Fast task → local model (free, instant)',
          estimatedCost: 0,
          estimatedLatencyMs: local.latencyMs || 1000,
        };
      }
    }

    if (isReasoning || policy.taskType === 'reasoning') {
      const claude = candidates.find(p => p.provider === 'claude' && p.model.includes('opus'));
      if (claude) {
        return {
          provider: claude,
          reason: 'Complex reasoning → Claude Opus (best reasoning)',
          estimatedCost: this.estimateCost(claude, 10000, 5000),
          estimatedLatencyMs: 5000,
        };
      }
      const gpt5 = candidates.find(p => (p.model.includes('gpt-5') || p.model.includes('o3')));
      if (gpt5) {
        return {
          provider: gpt5,
          reason: 'Complex reasoning → GPT-5/o3 (advanced)',
          estimatedCost: this.estimateCost(gpt5, 10000, 5000),
          estimatedLatencyMs: 5000,
        };
      }
    }

    if (isCode || policy.taskType === 'code') {
      const coder = candidates.find(p =>
        p.model.includes('coder') || p.model.includes('4o-mini') || p.model.includes('haiku') || p.isLocal
      );
      if (coder) {
        return {
          provider: coder,
          reason: coder.isLocal ? 'Code task → local coder (free)' : 'Code task → efficient model',
          estimatedCost: coder.isLocal ? 0 : this.estimateCost(coder, 5000, 3000),
          estimatedLatencyMs: coder.latencyMs || 3000,
        };
      }
    }

    if (isCreative || policy.taskType === 'creative') {
      const gemini = candidates.find(p => p.provider === 'gemini' && p.model.includes('flash'));
      if (gemini) {
        return {
          provider: gemini,
          reason: 'Creative task → Gemini Flash (fast, creative)',
          estimatedCost: this.estimateCost(gemini, 8000, 4000),
          estimatedLatencyMs: 3000,
        };
      }
    }

    if (policy.taskType === 'fallback') {
      const free = candidates.find(p => p.costPer1kInput === 0);
      if (free) {
        return {
          provider: free,
          reason: 'Fallback → free provider',
          estimatedCost: 0,
          estimatedLatencyMs: free.latencyMs || 5000,
        };
      }
    }

    const best = candidates[0];
    if (!best) {
      throw new Error('No providers available. Run `timps --setup` to configure a provider.');
    }

    return {
      provider: best,
      reason: `Default → ${best.name} (highest priority)`,
      estimatedCost: this.estimateCost(best, 5000, 2000),
      estimatedLatencyMs: best.latencyMs || 5000,
    };
  }

  createProvider(discovered: DiscoveredProvider): ModelProvider {
    const { provider, url, apiKey } = discovered;

    switch (provider) {
      case 'claude':
        return createClaudeProvider(apiKey!, discovered.model);
      case 'openai':
        return createOpenAIProvider({ apiKey: apiKey!, model: discovered.model, baseUrl: url });
      case 'gemini':
        return createGeminiProvider(apiKey!, discovered.model);
      case 'ollama':
        return createOllamaProvider(url || 'http://localhost:11434', discovered.model);
      case 'openrouter':
        return createOpenRouterProvider(apiKey!, discovered.model);
      case 'deepseek':
        return createDeepSeekProvider(apiKey!, discovered.model);
      case 'groq':
        return createGroqProvider(apiKey!, discovered.model);
      default:
        if (url) {
          return createOpenAIProvider({ apiKey: apiKey || '', model: discovered.model, baseUrl: url });
        }
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async *streamWithFallback(
    messages: Message[],
    tools: ToolDefinition[],
    options?: { signal?: AbortSignal; taskType?: string; policy?: Partial<RoutePolicy> }
  ): AsyncGenerator<StreamEvent & { provider?: string; cost?: number }> {
    const policy = options?.policy || {};
    const route = this.route(options?.taskType || '', policy);
    const config = loadConfig();
    const strategy = config.rateLimitStrategy || 'fallback';

    // Build ordered list of providers to try (primary + fallback chain)
    const chainSteps = getFallbackChain(config);
    const discoveredMap = new Map<string, DiscoveredProvider>();
    for (const dp of this.discoveredProviders.values()) {
      discoveredMap.set(dp.provider, dp);
    }

    const allSteps: DiscoveredProvider[] = [route.provider];
    for (const step of chainSteps) {
      const existing = discoveredMap.get(step.provider);
      if (existing) {
        if (!allSteps.find(s => s.provider === existing.provider)) allSteps.push(existing);
      } else {
        // Construct a minimal discovered provider for this step
        const apiKey = getApiKey(config, step.provider);
        const isLocal = step.provider === 'ollama';
        allSteps.push({
          name: step.provider,
          provider: step.provider,
          model: step.model,
          models: [step.model],
          url: step.provider === 'ollama' ? config.ollamaUrl : undefined,
          apiKey,
          isLocal,
          isAvailable: true,
          costPer1kInput: 0,
          costPer1kOutput: 0,
          maxTokens: 128000,
          supportsFunctionCalling: step.provider !== 'gemini' && step.provider !== 'ollama',
          latencyMs: isLocal ? 100 : 2000,
        });
      }
    }

    let lastError: Error | null = null;
    for (const dp of allSteps) {
      const providerName = dp.provider;
      const limits = getProviderLimits(config, providerName);
      const check = checkRateLimit(providerName, limits);

      if (!check.allowed && strategy === 'block') {
        yield { type: 'error', message: `Rate limit: ${check.reason}. Next reset in ${Math.ceil((check.nextReset - Date.now()) / 1000)}s.` };
        return;
      }

      if (!check.allowed && strategy === 'fallback') {
        lastError = new Error(check.reason || 'Rate limited');
        continue;
      }

      try {
        const provider = this.createProvider(dp);
        recordUsage(providerName);
        for await (const event of provider.stream(messages, tools, { signal: options?.signal })) {
          if (event.type === 'done' && event.usage) {
            const cost = estimateCost(dp.model, event.usage.inputTokens, event.usage.outputTokens);
            this.costTracker.sessionCost += cost;
            this.costTracker.sessionTokens += event.usage.inputTokens + event.usage.outputTokens;
            this.costTracker.turnCosts.push(cost);
            yield { ...event, provider: providerName, cost };
          } else {
            yield { ...event, provider: providerName };
          }
        }
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (lastError) throw lastError;
  }

  private estimateCost(provider: DiscoveredProvider, inputTokens: number, outputTokens: number): number {
    const cost = provider.costPer1kInput || 0;
    const outCost = provider.costPer1kOutput || 0;
    return (inputTokens / 1000) * cost + (outputTokens / 1000) * outCost;
  }

  getDiscoveredProviders(): DiscoveredProvider[] {
    return [...this.discoveredProviders.values()];
  }

  getCostReport(): { sessionCost: number; sessionTokens: number; avgCostPerTurn: number; costByProvider: Record<string, number> } {
    const avgCostPerTurn = this.costTracker.turnCosts.length > 0
      ? this.costTracker.turnCosts.reduce((a, b) => a + b, 0) / this.costTracker.turnCosts.length
      : 0;
    return {
      sessionCost: this.costTracker.sessionCost,
      sessionTokens: this.costTracker.sessionTokens,
      avgCostPerTurn,
      costByProvider: {},
    };
  }

  getBestProvider(policy: Partial<RoutePolicy> = {}): DiscoveredProvider {
    return this.route('', policy).provider;
  }

  async refreshDiscovery(): Promise<void> {
    this.discoveredProviders.clear();
    this.fallbackChain = [];
    await this.discoverAll();
  }
}

let globalMesh: ProviderMesh | null = null;

export function getProviderMesh(): ProviderMesh {
  if (!globalMesh) {
    globalMesh = new ProviderMesh();
  }
  return globalMesh;
}