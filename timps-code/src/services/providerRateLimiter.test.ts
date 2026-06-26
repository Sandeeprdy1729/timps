import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, recordUsage, getUsageStats, resetUsage, DEFAULT_PROVIDER_LIMITS } from './providerRateLimiter.js';

describe('ProviderRateLimiter', () => {
  beforeEach(() => {
    resetUsage();
  });

  it('allows requests within limits', () => {
    const result = checkRateLimit('openai', { maxPerDay: 100, maxPerMinute: 10 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
    expect(result.remainingMinute).toBe(10);
  });

  it('blocks when daily limit reached', () => {
    const limits = { maxPerDay: 2, maxPerMinute: 10 };
    recordUsage('openai');
    recordUsage('openai');
    const result = checkRateLimit('openai', limits);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain('Daily limit reached');
  });

  it('blocks when minute limit reached', () => {
    const limits = { maxPerDay: 100, maxPerMinute: 2 };
    recordUsage('openai');
    recordUsage('openai');
    const result = checkRateLimit('openai', limits);
    expect(result.allowed).toBe(false);
    expect(result.remainingMinute).toBe(0);
    expect(result.reason).toContain('Minute limit reached');
  });

  it('tracks usage stats', () => {
    recordUsage('claude');
    recordUsage('claude');
    recordUsage('claude');
    const stats = getUsageStats('claude');
    expect(stats.dayCount).toBe(3);
    expect(stats.lastUsed).toBeGreaterThan(0);
  });

  it('returns zero stats for unused provider', () => {
    const stats = getUsageStats('gemini');
    expect(stats.dayCount).toBe(0);
    expect(stats.minuteCount).toBe(0);
    expect(stats.lastUsed).toBe(0);
  });

  it('resets usage for specific provider', () => {
    recordUsage('openai');
    recordUsage('claude');
    resetUsage('openai');
    expect(getUsageStats('openai').dayCount).toBe(0);
    expect(getUsageStats('claude').dayCount).toBe(1);
  });

  it('resets all usage', () => {
    recordUsage('openai');
    recordUsage('claude');
    resetUsage();
    expect(getUsageStats('openai').dayCount).toBe(0);
    expect(getUsageStats('claude').dayCount).toBe(0);
  });

  it('DEFAULT_PROVIDER_LIMITS has all providers', () => {
    const providers = ['claude', 'openai', 'gemini', 'ollama', 'openrouter', 'deepseek', 'groq', 'hybrid'];
    for (const p of providers) {
      expect(DEFAULT_PROVIDER_LIMITS[p]).toBeDefined();
      expect(DEFAULT_PROVIDER_LIMITS[p].maxPerDay).toBeGreaterThan(0);
    }
  });

  it('ollama limit is essentially unlimited', () => {
    expect(DEFAULT_PROVIDER_LIMITS.ollama.maxPerDay).toBe(999999);
  });
});
