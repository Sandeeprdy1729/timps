import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { TimpsConfig, ProviderName, TrustLevel, TerminalBackend, TerminalConfig, ToolConfig, PlatformType, PlatformConfig, SetupResult } from './types.js';
import { t, icons, LOGO } from './theme.js';

const CONFIG_DIR = path.join(os.homedir(), '.timps');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: TimpsConfig = {
  defaultProvider: 'ollama',
  defaultModel: 'llama3.2:1b',
  trustLevel: 'normal',
  keys: {},
  ollamaUrl: 'http://localhost:11434',
  memoryEnabled: true,
  autoCorrect: true,
  maxContextTokens: 128000,
  mcpServers: [],
  thinkingEnabled: true,
  fastMode: false,
  verbose: false,
  migrationVersion: 2,
};

export function loadConfig(): TimpsConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...raw };
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
    deepseek: 'DEEPSEEK_API_KEY',
    groq: 'GROQ_API_KEY',
    hybrid: '',
  };
  const envKey = envMap[provider];
  return envKey ? process.env[envKey] || undefined : undefined;
}

const PROVIDERS: Record<ProviderName, { label: string; needsKey: boolean; free: string }> = {
  claude:     { label: 'Anthropic Claude',  needsKey: true,  free: '' },
  openai:     { label: 'OpenAI / GPT-4o',   needsKey: true,  free: '' },
  gemini:     { label: 'Google Gemini',     needsKey: true,  free: 'gemini-2.0-flash (15 RPM free tier)' },
  ollama:     { label: 'Ollama (local)',    needsKey: false, free: 'deepseek-r1, qwen2.5-coder, codellama' },
  openrouter: { label: 'OpenRouter',        needsKey: true,  free: 'deepseek-r1:free, gemini-flash:free' },
  deepseek:   { label: 'DeepSeek',          needsKey: true,  free: 'deepseek-coder-v2 (cheap)' },
  groq:       { label: 'Groq (fast)',       needsKey: true,  free: 'llama-3.1-70b-versatile' },
  hybrid:     { label: 'Hybrid Router',    needsKey: false, free: 'Routes to local for simple tasks' },
};

const DEFAULT_MODELS: Record<ProviderName, string> = {
  claude:     'claude-sonnet-4-20250514',
  openai:     'gpt-4o',
  gemini:     'gemini-2.0-flash',
  ollama:     'qwen2.5-coder:7b',
  openrouter: 'google/gemini-2.0-flash-exp:free',
  deepseek:   'deepseek-coder',
  groq:       'llama-3.1-70b-versatile',
  hybrid:     'auto',
};

export function getDefaultModel(provider: ProviderName): string {
  return DEFAULT_MODELS[provider] || 'unknown';
}

function envLabel(key: string): string {
  const names: Record<string, string> = {
    ANTHROPIC_API_KEY: 'Claude',
    OPENAI_API_KEY: 'OpenAI',
    GEMINI_API_KEY: 'Gemini',
    OPENROUTER_API_KEY: 'OpenRouter',
    DEEPSEEK_API_KEY: 'DeepSeek',
    GROQ_API_KEY: 'Groq',
    TELEGRAM_BOT_TOKEN: 'Telegram',
    SLACK_BOT_TOKEN: 'Slack',
    DISCORD_BOT_TOKEN: 'Discord',
    SEARXNG_API_KEY: 'SearXNG',
    GITHUB_TOKEN: 'GitHub',
    HF_TOKEN: 'HuggingFace',
  };
  return names[key] || key;
}

export async function runFullSetup(existing?: TimpsConfig): Promise<SetupResult> {
  const config: TimpsConfig = existing ? { ...existing } : { ...DEFAULT_CONFIG };
  const terminal: TerminalConfig = { backend: 'local' };
  const tools: ToolConfig = {
    webSearch: false, browser: false, terminal: true,
    fileOps: true, codeExecution: true, vision: false,
    imageGeneration: false, tts: false, skillsHub: false,
    computerUse: false,
  };
  const platform: PlatformConfig = { platform: 'none' };
  const envVars: Record<string, string> = {};

  const { radioMenu, checkboxMenu, confirmMenu } = await import('../utils/interactiveMenu.js');

  // ── Step 0: Logo ──
  console.log(LOGO);

  // ── Step 1: Welcome ──
  console.log(`\n  ${t.brandBold('Setup Wizard')}`);
  console.log(`  ${t.dim('Configure your AI coding agent — TIMPS Code')}\n`);
  console.log(`  ${t.dim('Use ↑↓ to navigate · ENTER/SPACE to select · ESC to skip')}\n`);

  // ── Step 2: Provider Selection ──
  const providerKeys = Object.keys(PROVIDERS) as ProviderName[];
  const provOptions = providerKeys.map(p => ({
    label: PROVIDERS[p].label,
    description: PROVIDERS[p].free || undefined,
    meta: (getApiKey(config, p) ? 'key set' : (PROVIDERS[p].needsKey ? 'needs key' : 'free')) as string | undefined,
  }));
  const provIdx = await radioMenu({ prompt: 'Select AI provider:', options: provOptions, defaultIndex: providerKeys.indexOf('ollama') });
  if (provIdx !== null) {
    config.defaultProvider = providerKeys[provIdx];
    const prov = PROVIDERS[config.defaultProvider];
    if (prov.needsKey && !getApiKey(config, config.defaultProvider)) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      console.log(t.dim(`\n  ${icons.key} ${prov.label} requires an API key.`));
      const key = await rl.question(t.prompt('  API key: '));
      rl.close();
      if (key.trim()) {
        config.keys[config.defaultProvider] = key.trim();
        envVars[getEnvVarForProvider(config.defaultProvider)] = key.trim();
      }
    }
    if (config.defaultProvider === 'ollama') {
      const { OLLAMA_CATEGORIES } = await import('../utils/ollamaModels.js');
      const { radioMenu } = await import('../utils/interactiveMenu.js');
      const catOptions = OLLAMA_CATEGORIES.map(c => ({
        label: c.label,
        description: c.description,
        icon: c.icon,
      }));
      catOptions.push({ label: 'Other (type manually)', icon: '✏️', description: 'enter a model name yourself' });
      let modelPicked = false;
      while (!modelPicked) {
        const catIdx = await radioMenu({ prompt: 'Select Ollama model category:', options: catOptions });
        if (catIdx === null) { config.defaultModel = getDefaultModel('ollama'); break; }
        if (catIdx >= OLLAMA_CATEGORIES.length) {
          const rl2 = readline.createInterface({ input: stdin, output: stdout });
          const manual = await rl2.question(t.prompt(`  Model name (e.g. qwen2.5-coder:7b): `));
          rl2.close();
          config.defaultModel = manual.trim() || getDefaultModel('ollama');
          modelPicked = true;
          break;
        }
        const category = OLLAMA_CATEGORIES[catIdx];
        const modelOptions: { label: string; description?: string; icon?: string }[] = category.models.map(m => ({
          label: m.name,
          description: m.description + (m.sizes ? ` [${m.sizes.join(', ')}]` : ''),
        }));
        modelOptions.push({ label: '← Back to categories', description: '' });
        modelOptions.push({ label: 'Other (type manually)', icon: '✏️', description: '' });
        const modIdx = await radioMenu({ prompt: `Select ${category.label} model:`, options: modelOptions });
        if (modIdx === null) continue;
        if (modIdx >= category.models.length) {
          if (modIdx === category.models.length) continue;
          const rl3 = readline.createInterface({ input: stdin, output: stdout });
          const manual = await rl3.question(t.prompt(`  Model name (e.g. qwen2.5-coder:7b): `));
          rl3.close();
          config.defaultModel = manual.trim() || getDefaultModel('ollama');
          modelPicked = true;
          break;
        }
        config.defaultModel = category.models[modIdx].name;
        modelPicked = true;
      }
      const { pullModel } = await import('../utils/ollamaSetup.js');
      console.log(`\n  ${t.dim(`Pulling ${config.defaultModel} from Ollama...`)}`);
      const pulled = await pullModel(config.defaultModel);
      if (!pulled) {
        console.log(`  ${t.warning('Model pull failed. You can pull it later with: ollama pull ' + config.defaultModel)}`);
      }
    } else {
      const defaultModel = getDefaultModel(config.defaultProvider);
      const rl = readline.createInterface({ input: stdin, output: stdout });
      const modelInput = await rl.question(t.prompt(`  Model [default: ${defaultModel}]: `));
      rl.close();
      config.defaultModel = modelInput.trim() || defaultModel;
    }
  }

  // ── Step 3: Trust Level ──
  const trustOptions = [
    { label: 'Cautious', description: 'approve every write/exec' },
    { label: 'Normal', description: 'auto-approve reads, prompt for writes' },
    { label: 'Trust', description: 'auto-approve most actions' },
    { label: 'YOLO', description: 'auto-approve everything (dangerous)' },
  ];
  const trustIdx = await radioMenu({ prompt: 'Select trust level:', options: trustOptions, defaultIndex: 1 });
  const trustLevels: TrustLevel[] = ['cautious', 'normal', 'trust', 'yolo'];
  if (trustIdx !== null) config.trustLevel = trustLevels[trustIdx];

  // ── Step 4: Terminal Backend ──
  const backendOptions = [
    { label: 'Local', description: 'run commands on your machine' },
    { label: 'Docker', description: 'run commands in a container' },
    { label: 'Modal', description: 'run commands on Modal serverless' },
    { label: 'SSH', description: 'run commands on a remote server' },
    { label: 'Daytona', description: 'run commands on Daytona dev environments' },
  ];
  const backendLabels: TerminalBackend[] = ['local', 'docker', 'modal', 'ssh', 'daytona'];
  const backendIdx = await radioMenu({ prompt: 'Select terminal backend:', options: backendOptions, defaultIndex: 0 });
  if (backendIdx !== null) {
    terminal.backend = backendLabels[backendIdx];
  }

  // ── Step 5: Tool Configuration ──
  const toolOptions = [
    { label: 'Web Search', description: 'search the web via DuckDuckGo / SearXNG' },
    { label: 'Browser', description: 'headless browser for web tasks' },
    { label: 'Terminal', description: 'run shell commands' },
    { label: 'File Operations', description: 'read/write/edit files on disk' },
    { label: 'Code Execution', description: 'run code in sandboxed environment' },
    { label: 'Vision', description: 'image analysis with vision models' },
    { label: 'Image Generation', description: 'generate images via AI models' },
    { label: 'Text-to-Speech', description: 'spoken output' },
    { label: 'Skills Hub', description: 'installable skill marketplace' },
    { label: 'Computer Use', description: 'GUI automation via screenshots + clicks' },
  ];
  const toolKeys: (keyof ToolConfig)[] = [
    'webSearch', 'browser', 'terminal', 'fileOps', 'codeExecution',
    'vision', 'imageGeneration', 'tts', 'skillsHub', 'computerUse',
  ];
  const initialChecks = toolKeys.map((k, i) => tools[k] ? i : -1).filter(i => i >= 0);
  const toolIdx = await checkboxMenu({ prompt: 'Select tools to enable (SPACE to toggle):', options: toolOptions, defaultChecked: initialChecks });
  if (toolIdx.length > 0) {
    for (const i of toolIdx) {
      if (i < toolKeys.length) (tools as any)[toolKeys[i]] = true;
    }
  }

  // ── Step 6: Platform Messaging ──
  const platformOptions = [
    { label: 'None', description: 'no messaging platform' },
    { label: 'Telegram', description: 'receive messages via Telegram bot' },
    { label: 'Slack', description: 'receive messages via Slack bot' },
    { label: 'Discord', description: 'receive messages via Discord bot' },
  ];
  const platformLabels: PlatformType[] = ['none', 'telegram', 'slack', 'discord'];
  const platIdx = await radioMenu({ prompt: 'Select messaging platform:', options: platformOptions, defaultIndex: 0 });
  if (platIdx !== null) {
    platform.platform = platformLabels[platIdx];
    if (platform.platform !== 'none') {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      const token = await rl.question(t.prompt(`  Bot token for ${platform.platform}: `));
      rl.close();
      if (token.trim()) {
        platform.token = token.trim();
        const envKey = platform.platform === 'telegram' ? 'TELEGRAM_BOT_TOKEN'
          : platform.platform === 'slack' ? 'SLACK_BOT_TOKEN'
          : 'DISCORD_BOT_TOKEN';
        envVars[envKey] = token.trim();
      }
    }
  }

  // ── Step 7: Additional API Keys ──
  const additional = await confirmMenu('Would you like to configure additional API keys?', false);
  if (additional) {
    const envKeys = [
      'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY',
      'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY',
      'SEARXNG_API_KEY', 'GITHUB_TOKEN', 'HF_TOKEN',
    ];
    const rl = readline.createInterface({ input: stdin, output: stdout });
    for (const ek of envKeys) {
      const existing = envVars[ek] || process.env[ek] || '';
      if (existing) continue;
      const val = await rl.question(t.prompt(`  ${envLabel(ek)} API key (leave blank to skip): `));
      if (val.trim()) envVars[ek] = val.trim();
    }
    rl.close();
  }

  // ── Step 8: Save .env File ──
  const envFile = path.join(CONFIG_DIR, '.env');
  if (Object.keys(envVars).length > 0) {
    const envContent = Object.entries(envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(envFile, envContent + '\n', 'utf-8');
    console.log(t.success(`\n  ${icons.success} Wrote ${Object.keys(envVars).length} env vars to ~/.timps/.env`));
  } else if (fs.existsSync(envFile)) {
    console.log(t.dim(`\n  ${icons.info} Using existing ~/.timps/.env`));
  }

  // ── Save config ──
  config.terminal = terminal;
  config.tools = tools;
  config.platform = platform;
  config.envFile = envFile;
  saveConfig(config);

  // ── Summary Report ──
  console.log(`\n${t.separatorDouble}`);
  console.log(`  ${t.brandBold('Setup Complete')}\n`);
  console.log(`  ${t.dim('Provider:')}     ${t.accent(config.defaultProvider)}`);
  console.log(`  ${t.dim('Model:')}        ${t.accent(config.defaultModel)}`);
  console.log(`  ${t.dim('Trust:')}        ${t.accent(config.trustLevel)}`);
  console.log(`  ${t.dim('Terminal:')}     ${t.accent(terminal.backend)}`);
  const enabledTools = toolKeys.filter(k => (tools as any)[k]);
  console.log(`  ${t.dim('Tools:')}        ${t.accent(enabledTools.length + ' of ' + toolKeys.length)} enabled`);
  console.log(`  ${t.dim('Messaging:')}    ${t.accent(platform.platform !== 'none' ? platform.platform : 'none')}`);
  console.log(`  ${t.dim('Config:')}       ${t.file(CONFIG_FILE)}`);
  console.log(`  ${t.dim('Env file:')}     ${t.file(envFile)}`);
  console.log(t.separatorDouble);
  console.log();

  return { config, terminal, tools, platform, envVars };
}

export async function runSetupWizard(existing?: TimpsConfig): Promise<TimpsConfig> {
  const result = await runFullSetup(existing);
  return result.config;
}

function getEnvVarForProvider(provider: ProviderName): string {
  const map: Record<ProviderName, string> = {
    claude: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    ollama: '',
    openrouter: 'OPENROUTER_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    groq: 'GROQ_API_KEY',
    hybrid: '',
  };
  return map[provider] || '';
}

export function getProjectId(projectPath: string): string {
  // Derive a stable project ID from the folder name
  return path.basename(path.resolve(projectPath)).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

export function getMemoryDir(projectPath: string): string {
  const id = hashProject(projectPath);
  const dir = path.join(CONFIG_DIR, 'memory', id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getSnapshotDir(projectPath: string): string {
  const id = hashProject(projectPath);
  const dir = path.join(CONFIG_DIR, 'snapshots', id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getHistoryDir(): string {
  const dir = path.join(CONFIG_DIR, 'history');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function hashProject(p: string): string {
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}
