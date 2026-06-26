import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ProviderName } from '../config/types.js';

export interface ProviderUsageLimit {
  maxPerDay: number;
  maxPerMinute: number;
}

export interface ProviderUsageState {
  provider: ProviderName;
  date: string;
  dayCount: number;
  minuteBuckets: Record<string, number>;
  lastReset: number;
}

interface UsageFile {
  providers: Record<string, ProviderUsageState>;
}

const USAGE_FILE = path.join(os.homedir(), '.timps', 'usage.json');

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMinuteKey(): string {
  return new Date().toISOString().slice(0, 16);
}

function loadUsage(): UsageFile {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { providers: {} };
}

function saveUsage(usage: UsageFile): void {
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), 'utf-8');
}

function getOrCreateState(usage: UsageFile, provider: ProviderName): ProviderUsageState {
  if (!usage.providers[provider]) {
    usage.providers[provider] = {
      provider,
      date: getDateKey(),
      dayCount: 0,
      minuteBuckets: {},
      lastReset: Date.now(),
    };
  }
  const state = usage.providers[provider];
  if (state.date !== getDateKey()) {
    state.date = getDateKey();
    state.dayCount = 0;
    state.minuteBuckets = {};
    state.lastReset = Date.now();
  }
  return state;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  remainingMinute: number;
  nextReset: number;
  reason?: string;
}

export function checkRateLimit(provider: ProviderName, limits: ProviderUsageLimit): RateLimitCheck {
  const usage = loadUsage();
  const state = getOrCreateState(usage, provider);
  const minuteKey = getMinuteKey();
  const minuteCount = state.minuteBuckets[minuteKey] || 0;

  if (state.dayCount >= limits.maxPerDay) {
    const nextReset = new Date();
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(0, 0, 0, 0);
    return {
      allowed: false,
      remaining: 0,
      remainingMinute: limits.maxPerMinute - minuteCount,
      nextReset: nextReset.getTime(),
      reason: `Daily limit reached (${limits.maxPerDay}/${limits.maxPerDay})`,
    };
  }

  if (minuteCount >= limits.maxPerMinute) {
    const nextReset = Date.now() + 60000;
    return {
      allowed: false,
      remaining: limits.maxPerDay - state.dayCount,
      remainingMinute: 0,
      nextReset,
      reason: `Minute limit reached (${limits.maxPerMinute}/${limits.maxPerMinute})`,
    };
  }

  return {
    allowed: true,
    remaining: limits.maxPerDay - state.dayCount,
    remainingMinute: limits.maxPerMinute - minuteCount,
    nextReset: 0,
  };
}

export function recordUsage(provider: ProviderName): void {
  const usage = loadUsage();
  const state = getOrCreateState(usage, provider);
  const minuteKey = getMinuteKey();
  state.dayCount++;
  state.minuteBuckets[minuteKey] = (state.minuteBuckets[minuteKey] || 0) + 1;
  state.lastReset = Date.now();
  saveUsage(usage);
}

export function getUsageStats(provider: ProviderName): { dayCount: number; minuteCount: number; lastUsed: number } {
  const usage = loadUsage();
  const state = usage.providers[provider];
  if (!state) return { dayCount: 0, minuteCount: 0, lastUsed: 0 };
  const minuteKey = getMinuteKey();
  return {
    dayCount: state.date === getDateKey() ? state.dayCount : 0,
    minuteCount: state.minuteBuckets[minuteKey] || 0,
    lastUsed: state.lastReset,
  };
}

export function resetUsage(provider?: ProviderName): void {
  const usage = loadUsage();
  if (provider) {
    delete usage.providers[provider];
  } else {
    usage.providers = {};
  }
  saveUsage(usage);
}

export const DEFAULT_PROVIDER_LIMITS: Record<ProviderName, ProviderUsageLimit> = {
  claude: { maxPerDay: 1000, maxPerMinute: 50 },
  openai: { maxPerDay: 1000, maxPerMinute: 60 },
  gemini: { maxPerDay: 1500, maxPerMinute: 30 },
  ollama: { maxPerDay: 999999, maxPerMinute: 999999 },
  openrouter: { maxPerDay: 500, maxPerMinute: 30 },
  deepseek: { maxPerDay: 500, maxPerMinute: 30 },
  groq: { maxPerDay: 500, maxPerMinute: 30 },
  hybrid: { maxPerDay: 999999, maxPerMinute: 999999 },
};
