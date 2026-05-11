// ── TIMPS Code — Feature Flags
// Feature flag system for progressive rollouts and A/B testing

export interface FeatureFlags {
  // Core features
  SWARM_ENABLED: boolean;
  MEMORY_VSS: boolean;
  KNOWLEDGE_GRAPH: boolean;
  PROCEDURAL_MEMORY: boolean;
  AFFECTIVE_MEMORY: boolean;
  TEMPORAL_VERSIONING: boolean;

  // Advanced features
  REMOTE_SESSIONS: boolean;
  SSH_MODE: boolean;
  BRIDGE_MODE: boolean;
  IDE_INTEGRATION: boolean;
  LSP_SUPPORT: boolean;

  // Enterprise
  MCP_ENABLED: boolean;
  PLUGINS: boolean;
  POLICY_LIMITS: boolean;
  OAUTH_SSO: boolean;
  MDM_CONFIG: boolean;

  // Intelligence
  BUG_PATTERN_PROPHET: boolean;
  TECH_DEBT_SEISMOGRAPH: boolean;
  CONTRADICTION_DETECTOR: boolean;
  BURNOUT_SEISMOGRAPH: boolean;
  PREDICTIVE_PREFETCHER: boolean;

  // UI/UX
  VOICE_MODE: boolean;
  REPL_MODE: boolean;
  THINKBACK: boolean;
  CONVERSATION_REPLAY: boolean;
  PROMPT_SUGGESTION: boolean;
  SPECULATION: boolean;

  // Experimental
  GRPO_TRAINING: boolean;
  BINARY_SYNTHESIS: boolean;
  SWE_BENCH: boolean;
  DIGITAL_OPTIMUS: boolean;

  // Beta
  KAIROS: boolean;
  COORDINATOR_MODE: boolean;
  MULTI_AGENT_ORCHESTRATION: boolean;
  TEAM_MEMORY_SYNC: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  // Core features
  SWARM_ENABLED: true,
  MEMORY_VSS: true,
  KNOWLEDGE_GRAPH: true,
  PROCEDURAL_MEMORY: true,
  AFFECTIVE_MEMORY: true,
  TEMPORAL_VERSIONING: true,

  // Advanced features
  REMOTE_SESSIONS: true,
  SSH_MODE: true,
  BRIDGE_MODE: true,
  IDE_INTEGRATION: true,
  LSP_SUPPORT: true,

  // Enterprise
  MCP_ENABLED: true,
  PLUGINS: true,
  POLICY_LIMITS: true,
  OAUTH_SSO: false,
  MDM_CONFIG: false,

  // Intelligence
  BUG_PATTERN_PROPHET: true,
  TECH_DEBT_SEISMOGRAPH: true,
  CONTRADICTION_DETECTOR: true,
  BURNOUT_SEISMOGRAPH: true,
  PREDICTIVE_PREFETCHER: true,

  // UI/UX
  VOICE_MODE: false,
  REPL_MODE: true,
  THINKBACK: true,
  CONVERSATION_REPLAY: true,
  PROMPT_SUGGESTION: true,
  SPECULATION: false,

  // Experimental
  GRPO_TRAINING: false,
  BINARY_SYNTHESIS: false,
  SWE_BENCH: false,
  DIGITAL_OPTIMUS: true,

  // Beta
  KAIROS: false,
  COORDINATOR_MODE: true,
  MULTI_AGENT_ORCHESTRATION: true,
  TEAM_MEMORY_SYNC: true,
};

class FeatureFlagManager {
  private flags: FeatureFlags;
  private overrides: Partial<FeatureFlags> = {};
  private listeners = new Map<keyof FeatureFlags, Set<(value: boolean) => void>>();

  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.loadFromEnv();
    this.loadFromConfig();
  }

  private loadFromEnv(): void {
    for (const key of Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]) {
      const envKey = `TIMPS_${key}`;
      if (process.env[envKey] !== undefined) {
        this.overrides[key] = process.env[envKey] === 'true' || process.env[envKey] === '1';
      }
    }
  }

  private loadFromConfig(): void {
    try {
      const configPath = path.join(process.env.HOME || '', '.timps', 'features.json');
      if (fs.existsSync(configPath)) {
        const overrides = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.overrides = { ...this.overrides, ...overrides };
      }
    } catch { /* ignore */ }
  }

  isEnabled(flag: keyof FeatureFlags): boolean {
    if (flag in this.overrides) {
      return this.overrides[flag]!;
    }
    return this.flags[flag];
  }

  setEnabled(flag: keyof FeatureFlags, value: boolean): void {
    this.overrides[flag] = value;
    this.saveToConfig();
    this.notifyListeners(flag, value);
  }

  getAllFlags(): FeatureFlags {
    return { ...this.flags, ...this.overrides };
  }

  getEnabledFlags(): Partial<FeatureFlags> {
    const enabled: Partial<FeatureFlags> = {};
    for (const key of Object.keys(this.flags) as (keyof FeatureFlags)[]) {
      if (this.isEnabled(key)) {
        enabled[key] = true;
      }
    }
    return enabled;
  }

  subscribe(flag: keyof FeatureFlags, listener: (value: boolean) => void): () => void {
    if (!this.listeners.has(flag)) {
      this.listeners.set(flag, new Set());
    }
    this.listeners.get(flag)!.add(listener);
    return () => this.listeners.get(flag)?.delete(listener);
  }

  private notifyListeners(flag: keyof FeatureFlags, value: boolean): void {
    const subs = this.listeners.get(flag);
    if (subs) {
      for (const listener of subs) {
        listener(value);
      }
    }
  }

  private saveToConfig(): void {
    try {
      const configDir = path.join(process.env.HOME || '', '.timps');
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'features.json');
      fs.writeFileSync(configPath, JSON.stringify(this.overrides, null, 2));
    } catch { /* ignore */ }
  }
}

import * as fs from 'node:fs';
import * as path from 'node:path';

let flagManager: FeatureFlagManager | null = null;

export function getFeatureFlags(): FeatureFlagManager {
  if (!flagManager) {
    flagManager = new FeatureFlagManager();
  }
  return flagManager;
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags().isEnabled(flag);
}

export function enableFeature(flag: keyof FeatureFlags): void {
  getFeatureFlags().setEnabled(flag, true);
}

export function disableFeature(flag: keyof FeatureFlags): void {
  getFeatureFlags().setEnabled(flag, false);
}
