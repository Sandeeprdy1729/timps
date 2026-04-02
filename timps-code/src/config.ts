import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { TimpsConfig, ProviderName, TrustLevel } from './types.js';
import { t, icons } from './theme.js';

const CONFIG_DIR = path.join(os.homedir(), '.timps');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: TimpsConfig = {
  defaultProvider: 'ollama',
  defaultModel: 'qwen2.5-coder:7b',
  trustLevel: 'normal',
  keys: {},
  ollamaUrl: 'http://localhost:11434',
  memoryEnabled: true,
  autoCorrect: true,
  maxContextTokens: 128000,
};

export function loadConfig(): TimpsConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: TimpsConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getApiKey(config: TimpsConfig, provider: ProviderName): string | undefined {
  if (config.keys[provider]) return config.keys[provider];
  const envMap: Record<ProviderName, string> = {
    claude: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    ollama: '',
    openrouter: 'OPENROUTER_API_KEY',
  };
  const envKey = envMap[provider];
  return envKey ? process.env[envKey] : undefined;
}

const PROVIDERS: Record<ProviderName, { label: string; needsKey: boolean; free: string }> = {
  claude:     { label: 'Anthropic Claude',  needsKey: true,  free: '' },
  openai:     { label: 'OpenAI / Codex',    needsKey: true,  free: '' },
  gemini:     { label: 'Google Gemini',      needsKey: true,  free: 'gemini-2.0-flash (15 RPM free)' },
  ollama:     { label: 'Ollama (local)',     needsKey: false, free: 'deepseek-r1, qwen2.5-coder, codellama' },
  openrouter: { label: 'OpenRouter',         needsKey: true,  free: 'deepseek-r1:free, gemini-flash:free' },
};

const DEFAULT_MODELS: Record<ProviderName, string> = {
  claude: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  ollama: 'qwen2.5-coder:latest',
  openrouter: 'google/gemini-2.0-flash-exp:free',
};

export function getDefaultModel(provider: ProviderName): string {
  return DEFAULT_MODELS[provider];
}

export async function runSetupWizard(existing?: TimpsConfig): Promise<TimpsConfig> {
  const config = existing ? { ...existing } : { ...DEFAULT_CONFIG };
  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log(`\n  ${t.brandBold('⚡ TIMPS Code — Setup')}`);
  console.log(t.separator);
  console.log(t.dim('  Configure your coding agent\n'));

  const providerKeys = Object.keys(PROVIDERS) as ProviderName[];
  console.log(t.bold('  Providers:\n'));
  providerKeys.forEach((p, i) => {
    const info = PROVIDERS[p];
    const keyStatus = info.needsKey
      ? (getApiKey(config, p) ? t.success(' ✔ key set') : t.warning(' ○ needs key'))
      : t.success(' ✔ local');
    console.log(`  ${t.bold(`${i + 1}.`)} ${t.info(info.label)}${keyStatus}`);
    if (info.free) console.log(`     ${t.dim(`Free: ${info.free}`)}`);
  });

  const choice = await rl.question(t.prompt('\n  Select [1-5] (default 4=ollama): '));
  const idx = Math.max(0, Math.min(4, parseInt(choice || '4') - 1));
  config.defaultProvider = providerKeys[idx];

  const prov = PROVIDERS[config.defaultProvider];
  if (prov.needsKey && !getApiKey(config, config.defaultProvider)) {
    console.log(t.dim(`\n  ${icons.key} ${prov.label} requires an API key.`));
    const key = await rl.question(t.prompt('  API key: '));
    if (key.trim()) config.keys[config.defaultProvider] = key.trim();
  }

  if (config.defaultProvider === 'ollama') {
    const url = await rl.question(t.prompt('  Ollama URL (default localhost:11434): '));
    if (url.trim()) config.ollamaUrl = url.trim();
    console.log(t.dim('\n  Models: deepseek-r1 · qwen2.5-coder · codellama · llama3.1 · mistral'));
    const model = await rl.question(t.prompt('  Model (default qwen2.5-coder:latest): '));
    if (model.trim()) config.defaultModel = model.trim();
  }

  console.log(t.bold('\n  Trust Level:\n'));
  console.log(`  1. ${t.warning('cautious')} — approve every action`);
  console.log(`  2. ${t.info('normal')}    — auto-approve reads, ask for writes`);
  console.log(`  3. ${t.success('trust')}     — auto-approve most things`);
  console.log(`  4. ${t.error('yolo')}      — auto-approve everything`);
  const trustChoice = await rl.question(t.prompt('  Level [1-4] (default 2): '));
  const trustLevels: TrustLevel[] = ['cautious', 'normal', 'trust', 'yolo'];
  config.trustLevel = trustLevels[Math.max(0, Math.min(3, parseInt(trustChoice || '2') - 1))];

  rl.close();
  saveConfig(config);
  console.log(t.success(`\n  ${icons.success} Saved to ~/.timps/config.json`));
  console.log(t.dim(`  ${config.defaultProvider} | ${config.trustLevel}\n`));
  return config;
}

export function getProjectId(projectPath: string): string {
  let hash = 0;
  for (let i = 0; i < projectPath.length; i++) {
    hash = ((hash << 5) - hash) + projectPath.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function getMemoryDir(projectPath: string): string {
  const dir = path.join(CONFIG_DIR, 'memory', getProjectId(projectPath));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getSnapshotDir(projectPath: string): string {
  const dir = path.join(CONFIG_DIR, 'snapshots', getProjectId(projectPath));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
