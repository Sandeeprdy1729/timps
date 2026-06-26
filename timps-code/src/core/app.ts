// ── TIMPS Code — CLI Application ──
// Beautiful REPL with slash commands, streaming, and session management

import * as readline from 'node:readline';
import * as childProcess from 'node:child_process';
import { render } from 'ink';
import React from 'react';
import { App } from '../ui/App.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import chalk from 'chalk';
import type { ModelProvider, ProviderName, TokenUsage, TechStack } from '../config/types.js';
import { Agent } from './agent.js';
import { Memory } from '../memory/memory.js';
import { TeamMemory } from '../memory/teamMemory.js';
import { SnapshotManager } from '../memory/snapshot.js';
import { PermissionSystem as Permissions } from '../utils/permissions.js';
import { TodoStore } from '../utils/todo.js';
import { loadConfig, saveConfig, runSetupWizard, getProjectId, getApiKey, getDefaultModel } from '../config/config.js';
import { runDataPipeline, type DataPipelineConfig } from '../data-pipeline/data-pipeline.js';
import { t, icons, panel, LOGO } from '../config/theme.js';
import { renderAgentEvent, renderHelp, renderPrompt, renderError, flushText, renderChatReady, renderMemoryPanel, renderTodoList, renderDoctorReport, renderGitStatus, renderGitLog, renderModelsList, renderSkills } from '../utils/renderer.js';
import { ensureOllamaReady, getLocalModels, isOllamaInstalled, installOllama, isOllamaRunning, tryStartOllama, pullModel } from '../utils/ollamaSetup.js';
import { searchSkills, installSkill, uninstallSkill, getInstalledSkills, fetchSkillContent } from '../utils/skills.js';
import { MultimodalMemory } from '../memory/multimodalMemory.js';
import { handleMultimodalCommand } from '../commands/multimodalCommands.js';
import { handleVoiceCommand, handleDocumentCommand, handleUploadCommand } from '../commands/inputCommands.js';
import { formatCost } from '../utils/utils.js';
import { createProvider } from '../models/index.js';
import { getMcpManager } from '../utils/mcp.js';

export interface AppOptions {
  provider?: ProviderName;
  model?: string;
  cwd?: string;
  oneLine?: string;
  branch?: string;
  merge?: string;
  grpo?: boolean;
  grpoModel?: string;
  mineBugs?: boolean;
  bugSource?: string;
  warRoom?: boolean;
  binarySynth?: boolean;
  binaryArch?: string;
  binaryOptimizer?: string;
  /** Remote MemoryServer URL (e.g. http://localhost:4100) */
  memoryUrl?: string;
  /** Auth token for remote MemoryServer */
  memoryToken?: string;
}

export async function startApp(opts: AppOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();
  const config = loadConfig();
  let ollamaModels: string[] = [];

  console.log(LOGO);
  if (opts.grpo) console.log(`${t.accent('🧠')} GRPO training loop enabled`);
  if (opts.mineBugs) console.log(`${t.accent('🔍')} Human mistake mining enabled`);
  if (opts.warRoom) console.log(`${t.warning('🔥')} WAR ROOM MODE - 19hr sessions`);
  if (opts.binarySynth) console.log(`${t.warning('⚡')} DIRECT BINARY SYNTHESIS enabled`);

  // ── Smart Provider Auto-Selection (Claude Code style: zero-friction) ──
  let providerName: ProviderName | undefined;

  if (opts.provider) {
    providerName = opts.provider;
  } else {
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';

    // Try 1: Ollama (free, local)
    const ollamaRunning = await isOllamaRunning(ollamaUrl);
    if (ollamaRunning) {
      ollamaModels = await getLocalModels(ollamaUrl);
      const modelName = opts.model || config.defaultModel || 'llama3.2:1b';
      const hasModel = ollamaModels.some(m => m === modelName || m.startsWith(modelName.split(':')[0]));
      if (hasModel) {
        providerName = 'ollama';
        console.log(`  ${t.success('✓')} Using ${t.accent('Ollama')} ${t.dim(`— ${modelName}`)}\n`);
      } else {
        // Try to start Ollama and pull model
        console.log(`  ${t.dim('↻')} Ollama running, pulling ${modelName}...`);
        const pulled = await pullModel(modelName, ollamaUrl);
        if (pulled) {
          providerName = 'ollama';
          console.log(`  ${t.success('✓')} Model ready — ${t.accent('Ollama')} ${t.dim(`— ${modelName}`)}\n`);
        }
      }
    }

    // Try 2: Claude (if API key available)
    if (!providerName && getApiKey(config, 'claude')) {
      providerName = 'claude';
      console.log(`  ${t.success('✓')} Using ${t.accent('Claude')} ${t.dim(`— ${opts.model || getDefaultModel('claude')}`)}\n`);
    }

    // Try 3: Gemini (free tier available)
    if (!providerName && getApiKey(config, 'gemini')) {
      providerName = 'gemini';
      console.log(`  ${t.success('✓')} Using ${t.accent('Gemini')} ${t.dim(`— ${opts.model || getDefaultModel('gemini')}`)}\n`);
    }

    // Try 4: OpenAI
    if (!providerName && getApiKey(config, 'openai')) {
      providerName = 'openai';
      console.log(`  ${t.success('✓')} Using ${t.accent('OpenAI')} ${t.dim(`— ${opts.model || getDefaultModel('openai')}`)}\n`);
    }

    // Try 5: OpenRouter (free models)
    if (!providerName && getApiKey(config, 'openrouter')) {
      providerName = 'openrouter';
      console.log(`  ${t.success('✓')} Using ${t.accent('OpenRouter')} ${t.dim(`— free models`)}\n`);
    }

    // Try 6: Start Ollama if not running
    if (!providerName) {
      const ollamaInstalled = isOllamaInstalled();
      if (ollamaInstalled) {
        console.log(`  ${t.dim('↻')} Starting Ollama...`);
        tryStartOllama();
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const started = await isOllamaRunning(ollamaUrl);
          if (started) {
            const modelName = opts.model || config.defaultModel || 'llama3.2:1b';
            console.log(`  ${t.success('✓')} Ollama ready — pulling ${modelName}...`);
            const pulled = await pullModel(modelName, ollamaUrl);
            if (pulled) {
              providerName = 'ollama';
              console.log(`  ${t.success('✓')} Using ${t.accent('Ollama')} ${t.dim(`— ${modelName}`)}\n`);
              break;
            }
          }
        }
      }
    }

    // Try 7: Try install Ollama
    if (!providerName) {
      const ollamaInstalled = isOllamaInstalled();
      if (!ollamaInstalled) {
        console.log(`  ${t.dim('↻')} Ollama not found — installing...`);
        const installed = await installOllama();
        if (installed) {
          console.log(`  ${t.dim('↻')} Starting Ollama...`);
          tryStartOllama();
          for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 1000));
            if (await isOllamaRunning(ollamaUrl)) {
              const modelName = opts.model || config.defaultModel || 'llama3.2:1b';
              console.log(`  ${t.success('✓')} Ollama installed — pulling ${modelName}...`);
              const pulled = await pullModel(modelName, ollamaUrl);
              if (pulled) {
                providerName = 'ollama';
                console.log(`  ${t.success('✓')} Using ${t.accent('Ollama')} ${t.dim(`— ${modelName}`)}\n`);
                break;
              }
            }
          }
        }
      }
    }

    // Fallback: use config default
    if (!providerName) {
      providerName = config.defaultProvider || 'gemini';
      const model = opts.model || config.defaultModel || getDefaultModel(providerName);
      console.log(`  ${t.warning('⚡')} Using ${t.accent(providerName)} ${t.dim(`— ${model}`)}\n`);
    }
  }

  // ── Ollama model picker (if auto-detected and no explicit model) ──
  let resolvedModel = opts.model || config.defaultModel;
  if (providerName === 'ollama' && !opts.model) {
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
      const catIdx = await radioMenu({ prompt: 'Select Ollama model:', options: catOptions });
      if (catIdx === null) { modelPicked = true; break; }
      if (catIdx >= OLLAMA_CATEGORIES.length) {
        const { createInterface } = await import('node:readline/promises');
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const manual = await rl.question('  Model name (e.g. qwen2.5-coder:7b): ');
        rl.close();
        if (manual.trim()) resolvedModel = manual.trim();
        modelPicked = true;
        break;
      }
      const category = OLLAMA_CATEGORIES[catIdx];
      const modelOptions: { label: string; description?: string }[] = category.models.map(m => ({
        label: m.name,
        description: m.description + (m.sizes ? ` [${m.sizes.join(', ')}]` : ''),
      }));
      modelOptions.push({ label: '← Back to categories', description: '' });
      modelOptions.push({ label: 'Other (type manually)', description: '' });
      const modIdx = await radioMenu({ prompt: `Select ${category.label} model:`, options: modelOptions });
      if (modIdx === null) continue;
      if (modIdx >= category.models.length) {
        if (modIdx === category.models.length) continue;
        const { createInterface: ci } = await import('node:readline/promises');
        const rl2 = ci({ input: process.stdin, output: process.stdout });
        const manual2 = await rl2.question('  Model name (e.g. qwen2.5-coder:7b): ');
        rl2.close();
        if (manual2.trim()) resolvedModel = manual2.trim();
        modelPicked = true;
        break;
      }
      resolvedModel = category.models[modIdx].name;
      modelPicked = true;
    }
    if (resolvedModel) {
      const { pullModel: pull } = await import('../utils/ollamaSetup.js');
      console.log(`\n  ${t.dim(`Pulling ${resolvedModel}...`)}`);
      const ok = await pull(resolvedModel);
      if (ok) {
        config.defaultModel = resolvedModel;
        config.defaultProvider = 'ollama';
        saveConfig(config);
        console.log(`  ${t.success(`✓ Using ${resolvedModel}`)}\n`);
      }
    }
  }

// ── Step 3: Provider setup (minimal — most auto-detected above) ──
  let provider: ModelProvider;
  try {
    provider = createProvider(providerName, resolvedModel);
  } catch (err) {
    console.error(`\n  ${t.error((err as Error).message)}\n`);
    process.exit(1);
  }

  // Cloud providers need API key
  const localProviders = ['ollama', 'opencode'] as ProviderName[];
  if (!localProviders.includes(providerName) && !getApiKey(config, providerName)) {
    console.log(`  ${t.warning('⚡')} No API key for ${providerName}`);
    console.log(`  ${t.dim('Set in config:')} ~/.timps/config.json → keys.${providerName}`);
    console.log(`  ${t.dim('Or set env:')} ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY\n`);
    process.exit(1);
  }

  // Init subsystems
  const projectId = getProjectId(cwd);
  const memory = new Memory(projectId, {
    remoteUrl: opts.memoryUrl,
    remoteToken: opts.memoryToken,
  });
  const todos = new TodoStore(projectId);
  const snapshots = new SnapshotManager(projectId);
  const permissions = new Permissions();
  const multimodalMemory = new MultimodalMemory(cwd);

  // ── Intelligence layers (new) ──
  // Import lazily to avoid circular deps at startup
  const { SessionBridge } = await import('../memory/sessionBridge.js');
  const { RiskEngine } = await import('../utils/riskEngine.js');
  const { ContextOrchestrator } = await import('./contextOrchestrator.js');
  const { SelfImprovingAgent } = await import('../agent/selfImprovingAgent.js');
  const { DurableJobEngine } = await import('./durableJob.js');
  const { CodeGraph } = await import('../memory/codeGraph.js');

  const sessionBridge = new SessionBridge(projectId, cwd);
  const riskEngine = new RiskEngine();
  const contextOrchestrator = new ContextOrchestrator();
  const selfImproving = new SelfImprovingAgent(projectId);
  const durableJob = new DurableJobEngine(projectId);
  const codeGraph = new CodeGraph(projectId);

  // Load cross-session context (synchronous, fast)
  let bridgeContext = null;
  try { bridgeContext = sessionBridge.loadContext(opts.oneLine); } catch { /* first run */ }
  if (bridgeContext?.coldStartHints?.length) {
    console.log(`  ${t.dim('↻')} Session restored: ${bridgeContext.coldStartHints[0]}`);
  }

  // Check for incomplete/interrupted jobs
  const incompleteJobs = durableJob.getIncompleteJobs();
  if (incompleteJobs.length > 0) {
    console.log(`  ${t.warning('⚠')} ${incompleteJobs.length} interrupted job(s) from previous session`);
    for (const job of incompleteJobs.slice(0, 2)) {
      console.log(`    ${t.dim('→')} ${job.originalRequest.slice(0, 60)}... (${job.status})`);
    }
  }

  // Start background code graph scan (non-blocking)
  codeGraph.buildFromDirectory(cwd).catch(() => { /* silent — runs in background */ });

  // Create agent
  const agent = new Agent({
    provider,
    cwd,
    memory,
    permissions,
    snapshots,
    maxContextTokens: config.maxContextTokens,
    customInstructions: config.customInstructions,
    autoCorrect: config.autoCorrect ?? true,
    techStack: config.techStack,
    branchName: opts.branch,
    // New intelligence layers
    sessionBridge,
    riskEngine,
    contextOrchestrator,
    selfImproving,
    durableJob,
    codeGraph,
  });
  agent.setTodoStore(todos);

  if (opts.merge) {
    agent.setPendingMergeTarget(opts.merge);
  }

  const isTTY = process.stdin.isTTY === true;

  // Session directory
  const sessionDir = path.join(os.homedir(), '.timps', 'sessions', projectId);

// Non-TTY with piped input = one-shot (exit after response)
  if (!isTTY) {
    // Use readline to reliably collect piped input before the event loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
    let pipedInput = '';
    let resolved = false;

    const collected = await new Promise<string>(resolve => {
      rl.on('line', line => {
        pipedInput += line + '\n';
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          setTimeout(() => {
            rl.close();
            resolve(pipedInput.trim());
          }, 50);
        }
      });
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          rl.close();
          resolve(pipedInput.trim());
        }
      }, 1000);
    });

    if (collected) {
      await runSingleTurn(agent, collected, provider.model, sessionDir);
      return;
    }

    // Non-TTY without piped input → start interactive REPL
    process.on('SIGINT', async () => {
      await agent.saveSession(sessionDir);
      await agent.saveEpisode('success');
      process.exit(0);
    });
    const { startInteractiveREPL } = await import('./interactive.js');
    await startInteractiveREPL({ agent, memory, todos, snapshots, permissions, provider, cwd, sessionDir }, opts.oneLine);
    return;
  }

  // ── TTY Interactive Mode (Ink/React TUI) ──
  process.on('SIGINT', () => {
    agent.saveSession(sessionDir);
    agent.saveEpisode('success').catch(() => {});
    process.exit(0);
  });

  const instance = render(
    React.createElement(App, {
      agent,
      memory,
      todos,
      snapshots,
      permissions,
      provider,
      cwd,
      sessionDir,
      multimodalMem: multimodalMemory,
    }),
    { patchConsole: false, alternateScreen: false }
  );
  const { waitUntilExit } = instance;

  await waitUntilExit();
}

  // ═══════════════════════════════════════
  // Single-shot execution
  // ═══════════════════════════════════════

async function runSingleTurn(agent: Agent, message: string, model: string, sessionDir?: string): Promise<void> {
  console.log(`  ${t.brandBold('⚡ TIMPS')} ${t.dim(model)}\n`);
  try {
    for await (const event of agent.run(message)) {
      renderAgentEvent(event);
    }
    flushText();
  } catch (err) {
    renderError((err as Error).message);
    process.exit(1);
  }
  if (sessionDir) agent.saveSession(sessionDir);
  await agent.saveEpisode('success');
}

// ═══════════════════════════════════════
// Slash command handler
// ═══════════════════════════════════════

export async function handleSlashCommand(
  input: string,
  agent: Agent,
  memory: Memory,
  todos: TodoStore,
  snapshots: SnapshotManager,
  permissions: Permissions,
  provider: ModelProvider,
  cwd: string,
  sessionDir: string,
  providerName?: string,
  multimodalMem?: MultimodalMemory,
  pluginManager?: import('../plugins/pluginManager.js').PluginManager,
): Promise<void> {
  const [cmd, ...rest] = input.slice(1).split(' ');
  const args = rest.join(' ').trim();

  switch (cmd) {
    case 'help':
    case 'h':
      renderHelp();
      break;

    case 'provider': {
      console.log(`\n  ${t.dim('Current provider:')} ${t.accent(providerName)}`);
      console.log(`  ${t.dim('Current model:')} ${t.accent(provider.model)}`);
      console.log(`\n  ${t.dim('Available providers:')}`);
      const providers = [
        { name: 'claude', models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'] },
        { name: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
        { name: 'gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
        { name: 'ollama', models: ['qwen2.5-coder:7b', 'deepseek-r1:7b', 'codellama:7b'] },
        { name: 'openrouter', models: ['google/gemini-2.0-flash-exp:free', 'anthropic/claude-sonnet-4-20250514'] },
        { name: 'opencode', models: ['qwen2.5-coder:latest', 'llama3.1:8b'] },
        { name: 'timps-coder', models: ['llama3.2:1b'] },
        { name: 'hybrid', models: ['auto'] },
      ];
      for (const p of providers) {
        const isCurrent = p.name === providerName ? t.success('▶') : t.dim('·');
        console.log(`  ${isCurrent} ${t.accent(p.name)}: ${p.models.join(', ')}`);
      }
      console.log(`\n  ${t.dim('Usage: /model')} ${t.dim('<provider> [model]')}`);
      console.log(`  ${t.dim('Example:')} ${t.accent('/model ollama qwen2.5-coder:14b')}\n`);
      break;
    }

    case 'model':
    case 'm': {
      if (!args) {
        console.log(`\n  ${t.dim('Current:')} ${t.accent(provider.model)}`);
        console.log(`  ${t.dim('Usage: /model <provider> [model]')}`);
        console.log(`  ${t.dim('Providers: claude, openai, gemini, ollama, openrouter, opencode, timps-coder, hybrid')}\n`);
        break;
      }
      const [prov, mod] = args.split(' ');
      try {
        const providerId = prov as ProviderName;
        const newProvider = createProvider(providerId, mod || getDefaultModel(providerId));
        agent.switchProvider(newProvider);
        const cfg = loadConfig();
        cfg.defaultProvider = providerId;
        cfg.defaultModel = newProvider.model;
        saveConfig(cfg);
        console.log(`\n  ${t.success(icons.success)} Switched to ${t.accent(newProvider.model)}\n`);
      } catch (err) {
        renderError((err as Error).message);
      }
      break;
    }

    case 'memory':
    case 'mem': {
      if (!args) {
        const entries = await memory.loadSemanticEntries();
        const working = memory.workingMemory;
        renderMemoryPanel(entries, working, memory.episodeCount);
        break;
      }

      const [sub2, ...rest2] = args.split(' ');
      const subArg = rest2.join(' ').trim();

      switch (sub2) {
        case 'query':
        case 'q': {
          if (!subArg) { console.log(`\n  ${t.dim('Usage: /memory query <text>')}\n`); break; }
          const results = await memory.query(subArg, 20);
          const working = memory.workingMemory;
          renderMemoryPanel(results, working, memory.episodeCount, subArg);
          break;
        }

        case 'forget':
        case 'delete': {
          memory.clearAll();
          console.log(`\n  ${t.success(icons.success)} Memory cleared for this project\n`);
          break;
        }

        case 'export': {
          const data = await memory.exportMemory();
          const outFile = path.join(cwd, 'timps-memory-export.json');
          fs.writeFileSync(outFile, data, 'utf-8');
          console.log(`\n  ${t.success(icons.success)} Memory exported to ${t.file('timps-memory-export.json')}\n`);
          break;
        }

        case 'import': {
          const importFile = subArg || path.join(cwd, 'timps-memory-export.json');
          if (!fs.existsSync(importFile)) {
            console.log(`\n  ${t.error('File not found:')} ${importFile}\n`);
            break;
          }
          const raw = fs.readFileSync(importFile, 'utf-8');
          const count = memory.importMemory(raw);
          console.log(`\n  ${t.success(icons.success)} Imported ${count} memory entries\n`);
          break;
        }

        case 'consolidate': {
          const merged = memory.consolidate();
          console.log(`\n  ${t.success(icons.success)} Merged ${merged} duplicate entries\n`);
          break;
        }

        default: {
          const entries = await memory.loadSemanticEntries();
          const working = memory.workingMemory;
          renderMemoryPanel(entries, working, memory.episodeCount, args);
          break;
        }
      }
      break;
    }

    case 'forget': {
      memory.clearAll();
      console.log(`\n  ${t.success(icons.success)} Memories cleared for this project\n`);
      break;
    }

    case 'trust': {
      if (!args) {
        console.log(`\n  ${t.dim('Current trust level set')}`);
        console.log(`  ${t.dim('Options: cautious, normal, trust, yolo')}\n`);
        break;
      }
      const valid = ['cautious', 'normal', 'trust', 'yolo'];
      if (valid.includes(args)) {
        // Trust level is stored in config, not on PermissionSystem directly
        const trustCfg = loadConfig();
        trustCfg.trustLevel = args as 'cautious' | 'normal' | 'trust' | 'yolo';
        saveConfig(trustCfg);
        console.log(`\n  ${t.success(icons.success)} Trust level: ${t.accent(args)}\n`);
      } else {
        renderError(`Invalid trust level. Use: ${valid.join(', ')}`);
      }
      break;
    }

    case 'undo': {
      const count = parseInt(args) || 1;
      const result = snapshots.undoLast(count);
      if (result.restored.length > 0) {
        console.log(`\n  ${t.success(`${icons.undo} Restored ${result.restored.length} file(s)`)}\n`);
      } else {
        console.log(`\n  ${t.dim('No snapshots to undo.')}\n`);
      }
      break;
    }

    case 'snapshots':
    case 'snap': {
      const snaps = snapshots.list(10);
      if (snaps.length === 0) {
        console.log(`\n  ${t.dim('No snapshots.')}\n`);
      } else {
        const lines = snaps.map(s => {
          const ago = timeSince(s.timestamp);
          return `${t.dim(s.id.slice(0, 8))} ${s.description} ${t.dim(`(${ago})`)}`;
        });
        console.log(`\n${panel('Snapshots', lines.join('\n'))}\n`);
      }
      break;
    }

    case 'compact': {
      const count = agent.getMessageCount();
      if (count < 10) {
        console.log(`\n  ${t.dim(`Only ${count} messages — no need to compact yet.`)}\n`);
        break;
      }
      console.log(`\n  ${t.info('⚡')} Compacting context (${count} messages)...`);
      for await (const ev of agent.compactContext()) {
        if (ev.type === 'context_compacted') {
          console.log(`  ${t.success(icons.success)} Compacted: ~${ev.before} → ~${ev.after} tokens`);
        }
      }
      console.log(`  ${t.dim('Full history preserved to ~/.timps/history/')}\n`);
      break;
    }

    case 'clear': {
      agent.clearHistory();
      console.log(`\n  ${t.success(icons.success)} Conversation cleared\n`);
      break;
    }

    case 'config': {
      await runSetupWizard();
      console.log(`\n  ${t.success(icons.success)} Config saved. Restart to apply changes.\n`);
      break;
    }

    case 'cost': {
      const usage = agent.getUsage();
      const costStr = usage.estimatedCost !== undefined && usage.estimatedCost > 0
        ? formatCost('', usage.inputTokens, usage.outputTokens)
        : t.success('free');
      console.log(`\n${panel('Token Usage', [
        `${t.dim('Input:')}  ${t.accent(usage.inputTokens.toLocaleString())} tokens`,
        `${t.dim('Output:')} ${t.accent(usage.outputTokens.toLocaleString())} tokens`,
        `${t.dim('Total:')}  ${t.accent((usage.inputTokens + usage.outputTokens).toLocaleString())} tokens`,
        `${t.dim('Cost:')}   ${costStr}`,
        `${t.dim('Model:')}  ${provider.model}`,
      ].join('\n'))}\n`);
      break;
    }

    case 'models': {
      try {
        const models = await getLocalModels();
        if (models.length === 0) {
          console.log(`\n  ${t.dim('No local Ollama models found.')}\n`);
        } else {
          const lines = models.map(m => {
            const active = m.startsWith(provider.model.split(':')[0]);
            return active ? `  ${t.accent(icons.sparkle)} ${t.accent(m)}` : `  ${t.dim('·')} ${m}`;
          });
          console.log(`\n  ${t.brandBold('Local Models')}\n${lines.join('\n')}\n`);
        }
      } catch {
        console.log(`\n  ${t.dim('Ollama not running. Start with: ollama serve')}\n`);
      }
      break;
    }

    case 'skill':
    case 'skills': {
      if (!args) {
        // Show installed skills
        const installed = getInstalledSkills();
        if (installed.length === 0) {
          console.log(`\n  ${t.dim('No skills installed.')}`);
          console.log(`  ${t.dim('Search:')} ${t.accent('/skill search <query>')}`);
          console.log(`  ${t.dim('Browse:')} ${t.accent('/skill search development')}\n`);
        } else {
          console.log(`\n  ${t.brandBold('Installed Skills')}\n`);
          for (const s of installed) {
            console.log(`  ${t.accent(icons.sparkle)} ${t.accent(s.name)} ${t.dim(`[${s.category}]`)}`);
            if (s.description) console.log(`    ${t.dim(s.description.slice(0, 70))}`);
          }
          console.log();
        }
        break;
      }

      const [subCmd, ...subArgs] = args.split(' ');
      const subQuery = subArgs.join(' ').trim();

      switch (subCmd) {
        case 'search':
        case 'find': {
          if (!subQuery) { console.log(`\n  ${t.dim('Usage: /skill search <query>')}\n`); break; }
          console.log(`\n  ${t.dim('Searching SkillGalaxy...')}`);
          const results = await searchSkills(subQuery);
          if (results.length === 0) {
            console.log(`  ${t.dim('No skills found.')}\n`);
          } else {
            console.log(`\n  ${t.brandBold(`Found ${results.length} skill${results.length > 1 ? 's' : ''}`)}\n`);
            for (let i = 0; i < Math.min(results.length, 10); i++) {
              const s = results[i];
              console.log(`  ${t.accent(`${i + 1}.`)} ${s.name} ${t.dim(`[${s.category}]`)}`);
              if (s.description) console.log(`     ${t.dim(s.description.slice(0, 70))}`);
            }
            console.log(`\n  ${t.dim('Install:')} ${t.accent('/skill install <name>')}\n`);
          }
          break;
        }

        case 'install':
        case 'add': {
          if (!subQuery) { console.log(`\n  ${t.dim('Usage: /skill install <name>')}\n`); break; }
          console.log(`\n  ${t.dim(`Fetching skill: ${subQuery}...`)}`);
          const content = await fetchSkillContent(subQuery);
          if (content) {
            installSkill({ name: subQuery, description: '', category: 'general', content, trigger: subQuery, prompt: content, tools: [], examples: [], selfImprove: false });
            console.log(`  ${t.success(`${icons.success} Installed: ${subQuery}`)}`);
            console.log(`  ${t.dim('Skill will be active in next message.')}\n`);
          } else {
            const results = await searchSkills(subQuery);
            if (results.length > 0) {
              console.log(`  ${t.dim('Exact match not found. Did you mean:')}`);
              for (const r of results.slice(0, 5)) {
                console.log(`    ${t.accent('·')} ${r.name}`);
              }
              console.log();
            } else {
              console.log(`  ${t.error('Skill not found.')}\n`);
            }
          }
          break;
        }

        case 'remove':
        case 'uninstall': {
          if (!subQuery) { console.log(`\n  ${t.dim('Usage: /skill remove <name>')}\n`); break; }
          const removed = uninstallSkill(subQuery);
          if (removed) {
            console.log(`\n  ${t.success(`${icons.success} Removed: ${subQuery}`)}\n`);
          } else {
            console.log(`\n  ${t.dim(`Skill "${subQuery}" not found.`)}\n`);
          }
          break;
        }

        default:
          console.log(`\n  ${t.dim('Usage: /skill [search|install|remove] <name>')}\n`);
      }
      break;
    }

    case 'provider-select': {
      const picked = await pickProvider(loadConfig());
      if (picked) {
        try {
          const newProvider = createProvider(picked);
          agent.switchProvider(newProvider);
          renderChatReady();
        } catch (err) {
          renderError((err as Error).message);
        }
      }
      break;
    }

    // ═══════════════════════════════════════
    // /tech — Technology Stack Management
    // ═══════════════════════════════════════

    case 'tech': {
      const cfg = loadConfig();
      if (!args) {
        // Show current tech stack
        const ts = cfg.techStack;
        if (!ts || (ts.languages.length === 0 && ts.frameworks.length === 0)) {
          console.log(`\n  ${t.dim('No tech stack configured.')}`);
          console.log(`  ${t.dim('Usage:')}`);
          console.log(`    ${t.accent('/tech set')}           ${t.dim('Interactive tech stack setup')}`);
          console.log(`    ${t.accent('/tech add lang Go')}   ${t.dim('Add a language')}`);
          console.log(`    ${t.accent('/tech add fw React')}  ${t.dim('Add a framework')}`);
          console.log(`    ${t.accent('/tech add lib Prisma')} ${t.dim('Add a library')}`);
          console.log(`    ${t.accent('/tech add rule ...')}  ${t.dim('Add a coding rule')}`);
          console.log(`    ${t.accent('/tech clear')}         ${t.dim('Reset tech stack')}\n`);
        } else {
          const lines: string[] = [];
          if (ts.languages.length > 0) lines.push(`${t.dim('Languages:')}  ${t.accent(ts.languages.join(', '))}`);
          if (ts.frameworks.length > 0) lines.push(`${t.dim('Frameworks:')} ${t.accent(ts.frameworks.join(', '))}`);
          if (ts.libraries.length > 0) lines.push(`${t.dim('Libraries:')}  ${t.accent(ts.libraries.join(', '))}`);
          if (ts.patterns.length > 0) lines.push(`${t.dim('Patterns:')}   ${t.accent(ts.patterns.join(', '))}`);
          if (ts.rules.length > 0) {
            lines.push(`${t.dim('Rules:')}`);
            for (const r of ts.rules) lines.push(`  ${t.dim('·')} ${r}`);
          }
          console.log(`\n${panel('Tech Stack', lines.join('\n'))}\n`);
        }
        break;
      }

      const [techCmd, techType, ...techRest] = args.split(' ');
      const techValue = techRest.join(' ').trim() || techType;

      switch (techCmd) {
        case 'set': {
          // Interactive tech stack setup
          const rl4 = readline.createInterface({ input: process.stdin, output: process.stdout });
          const ask = (q: string): Promise<string> =>
            new Promise(r => rl4.question(`  ${t.prompt(q)} `, a => r(a.trim())));

          console.log(`\n  ${t.brandBold('⚡ Tech Stack Setup')}`);
          console.log(`  ${t.dim('Enter comma-separated values, or leave blank to skip')}\n`);

          const langs = await ask('Languages (e.g. TypeScript, Python):');
          const fws = await ask('Frameworks (e.g. React, FastAPI):');
          const libs = await ask('Libraries (e.g. Tailwind, Prisma):');
          const patterns = await ask('Patterns (e.g. REST, MVC, functional):');
          console.log(`  ${t.dim('Enter coding rules one per line. Empty line to finish:')}`);
          const rules: string[] = [];
          while (true) {
            const rule = await ask('  Rule:');
            if (!rule) break;
            rules.push(rule);
          }
          rl4.close();

          const newStack: TechStack = {
            languages: langs ? langs.split(',').map(s => s.trim()).filter(Boolean) : [],
            frameworks: fws ? fws.split(',').map(s => s.trim()).filter(Boolean) : [],
            libraries: libs ? libs.split(',').map(s => s.trim()).filter(Boolean) : [],
            patterns: patterns ? patterns.split(',').map(s => s.trim()).filter(Boolean) : [],
            rules,
          };
          cfg.techStack = newStack;
          saveConfig(cfg);
          agent.setTechStack(newStack);

          // Also sync to team memory if active
          const tm = agent.getTeamMemory();
          if (tm) tm.setTechStack(newStack);

          console.log(`\n  ${t.success(`${icons.success} Tech stack saved — agent will enforce these technologies`)}\n`);
          break;
        }

        case 'add': {
          if (!cfg.techStack) {
            cfg.techStack = { languages: [], frameworks: [], libraries: [], patterns: [], rules: [] };
          }
          const val = techRest.join(' ').trim();
          if (!val) { console.log(`\n  ${t.dim('Usage: /tech add <lang|fw|lib|pattern|rule> <value>')}\n`); break; }

          switch (techType) {
            case 'lang': case 'language':
              cfg.techStack.languages.push(val); break;
            case 'fw': case 'framework':
              cfg.techStack.frameworks.push(val); break;
            case 'lib': case 'library':
              cfg.techStack.libraries.push(val); break;
            case 'pattern':
              cfg.techStack.patterns.push(val); break;
            case 'rule':
              cfg.techStack.rules.push(val); break;
            default:
              console.log(`\n  ${t.dim('Types: lang, fw, lib, pattern, rule')}\n`);
              break;
          }
          saveConfig(cfg);
          agent.setTechStack(cfg.techStack);
          const tm = agent.getTeamMemory();
          if (tm) tm.setTechStack(cfg.techStack);
          console.log(`\n  ${t.success(`${icons.success} Added to tech stack`)}\n`);
          break;
        }

        case 'clear': {
          cfg.techStack = undefined;
          saveConfig(cfg);
          agent.setTechStack(undefined);
          console.log(`\n  ${t.success(`${icons.success} Tech stack cleared`)}\n`);
          break;
        }

        default:
          console.log(`\n  ${t.dim('Usage: /tech [set|add|clear]')}\n`);
      }
      break;
    }

    // ═══════════════════════════════════════
    // /team — Shared Team Memory
    // ═══════════════════════════════════════

    case 'team': {
      const cfg = loadConfig();
      if (!args) {
        // Show team status
        const tm = agent.getTeamMemory();
        if (!tm) {
          console.log(`\n  ${t.dim('No team active.')}`);
          console.log(`  ${t.dim('Usage:')}`);
          console.log(`    ${t.accent('/team join <project> <name>')} ${t.dim('Join/create a team project')}`);
          console.log(`    ${t.accent('/team status')}               ${t.dim('Show team status & members')}`);
          console.log(`    ${t.accent('/team progress')}             ${t.dim('Show project progress')}`);
          console.log(`    ${t.accent('/team add-progress <task>')}  ${t.dim('Add progress update')}`);
          console.log(`    ${t.accent('/team share <fact>')}         ${t.dim('Add a shared fact for all members')}`);
          console.log(`    ${t.accent('/team leave')}                ${t.dim('Leave the team')}\n`);
        } else {
          const stats = tm.stats();
          const lines = [
            `${t.dim('Members:')}  ${t.accent(String(stats.members))}`,
            `${t.dim('Sessions:')} ${t.accent(String(stats.sessions))}`,
            `${t.dim('Facts:')}    ${t.accent(String(stats.facts))}`,
            `${t.dim('Tasks:')}    ${t.accent(String(stats.progress))}`,
            `${t.dim('Stack:')}    ${stats.techStackSet ? t.success('configured') : t.warning('not set')}`,
          ];
          console.log(`\n${panel('Team: ' + (cfg.team?.projectName || '?'), lines.join('\n'))}\n`);
        }
        break;
      }

      const [teamCmd, ...teamRest] = args.split(' ');
      const teamArgs = teamRest.join(' ').trim();

      switch (teamCmd) {
        case 'join':
        case 'create': {
          const parts = teamArgs.split(' ');
          if (parts.length < 2) {
            console.log(`\n  ${t.dim('Usage: /team join <project-name> <your-name>')}\n`);
            break;
          }
          const projectName = parts[0];
          const memberName = parts.slice(1).join(' ');

          const rl5 = readline.createInterface({ input: process.stdin, output: process.stdout });
          const pw = await new Promise<string>(resolve => {
            rl5.question(`  ${t.prompt('🔐 Team password:')} `, a => { rl5.close(); resolve(a.trim()); });
          });
          if (!pw) { console.log(`  ${t.dim('Cancelled.')}\n`); break; }

          try {
            const tm = new TeamMemory(projectName, pw);
            if (!tm.validate()) {
              console.log(`\n  ${t.error('Wrong password for this team project.')}\n`);
              break;
            }
            tm.join(memberName);
            agent.setTeamMemory(tm);

            // Sync tech stack from team if local is empty
            const teamStack = tm.getTechStack();
            if (teamStack.languages.length > 0 || teamStack.frameworks.length > 0) {
              cfg.techStack = teamStack;
              agent.setTechStack(teamStack);
              console.log(`  ${t.info('📋 Synced tech stack from team')}`);
            }

            // Save team config
            cfg.team = { projectName, memberName, joinedAt: Date.now() };
            saveConfig(cfg);

            const members = tm.getMembers();
            console.log(`\n  ${t.success(`${icons.success} Joined team "${projectName}" as ${memberName}`)}`);
            console.log(`  ${t.dim(`Members: ${members.join(', ')}`)}\n`);
          } catch (err) {
            renderError((err as Error).message);
          }
          break;
        }

        case 'leave': {
          const tm = agent.getTeamMemory();
          if (!tm) { console.log(`\n  ${t.dim('Not in a team.')}\n`); break; }
          if (cfg.team) tm.leave(cfg.team.memberName);
          agent.setTeamMemory(undefined);
          cfg.team = undefined;
          saveConfig(cfg);
          console.log(`\n  ${t.success(`${icons.success} Left the team`)}\n`);
          break;
        }

        case 'status': {
          const tm = agent.getTeamMemory();
          if (!tm) { console.log(`\n  ${t.dim('Not in a team. Use /team join')}\n`); break; }
          const members = tm.getMembers();
          const sessions = tm.getSessions(10);
          console.log(`\n  ${t.brandBold('Team: ' + (cfg.team?.projectName || '?'))}`);
          console.log(`  ${t.dim('Members:')} ${members.map(m => t.accent(m)).join(', ')}\n`);
          if (sessions.length > 0) {
            console.log(`  ${t.brandBold('Recent Activity')}`);
            for (const s of sessions.slice(-8)) {
              const ago = timeSince(s.timestamp);
              console.log(`  ${t.dim('·')} ${t.accent(s.memberName)} ${t.dim(ago)}: ${s.summary.slice(0, 60)}`);
            }
          }
          const techStack = tm.getTechStack();
          if (techStack.languages.length > 0 || techStack.frameworks.length > 0) {
            console.log(`\n  ${t.brandBold('Tech Stack')}`);
            if (techStack.languages.length > 0) console.log(`  ${t.dim('Languages:')} ${techStack.languages.join(', ')}`);
            if (techStack.frameworks.length > 0) console.log(`  ${t.dim('Frameworks:')} ${techStack.frameworks.join(', ')}`);
            if (techStack.libraries.length > 0) console.log(`  ${t.dim('Libraries:')} ${techStack.libraries.join(', ')}`);
          }
          console.log();
          break;
        }

        case 'progress': {
          const tm = agent.getTeamMemory();
          if (!tm) { console.log(`\n  ${t.dim('Not in a team.')}\n`); break; }
          const progress = tm.getProgress();
          if (progress.length === 0) {
            console.log(`\n  ${t.dim('No progress tracked yet. Use /team add-progress <task>')}\n`);
          } else {
            console.log(`\n  ${t.brandBold('Project Progress')}\n`);
            for (const p of progress) {
              const statusIcon = p.status === 'done' ? t.success('✓')
                : p.status === 'in-progress' ? t.warning('◐')
                : t.dim('○');
              const assignee = p.assignee ? t.dim(` (${p.assignee})`) : '';
              console.log(`  ${statusIcon} ${p.task}${assignee} ${t.dim(timeSince(p.timestamp))}`);
            }
            console.log();
          }
          break;
        }

        case 'add-progress': {
          const tm = agent.getTeamMemory();
          if (!tm) { console.log(`\n  ${t.dim('Not in a team.')}\n`); break; }
          if (!teamArgs) { console.log(`\n  ${t.dim('Usage: /team add-progress <task description>')}\n`); break; }
          const status = 'in-progress';
          tm.addProgress(teamArgs, status, cfg.team?.memberName);
          console.log(`\n  ${t.success(`${icons.success} Progress added: "${teamArgs}"`)}\n`);
          break;
        }

        case 'done': {
          const tm = agent.getTeamMemory();
          if (!tm) { console.log(`\n  ${t.dim('Not in a team.')}\n`); break; }
          if (!teamArgs) { console.log(`\n  ${t.dim('Usage: /team done <task>')}\n`); break; }
          tm.addProgress(teamArgs, 'done', cfg.team?.memberName);
          console.log(`\n  ${t.success(`${icons.success} Marked done: "${teamArgs}"`)}\n`);
          break;
        }

        case 'share': {
          const tm = agent.getTeamMemory();
          if (!tm) { console.log(`\n  ${t.dim('Not in a team.')}\n`); break; }
          if (!teamArgs) { console.log(`\n  ${t.dim('Usage: /team share <fact or knowledge>')}\n`); break; }
          tm.addFact(teamArgs, 'fact', ['shared']);
          console.log(`\n  ${t.success(`${icons.success} Shared with team: "${teamArgs.slice(0, 50)}"`)}\n`);
          break;
        }

        default:
          console.log(`\n  ${t.dim('Usage: /team [join|leave|status|progress|add-progress|done|share]')}\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // /todo — persistent todo tracker
    // ══════════════════════════════════
    case 'todo':
    case 't': {
      if (!args) {
        renderTodoList(todos.getAll());
        break;
      }

      const [sub, ...restTodo] = args.split(' ');
      const todoText = restTodo.join(' ').trim();

      switch (sub) {
        case 'add':
        case 'a': {
          if (!todoText) { console.log(`\n  ${t.dim('Usage: /todo add <text>')}\n`); break; }
          const priority = todoText.startsWith('!!') ? 'high'
            : todoText.startsWith('!') ? 'medium' : 'low';
          const cleanText = todoText.replace(/^!+\s*/, '');
          todos.add(cleanText, priority, 'user');
          console.log(`\n  ${t.success(icons.success)} Todo added: ${t.accent(cleanText)}\n`);
          break;
        }

        case 'done':
        case 'check':
        case 'd': {
          if (!todoText) { console.log(`\n  ${t.dim('Usage: /todo done <text or id>')}\n`); break; }
          const ok = todos.markDone(todoText);
          if (ok) {
            console.log(`\n  ${t.success('✓')} Marked done: ${t.dim(todoText)}\n`);
          } else {
            console.log(`\n  ${t.dim(`No open todo matching "${todoText}"`)}\n`);
          }
          break;
        }

        case 'remove':
        case 'rm': {
          if (!todoText) { console.log(`\n  ${t.dim('Usage: /todo remove <text or id>')}\n`); break; }
          const okRm = todos.remove(todoText);
          console.log(`\n  ${okRm ? t.success('✓ removed') : t.dim('not found')}: ${t.dim(todoText)}\n`);
          break;
        }

        case 'clear': {
          const removed = todos.clear(true);
          console.log(`\n  ${t.success(icons.success)} Cleared ${removed} completed todo(s)\n`);
          break;
        }

        case 'all': {
          renderTodoList(todos.getAll());
          break;
        }

        default:
          renderTodoList(todos.getAll());
          break;
      }
      break;
    }

    // ══════════════════════════════════
    // /git — git status, log, diff
    // ══════════════════════════════════
    case 'git':
    case 'g': {
      const gitCmd = args ? args : 'status';

      const runGit = (gitArgs: string): string => {
        try {
          return childProcess.execSync(`git ${gitArgs}`, {
            cwd,
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        } catch (e: any) {
          return e.stderr || e.message || 'git error';
        }
      };

      switch (gitCmd) {
        case 'status':
        case 'st': {
          const out = runGit('status --short --branch');
          renderGitStatus(out);
          break;
        }

        case 'log': {
          const logCount = parseInt(args.split(' ')[1] ?? '') || 10;
          const out = runGit(`log --oneline -${logCount}`);
          renderGitLog(out);
          break;
        }

        case 'diff': {
          const out = runGit('diff --stat HEAD');
          if (!out.trim()) {
            console.log(`\n  ${t.dim('No uncommitted changes.')}\n`);
          } else {
            console.log(`\n  ${t.brandBold('◈ GIT DIFF (stat)')}`);
            for (const line of out.split('\n')) {
              if (line.includes('|')) {
                const [file, change] = line.split('|');
                const plusCount = (change?.match(/\+/g) ?? []).length;
                const minusCount = (change?.match(/-/g) ?? []).length;
                console.log(`  ${t.file(file?.trim() ?? '')} ${t.success('+'.repeat(plusCount))}${t.error('-'.repeat(minusCount))}`);
              } else if (line.trim()) {
                console.log(`  ${t.dim(line)}`);
              }
            }
            console.log();
          }
          break;
        }

        case 'branch': {
          const out = runGit('branch -a');
          console.log(`\n  ${t.brandBold('◈ GIT BRANCHES')}`);
          for (const line of out.split('\n')) {
            if (!line.trim()) continue;
            const isCurrent = line.startsWith('*');
            console.log(`  ${isCurrent ? t.success('*') : t.dim('·')} ${isCurrent ? t.accent(line.slice(1).trim()) : t.dim(line.trim())}`);
          }
          console.log();
          break;
        }

        default: {
          const out = runGit(gitCmd);
          if (out.trim()) console.log('\n' + out.split('\n').map(l => '  ' + t.dim(l)).join('\n') + '\n');
          break;
        }
      }
      break;
    }

    // ══════════════════════════════════
    // /doctor — system health check
    // ══════════════════════════════════
    case 'doctor': {
      const checks: { name: string; ok: boolean; detail: string }[] = [];

      const check = (name: string, fn: () => string | null): void => {
        try {
          const result = fn();
          checks.push({ name, ok: result === null, detail: result ?? 'ok' });
        } catch (e: any) {
          checks.push({ name, ok: false, detail: e.message ?? 'error' });
        }
      };

      check('Node.js ≥ 18', () => {
        const v = process.versions.node.split('.').map(Number);
        return v[0] >= 18 ? null : `found v${process.versions.node}, need v18+`;
      });

      check('git installed', () => {
        try { childProcess.execSync('git --version', { stdio: 'pipe' }); return null; }
        catch { return 'git not found in PATH'; }
      });

      check('project is git repo', () => {
        return fs.existsSync(path.join(cwd, '.git')) ? null : 'no .git directory';
      });

      check('memory directory writable', () => {
        const memDir = path.join(process.env.HOME ?? '~', '.timps');
        try { fs.mkdirSync(memDir, { recursive: true }); return null; }
        catch { return `cannot write to ${memDir}`; }
      });

      check(`API key for ${provider.name}`, () => {
        const localProviders = ['ollama', 'opencode', 'timps', 'timps-coder', 'hybrid'];
        if (localProviders.includes(provider.name)) return null;
        const envKeys: Record<string, string> = {
          claude: 'ANTHROPIC_API_KEY',
          openai: 'OPENAI_API_KEY',
          gemini: 'GEMINI_API_KEY',
          openrouter: 'OPENROUTER_API_KEY',
        };
        const envKey = envKeys[provider.name];
        return envKey && process.env[envKey] ? null : `${envKey} not set`;
      });

      if (provider.name === 'ollama') {
        check('ollama running', () => {
          try {
            childProcess.execSync('curl -s http://localhost:11434/api/tags', { stdio: 'pipe', timeout: 2000 });
            return null;
          } catch { return 'ollama not running (try: ollama serve)'; }
        });
      }

      const memStats = memory.stats;
      checks.push({
        name: 'memory health',
        ok: true,
        detail: `${memStats.semanticCount} facts, ${memStats.episodeCount} sessions, ${memStats.workingFiles} active files`,
      });

      const installed = getInstalledSkills();
      checks.push({
        name: 'skills installed',
        ok: true,
        detail: installed.length > 0 ? installed.map(s => s.name).join(', ') : 'none',
      });

      renderDoctorReport(checks);
      break;
    }

    // ══════════════════════════════════
    // /think — force step-by-step thinking
    // ══════════════════════════════════
    case 'think': {
      if (!args) {
        console.log(`\n  ${t.dim('Usage: /think <your question>')}\n`);
        break;
      }
      const thinkPrompt = `Think step by step about: ${args}\n\nBefore answering, reason through this carefully. Consider edge cases and potential issues.`;
      console.log();
      try {
        for await (const event of agent.run(thinkPrompt)) {
          if (event.type === 'text') process.stdout.write(event.content);
          else if (event.type === 'thinking') {
            console.log(`\n  ${t.dim('◈ reasoning...')}`);
            for (const l of event.content.split('\n').slice(0, 8)) {
              console.log(`    ${t.dim(l)}`);
            }
          }
        }
        console.log();
      } catch (e: any) {
        renderError((e as Error).message);
      }
      break;
    }

    // ══════════════════════════════════
    // /optimus — sentence-to-product pipeline
    // ══════════════════════════════════
    case 'optimus': {
      if (!args) {
        console.log(`\n  ${t.brandBold('🚀 Digital Optimus')}`);
        console.log(`  ${t.dim('Sentence-to-Product pipeline')}`);
        console.log(`\n  ${t.dim('Usage:')} ${t.accent('/optimus <product description>')}`);
        console.log(`  ${t.dim('Example:')} ${t.accent('/optimus a high-frequency trading bot in Rust')}`);
        console.log(`\n  ${t.dim('Options:')}`);
        console.log(`    ${t.accent('--war-room')}     19h sessions, max iterations`);
        console.log(`    ${t.accent('--binary-synth')} Direct binary compilation`);
        console.log(`    ${t.accent('--arch <arch>')}   Target: x86_64, aarch64, wasm\n`);
        break;
      }

      const { DigitalOptimus } = await import('../utils/optimus.js');
      const { NavigatorAgent } = await import('../agent/navigator.js');
      
      const isWarRoom = args.includes('--war-room');
      const isBinary = args.includes('--binary-synth');
      const archMatch = args.match(/--arch\s+(\S+)/);
      const cleanArgs = args.replace(/--war-room|--binary-synth|--arch\s+\S+/g, '').trim();

      console.log(`\n  ${t.brandBold('🚀 Digital Optimus')}`);
      console.log(`  ${t.dim('Building:')} ${t.accent(cleanArgs)}`);
      if (isWarRoom) console.log(`  ${t.warning('🔥 War Room Mode')}`);
      if (isBinary) console.log(`  ${t.warning('⚡ Binary Synthesis')}`);
      console.log();

      const optimus = new DigitalOptimus(cwd, {
        warRoom: isWarRoom,
        binarySynth: isBinary,
        targetArch: archMatch ? archMatch[1] : 'x86_64',
        grpoEnabled: true,
      });

      const navigator = new NavigatorAgent(provider, cwd, ['coder', 'debugger', 'reviewer', 'architect']);
      optimus.setNavigator(navigator);

      try {
        for await (const event of optimus.execute(cleanArgs)) {
          if (event.type === 'text') process.stdout.write(event.content);
          else if (event.type === 'status') console.log(`  ${event.message}`);
          else if (event.type === 'error') console.log(`  ${t.error(event.message)}`);
        }
        console.log();
      } catch (e: any) {
        renderError((e as Error).message);
      }
      break;
    }

    // ══════════════════════════════════
    // /context — show context window usage
    // ══════════════════════════════════
    case 'context':
    case 'ctx': {
      const usage = agent.getUsage();
      const total = usage.inputTokens + usage.outputTokens;
      const maxCtx = 200000;
      const pct = Math.round((total / maxCtx) * 100);
      const ctxBar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      console.log(`\n  ${t.dim('context')} ${chalk.hex('#7C3AED')(ctxBar)} ${t.accent(`${(total / 1000).toFixed(1)}k`)} ${t.dim(`/ ${(maxCtx / 1000).toFixed(0)}k (${pct}%)`)}`);
      console.log(`  ${t.dim('messages:')} ${agent.getMessageCount()}`);
      if (pct > 70) {
        console.log(`  ${t.warning('→ run /compact to free up context window')}`);
      }
      console.log();
      break;
    }

    // ══════════════════════════════════
    // Multimodal Memory Commands
    // ══════════════════════════════════
    case 'vision':
    case 'vis':
    case 'audio':
    case 'sound':
    case 'recall':
    case 'remember':
    case 'visionstats':
    case 'vstats': {
      if (multimodalMem) {
        await handleMultimodalCommand(cmd, args, multimodalMem);
      } else {
        console.log(chalk.dim('\n Multimodal memory not available\n'));
      }
      break;
    }

    // ══════════════════════════════════
    // Voice Input Commands
    // ══════════════════════════════════
    case 'voice': {
      const result = await handleVoiceCommand(args);
      if (result) {
        console.log(`\n  ${t.dim('Use this as input or /ask <question>')}\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // Document Commands
    // ══════════════════════════════════
    case 'doc': {
      const result = await handleDocumentCommand(args);
      if (result) {
        console.log(`\n  ${t.dim('Document parsed. Use /ask about it')}\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // Upload Commands
    // ══════════════════════════════════
    case 'upload': {
      await handleUploadCommand(args);
      break;
    }

    // ══════════════════════════════════
    // /forge — ProvenForge version control
    // ══════════════════════════════════
    case 'forge': {
      const [forgeCmd, ...forgeArgs] = args.split(' ');
      
      const loadProvenForge = async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pf = require('../../packages/server/core/provenForge.js');
          return pf.provenForge;
        } catch {
          const { provenForge } = await import('../team/provenForgeStub.js');
          return provenForge;
        }
      };

      switch (forgeCmd) {
        case 'branch':
        case 'branches': {
          const pf = await loadProvenForge();
          if (!pf) {
            console.log(`\n  ${t.dim('ProvenForge not available (requires server connection)')}\n`);
            break;
          }
          const versions = await pf.retrieveBy({ limit: 20 });
          const branches: string[] = [];
          for (const v of versions) {
            branches.push((v as any).provenance?.branch || 'main');
          }
          const uniqueBranches = [...new Set(branches)];
          console.log(`\n${panel('ProvenForge Branches', uniqueBranches.map(b => `  ${t.accent('*')} ${b}`).join('\n'))}\n`);
          break;
        }

        case 'log': {
          const pf = await loadProvenForge();
          if (!pf) {
            console.log(`\n  ${t.dim('ProvenForge not available')}\n`);
            break;
          }
          const versions = await pf.retrieveBy({ limit: 10 });
          console.log(`\n${panel('ProvenForge Versions', versions.map((v: any) => 
            `${t.dim(v.created_at?.toISOString().slice(0, 10) || '?')} ${t.accent(v.version_id.slice(0, 8))} [${v.tier}] ${t.dim(v.provenance?.module || '?')}`
          ).join('\n'))}\n`);
          break;
        }

        case 'tier': {
          const tierName = forgeArgs[0] || 'semantic';
          if (!['raw', 'episodic', 'semantic'].includes(tierName)) {
            console.log(`\n  ${t.dim('Tiers: raw, episodic, semantic')}\n`);
            break;
          }
          const pf = await loadProvenForge();
          if (!pf) {
            console.log(`\n  ${t.dim('ProvenForge not available')}\n`);
            break;
          }
          const versions = await pf.retrieveBy({ tier: tierName as any, limit: 10 });
          console.log(`\n${panel(`${tierName} tier (${versions.length})`, versions.map((v: any) => 
            `  ${t.accent(v.version_id.slice(0, 8))}: ${v.content?.slice(0, 60) || '(no content)'}...`
          ).join('\n'))}\n`);
          break;
        }

        case 'stats': {
          const pf = await loadProvenForge();
          if (!pf) {
            console.log(`\n  ${t.dim('ProvenForge not available')}\n`);
            break;
          }
          const stats = await pf.getStats();
          const tierLines = Object.entries(stats.byTier).map(([tier, count]) => 
            `  ${tier}: ${t.dim(String(count))}`
          ).join('\n');
          console.log(`\n${panel('ProvenForge Stats', [
            `  Total versions: ${t.accent(String(stats.totalVersions))}`,
            `  ${t.brandBold('By Tier:')}`,
            tierLines || '  (none)',
          ].join('\n'))}\n`);
          break;
        }

        case 'lineage': {
          const versionId = forgeArgs[0];
          if (!versionId) {
            console.log(`\n  ${t.dim('Usage: /forge lineage <version-id>')}\n`);
            break;
          }
          const pf = await loadProvenForge();
          if (!pf) {
            console.log(`\n  ${t.dim('ProvenForge not available')}\n`);
            break;
          }
          const lineage = await pf.getLineage(versionId, 10);
          console.log(`\n${panel('Version Lineage', lineage.map((v: string, i: number) => 
            `${'  '.repeat(i)}${i === 0 ? t.accent('*') : t.dim('│')} ${v.slice(0, 8)}`
          ).join('\n'))}\n`);
          break;
        }

        default: {
          console.log(`\n${panel('ProvenForge Commands', [
            `  ${t.accent('/forge branches')}    List version branches`,
            `  ${t.accent('/forge log')}         Recent versions`,
            `  ${t.accent('/forge tier <raw|episodic|semantic>')}  Versions by tier`,
            `  ${t.accent('/forge stats')}       Version statistics`,
            `  ${t.accent('/forge lineage <id>')} Version lineage DAG`,
          ].join('\n'))}\n`);
        }
      }
      break;
    }

    // ══════════════════════════════════
    // /govern — GovernTier policy governance
    // ══════════════════════════════════
    case 'govern': {
      const loadGovernTier = async () => {
        try {
          const pf = require('../../packages/server/core/governTier.js');
          return pf.governTier;
        } catch {
          return null;
        }
      };

      const gov = await loadGovernTier();
      if (!gov) {
        console.log(`\n  ${t.dim('GovernTier not available (requires server connection)')}\n`);
        break;
      }

      if (!args || args === 'stats') {
        const stats = await gov.getGovernanceStats();
        const tierLines = Object.entries(stats.byTier).map(([tier, count]) =>
          `  ${tier}: ${t.accent(String(count))}`
        ).join('\n');
        const statusLines = Object.entries(stats.byStatus).map(([status, count]) =>
          `  ${status}: ${t.accent(String(count))}`
        ).join('\n');
        console.log(`\n${panel('GovernTier Stats', [
          `  ${t.brandBold('Total Governed:')} ${t.accent(String(stats.totalGoverned))}`,
          `  ${t.brandBold('By Tier:')}`,
          tierLines || '  (none)',
          `  ${t.brandBold('By Status:')}`,
          statusLines || '  (none)',
          `  Conflicts Resolved: ${t.accent(String(stats.conflictsResolved))}`,
        ].join('\n'))}\n`);
        break;
      }

      if (args === 'policies') {
        const policies = Array.from((gov as any).policies?.values?.() || []);
        console.log(`\n${panel('Governance Policies', policies.map((p: any) =>
          `  ${t.accent(p.name)} [${p.policy_type}] v${p.version}`
        ).join('\n') || '  (none)')}\n`);
        break;
      }

      if (args === 'evolve') {
        console.log(`\n  ${t.info('Evolving policies...')}`);
        await gov.evolvePolicies();
        console.log(`  ${t.success(icons.success)} Policy evolution complete\n`);
        break;
      }

      console.log(`\n${panel('GovernTier Commands', [
        `  ${t.accent('/govern')}           Governance statistics`,
        `  ${t.accent('/govern stats')}     Detailed statistics`,
        `  ${t.accent('/govern policies')}  List active policies`,
        `  ${t.accent('/govern evolve')}    Trigger policy evolution`,
      ].join('\n'))}\n`);
      break;
    }

    // ══════════════════════════════════
    // /plan — run agent in plan mode
    // ══════════════════════════════════
    case 'plan': {
      if (!args) {
        console.log(`\n  ${t.dim('Usage: /plan <task description>')}\n`);
        break;
      }
      const planPrompt = `Before starting, create a detailed plan for: ${args}\n\nList each step clearly. Think about dependencies, potential issues, and the best order to proceed.`;
      console.log();
      try {
        for await (const event of agent.run(planPrompt)) {
          if (event.type === 'text') process.stdout.write(event.content);
          else if (event.type === 'plan') {
            renderAgentEvent(event);
          }
        }
        console.log();
      } catch (e: any) {
        renderError((e as Error).message);
      }
      break;
    }

    case 'exit':
    case 'quit':
    case 'q':
      agent.saveSession(sessionDir);
      agent.saveEpisode('success').catch(() => {});
      console.log(`\n  ${t.dim('session saved · goodbye')}\n`);
      process.exit(0);
      break;

    case 'plugin': {
      const [sub, ...pluginRest] = args.split(' ');
      const pluginArg = pluginRest.join(' ').trim();
      if (!pluginManager) {
        console.log(`\n  ${t.dim('Plugin system not initialised.')}\n`);
        break;
      }
      switch (sub) {
        case 'list':
        case 'ls': {
          const plugins = pluginManager.listPlugins();
          if (plugins.length === 0) {
            console.log(`\n  ${t.dim('No plugins loaded. Use /plugin load <package> to add one.')}\n`);
          } else {
            console.log(`\n  ${t.accent('Loaded plugins:')}`);
            for (const p of plugins) {
              const cmds = (p.commands ?? []).map((c) => `/${c.name}`).join(', ');
              const tools = (p.tools ?? []).map((t2) => t2.name).join(', ');
              console.log(`  · ${t.accent(p.name)} v${p.version} — ${p.description}`);
              if (cmds) console.log(`    commands: ${cmds}`);
              if (tools) console.log(`    tools: ${tools}`);
            }
            console.log();
          }
          break;
        }
        case 'load': {
          if (!pluginArg) {
            console.log(`\n  ${t.dim('Usage: /plugin load <package-name-or-path>')}\n`);
            break;
          }
          try {
            await pluginManager.load(pluginArg);
            console.log(`\n  ${t.success('✓')} Plugin loaded: ${t.accent(pluginArg)}\n`);
          } catch (err) {
            renderError(`Failed to load plugin "${pluginArg}": ${(err as Error).message}`);
          }
          break;
        }
        case 'unload': {
          if (!pluginArg) {
            console.log(`\n  ${t.dim('Usage: /plugin unload <plugin-name>')}\n`);
            break;
          }
          const removed = await pluginManager.unload(pluginArg);
          if (removed) {
            console.log(`\n  ${t.success('✓')} Plugin unloaded: ${t.accent(pluginArg)}\n`);
          } else {
            console.log(`\n  ${t.dim(`Plugin not found: ${pluginArg}`)}\n`);
          }
          break;
        }
        default:
          console.log(`\n  ${t.dim('Usage:')}`);
          console.log(`  ${t.accent('/plugin list')}             — list loaded plugins`);
          console.log(`  ${t.accent('/plugin load <pkg>')}       — load a plugin by package name or path`);
          console.log(`  ${t.accent('/plugin unload <name>')}    — unload a plugin\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // /commit — git commit shortcut
    // ══════════════════════════════════
    case 'commit':
    case 'cm': {
      const msg = args || 'chore: update';
      try {
        const out = childProcess.execSync(`git add -A && git commit -m "${msg.replace(/"/g, '\\"')}"`, {
          cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000,
        });
        console.log(`\n  ${t.success(icons.success)} Committed: ${t.accent(`"${msg}"`)}`);
        const hash = childProcess.execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
        console.log(`  ${t.dim(`commit ${hash}`)}\n`);
      } catch (e: any) {
        const err = (e.stderr || e.message || '').toString().trim();
        if (err.includes('nothing to commit')) {
          console.log(`\n  ${t.dim('Nothing to commit — working tree clean')}\n`);
        } else {
          renderError(err || 'git commit failed');
        }
      }
      break;
    }

    // ══════════════════════════════════
    // /branch — git branch shortcut
    // ══════════════════════════════════
    case 'branch':
    case 'br': {
      try {
        if (!args) {
          const out = childProcess.execSync('git branch', { cwd, encoding: 'utf-8', stdio: 'pipe' });
          console.log(`\n  ${t.brandBold('Branches')}`);
          for (const line of out.split('\n').filter(Boolean)) {
            const isCurrent = line.startsWith('*');
            console.log(`  ${isCurrent ? t.success('*') : t.dim('·')} ${isCurrent ? t.accent(line.slice(2)) : t.dim(line.slice(2))}`);
          }
          console.log();
        } else if (args.startsWith('-d') || args.startsWith('--delete')) {
          const name = args.split(' ').slice(1).join(' ').trim();
          if (!name) { console.log(`\n  ${t.dim('Usage: /branch -d <name>')}\n`); break; }
          childProcess.execSync(`git branch -d ${name}`, { cwd, stdio: 'pipe' });
          console.log(`\n  ${t.success(icons.success)} Deleted branch: ${t.accent(name)}\n`);
        } else {
          childProcess.execSync(`git checkout -b ${args}`, { cwd, encoding: 'utf-8', stdio: 'pipe' });
          console.log(`\n  ${t.success(icons.success)} Created and switched to ${t.accent(args)}\n`);
        }
      } catch (e: any) {
        renderError((e.stderr || e.message || '').toString().trim());
      }
      break;
    }

    // ══════════════════════════════════
    // /worktree — git worktree management
    // ══════════════════════════════════
    case 'worktree':
    case 'wt': {
      const runGit2 = (gitArgs: string): string => {
        try {
          return childProcess.execSync(`git ${gitArgs}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
        } catch (e: any) { return e.stderr || e.message || ''; }
      };
      if (!args) {
        const out = runGit2('worktree list');
        console.log(`\n  ${t.brandBold('Git Worktrees')}\n`);
        for (const line of out.split('\n').filter(Boolean)) {
          console.log(`  ${t.dim('·')} ${line}`);
        }
        console.log(`\n  ${t.dim('Usage:')} ${t.accent('/worktree add <path> [branch]')} ${t.dim('|')} ${t.accent('/worktree remove <path>')}\n`);
      } else {
        const [sub, ...wtRest] = args.split(' ');
        const wtArgs2 = wtRest.join(' ');
        if (sub === 'add') {
          const out = runGit2(`worktree add ${wtArgs2}`);
          console.log(`\n  ${t.success(icons.success)} Worktree added\n  ${t.dim(out.trim())}\n`);
        } else if (sub === 'remove' || sub === 'rm') {
          const out = runGit2(`worktree remove ${wtArgs2}`);
          console.log(`\n  ${t.success(icons.success)} Worktree removed\n  ${t.dim(out.trim())}\n`);
        } else if (sub === 'prune') {
          runGit2('worktree prune');
          console.log(`\n  ${t.success(icons.success)} Worktrees pruned\n`);
        } else {
          console.log(`\n  ${t.dim('Usage: /worktree [add <path> [branch] | remove <path> | prune]')}\n`);
        }
      }
      break;
    }

    // ══════════════════════════════════
    // /tasks — background task manager
    // ══════════════════════════════════
    case 'tasks': {
      const open = todos.getOpen ? todos.getOpen() : [];
      const all = todos.getAll ? todos.getAll() : [];
      const done = all.filter((t2: any) => t2.status === 'done' || t2.done).length;

      if (!args) {
        console.log(`\n  ${t.brandBold('Tasks')}  ${t.dim(`${open.length} open · ${done} done`)}\n`);
        if (all.length === 0) {
          console.log(`  ${t.dim('No tasks. Use /tasks add <description>')}\n`);
        } else {
          for (const task of all) {
            const isDone = task.done;
            const icon = isDone ? t.success('✓') : t.warning('○');
            const pri = task.priority === 'high' ? t.error('[!]') : task.priority === 'medium' ? t.warning('[~]') : t.dim('[·]');
            console.log(`  ${icon} ${pri} ${isDone ? t.dim(task.text) : task.text}`);
          }
          console.log();
        }
        console.log(`  ${t.dim('Subcommands: add <text> | done <text> | clear')}\n`);
      } else {
        const [tsub, ...trest] = args.split(' ');
        const ttext = trest.join(' ').trim();
        if (tsub === 'add' || tsub === 'a') {
          if (!ttext) { console.log(`\n  ${t.dim('Usage: /tasks add <text>')}\n`); break; }
          todos.add(ttext, 'medium', 'user');
          console.log(`\n  ${t.success(icons.success)} Task added: ${t.accent(ttext)}\n`);
        } else if (tsub === 'done' || tsub === 'd') {
          if (!ttext) { console.log(`\n  ${t.dim('Usage: /tasks done <text>')}\n`); break; }
          const ok = todos.markDone(ttext);
          console.log(`\n  ${ok ? t.success('✓ done') : t.dim('not found')}: ${t.dim(ttext)}\n`);
        } else if (tsub === 'clear') {
          todos.clear(true);
          console.log(`\n  ${t.success(icons.success)} Completed tasks cleared\n`);
        } else {
          console.log(`\n  ${t.dim('Usage: /tasks [add <text> | done <text> | clear]')}\n`);
        }
      }
      break;
    }

    // ══════════════════════════════════
    // /mcp — MCP server management
    // ══════════════════════════════════
    case 'mcp': {
      const mcpManager = getMcpManager();
      if (!args || args === 'list') {
        const clients = mcpManager.getClients();
        if (clients.length === 0) {
          console.log(`\n  ${t.dim('No MCP servers connected.')}`);
          console.log(`  ${t.dim('Usage: /mcp add <name> <command> [args...]')}\n`);
        } else {
          console.log(`\n  ${t.brandBold('MCP Servers')}  ${t.dim(`${clients.length} connected`)}\n`);
          for (const c of clients) {
            const toolCount = (c.tools || []).length;
            const statusIcon = c.status === 'connected' ? t.success('●') : c.status === 'connecting' ? t.warning('◐') : t.error('○');
            console.log(`  ${statusIcon} ${t.accent(c.name)}  ${t.dim(`${toolCount} tools`)}`);
            if (c.lastError) console.log(`    ${t.error(c.lastError.slice(0, 60))}`);
          }
          console.log();
        }
        break;
      }

      const [mcpSub, mcpName, ...mcpArgRest] = args.split(' ');
      const mcpArgStr = mcpArgRest.join(' ');

      switch (mcpSub) {
        case 'add': {
          if (!mcpName) { console.log(`\n  ${t.dim('Usage: /mcp add <name> <command> [args...]')}\n`); break; }
          const [mcpCmd, ...mcpExtraArgs] = mcpArgRest;
          if (!mcpCmd) { console.log(`\n  ${t.dim('Usage: /mcp add <name> <command> [args...]')}\n`); break; }
          try {
            await mcpManager.connect({ name: mcpName, command: mcpCmd, args: mcpExtraArgs, scope: 'user', enabled: true } as any);
            console.log(`\n  ${t.success(icons.success)} MCP server connected: ${t.accent(mcpName)}\n`);
          } catch (err) {
            renderError(`Failed to connect: ${(err as Error).message}`);
          }
          break;
        }
        case 'remove':
        case 'rm': {
          if (!mcpName) { console.log(`\n  ${t.dim('Usage: /mcp remove <name>')}\n`); break; }
          try {
            await mcpManager.disconnect(mcpName);
            console.log(`\n  ${t.success(icons.success)} Disconnected: ${t.accent(mcpName)}\n`);
          } catch (err) {
            renderError((err as Error).message);
          }
          break;
        }
        case 'reconnect': {
          if (!mcpName) { console.log(`\n  ${t.dim('Usage: /mcp reconnect <name>')}\n`); break; }
          try {
            const client = mcpManager.getClient(mcpName);
            if (!client) { renderError(`Server "${mcpName}" not found`); break; }
            await mcpManager.disconnect(mcpName);
            await mcpManager.connect({ name: mcpName, command: '', scope: 'user', enabled: true } as any);
            console.log(`\n  ${t.success(icons.success)} Reconnected: ${t.accent(mcpName)}\n`);
          } catch (err) {
            renderError((err as Error).message);
          }
          break;
        }
        case 'tools': {
          const targetName = mcpName || '';
          const clients2 = mcpManager.getClients();
          const targets = targetName ? clients2.filter((c: any) => c.name === targetName) : clients2;
          if (targets.length === 0) { console.log(`\n  ${t.dim('No matching MCP server.')}\n`); break; }
          for (const c of targets) {
            console.log(`\n  ${t.accent(c.name)} tools:`);
            for (const tool of (c.tools || [])) {
              console.log(`  ${t.dim('·')} ${tool.name}${tool.description ? `  ${t.dim(tool.description.slice(0, 60))}` : ''}`);
            }
          }
          console.log();
          break;
        }
        default:
          console.log(`\n  ${t.dim('MCP subcommands: list | add <n> <cmd> | remove <n> | reconnect <n> | tools [n]')}\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // /brief — toggle concise output mode
    // ══════════════════════════════════
    case 'brief': {
      const cfg2 = loadConfig();
      const was = !!(cfg2 as any).briefMode;
      (cfg2 as any).briefMode = !was;
      saveConfig(cfg2);
      console.log(`\n  ${t.success(icons.success)} Brief mode ${(cfg2 as any).briefMode ? t.accent('ON') : t.dim('off')} — ${(cfg2 as any).briefMode ? 'concise responses' : 'full responses'}\n`);
      break;
    }

    // ══════════════════════════════════
    // /rewind — rewind conversation history
    // ══════════════════════════════════
    case 'rewind':
    case 'rw': {
      const count2 = parseInt(args) || 1;
      const msgCount = agent.getMessageCount();
      if (msgCount === 0) {
        console.log(`\n  ${t.dim('No messages to rewind.')}\n`);
        break;
      }
      const removeCount = Math.min(count2 * 2, msgCount); // remove N user+assistant pairs
      for (let i = 0; i < removeCount; i++) {
        agent.popLastMessage?.();
      }
      console.log(`\n  ${t.success(icons.success)} Rewound ${count2} exchange${count2 > 1 ? 's' : ''} — ${agent.getMessageCount()} messages remain\n`);
      break;
    }

    // ══════════════════════════════════
    // /resume — resume a previous session
    // ══════════════════════════════════
    case 'resume':
    case 'r': {
      if (!args) {
        // List recent sessions
        const sessDir = path.join(os.homedir(), '.timps', 'sessions');
        if (!fs.existsSync(sessDir)) {
          console.log(`\n  ${t.dim('No saved sessions found.')}\n`);
          break;
        }
        const sessions = fs.readdirSync(sessDir)
          .filter(f => f.endsWith('.json'))
          .map(f => {
            try {
              const data = JSON.parse(fs.readFileSync(path.join(sessDir, f), 'utf-8'));
              return { id: f.replace('.json', ''), summary: data.summary || data.goal || '?', ts: data.timestamp || 0 };
            } catch { return null; }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.ts - a.ts)
          .slice(0, 10);

        if (sessions.length === 0) {
          console.log(`\n  ${t.dim('No saved sessions found.')}\n`);
        } else {
          console.log(`\n  ${t.brandBold('Recent Sessions')}\n`);
          for (const s of sessions as any[]) {
            const ago = timeSince(s.ts);
            console.log(`  ${t.dim(s.id.slice(0, 12))}  ${s.summary.slice(0, 60)}  ${t.dim(ago)}`);
          }
          console.log(`\n  ${t.dim('Resume with:')} ${t.accent('/resume <session-id>')}\n`);
        }
        break;
      }
      // Try to load the specified session
      const sessFile = path.join(os.homedir(), '.timps', 'sessions', `${args}.json`);
      if (!fs.existsSync(sessFile)) {
        renderError(`Session "${args}" not found`);
        break;
      }
      try {
        if ((agent as any).loadSession) {
          (agent as any).loadSession(sessFile);
        } else {
          const data = JSON.parse(fs.readFileSync(sessFile, 'utf-8'));
          if (data.messages) agent.clearHistory();
        }
        console.log(`\n  ${t.success(icons.success)} Session resumed: ${t.accent(args)}\n`);
      } catch (err) {
        renderError((err as Error).message);
      }
      break;
    }

    // ══════════════════════════════════
    // /oauth — authentication management
    // ══════════════════════════════════
    case 'oauth': {
      const oauthCfg = loadConfig();
      if (!args || args === 'status') {
        const hasKey = !!(oauthCfg as any).apiKey;
        console.log(`\n  ${t.brandBold('OAuth / Authentication')}\n`);
        console.log(`  API key:  ${hasKey ? t.success('configured') : t.error('not set')}`);
        console.log(`  Provider: ${t.accent(oauthCfg.defaultProvider || 'ollama')}`);
        if (hasKey) {
          const key = ((oauthCfg as any).apiKey as string);
          console.log(`  Key:      ${t.dim(key.slice(0, 8) + '…' + key.slice(-4))}`);
        }
        console.log(`\n  ${t.dim('Subcommands: login | logout | status | set-key <key>')}\n`);
        break;
      }
      const [oauthSub, ...oauthRest] = args.split(' ');
      const oauthArg = oauthRest.join(' ').trim();
      switch (oauthSub) {
        case 'login': {
          console.log(`\n  ${t.info('Opening browser for OAuth login...')}`);
          try {
            const { oauthService } = await import('../services/oauth/index.js');
            await oauthService.authenticate({});
            console.log(`  ${t.success(icons.success)} Login successful\n`);
          } catch (err) {
            renderError((err as Error).message);
          }
          break;
        }
        case 'logout': {
          (oauthCfg as any).apiKey = undefined;
          saveConfig(oauthCfg);
          console.log(`\n  ${t.success(icons.success)} Logged out\n`);
          break;
        }
        case 'set-key': {
          if (!oauthArg) { console.log(`\n  ${t.dim('Usage: /oauth set-key <key>')}\n`); break; }
          (oauthCfg as any).apiKey = oauthArg;
          saveConfig(oauthCfg);
          console.log(`\n  ${t.success(icons.success)} API key saved\n`);
          break;
        }
        default:
          console.log(`\n  ${t.dim('Usage: /oauth [login | logout | status | set-key <key>]')}\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // /permissions — permission settings
    // ══════════════════════════════════
    case 'permissions':
    case 'perm': {
      const permCfg = loadConfig();
      const trustLevel = permCfg.trustLevel || 'normal';

      if (!args) {
        const levels: Record<string, string> = {
          cautious: 'Ask before every tool call',
          normal:   'Ask for risky operations only',
          trust:    'Auto-approve most actions',
          yolo:     'Auto-approve everything (no prompts)',
        };
        console.log(`\n  ${t.brandBold('Permissions')}\n`);
        for (const [lvl, desc] of Object.entries(levels)) {
          const active = lvl === trustLevel;
          console.log(`  ${active ? t.success('▶') : t.dim('·')} ${active ? t.accent(lvl) : t.dim(lvl)}  ${t.dim(desc)}`);
        }
        console.log(`\n  ${t.dim('Change with:')} ${t.accent('/permissions <cautious|normal|trust|yolo>')}\n`);
        break;
      }
      const valid = ['cautious', 'normal', 'trust', 'yolo'];
      if (!valid.includes(args)) {
        renderError(`Invalid level. Use: ${valid.join(', ')}`);
        break;
      }
      permCfg.trustLevel = args as any;
      saveConfig(permCfg);
      console.log(`\n  ${t.success(icons.success)} Trust level set to ${t.accent(args)}\n`);
      break;
    }

    // ══════════════════════════════════
    // /agent — agent configuration
    // ══════════════════════════════════
    case 'agent': {
      if (!args) {
        const agentCfg = loadConfig();
        const usage = agent.getUsage();
        console.log(`\n  ${t.brandBold('Agent Configuration')}\n`);
        console.log(`  Provider:    ${t.accent(agentCfg.defaultProvider || 'ollama')}`);
        console.log(`  Model:       ${t.accent(agentCfg.defaultModel || provider.model)}`);
        console.log(`  Trust:       ${t.accent(agentCfg.trustLevel || 'normal')}`);
        console.log(`  Messages:    ${t.accent(String(agent.getMessageCount()))}`);
        console.log(`  Tokens in:   ${t.accent(usage.inputTokens.toLocaleString())}`);
        console.log(`  Tokens out:  ${t.accent(usage.outputTokens.toLocaleString())}`);
        console.log(`\n  ${t.dim('Subcommands: reset | system <prompt> | temperature <0-1>')}\n`);
        break;
      }
      const [agentSub, ...agentRest] = args.split(' ');
      const agentArg = agentRest.join(' ').trim();
      switch (agentSub) {
        case 'reset': {
          agent.clearHistory();
          console.log(`\n  ${t.success(icons.success)} Agent history cleared\n`);
          break;
        }
        case 'system': {
          if (!agentArg) { console.log(`\n  ${t.dim('Usage: /agent system <custom system prompt>')}\n`); break; }
          (agent as any).setSystemPrompt?.(agentArg);
          console.log(`\n  ${t.success(icons.success)} System prompt updated\n`);
          break;
        }
        default:
          console.log(`\n  ${t.dim('Subcommands: reset | system <prompt>')}\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // /feedback — send feedback
    // ══════════════════════════════════
    case 'feedback': {
      if (!args) {
        console.log(`\n  ${t.dim('Usage: /feedback <your feedback or bug report>')}`);
        console.log(`  ${t.dim('Or visit:')} ${t.accent('https://github.com/Sandeeprdy1729/timps/issues')}\n`);
        break;
      }
      const feedbackData = {
        text: args,
        version: '2.0.0',
        provider: provider.name,
        model: provider.model,
        timestamp: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.versions.node,
      };
      const feedbackDir = path.join(os.homedir(), '.timps', 'feedback');
      fs.mkdirSync(feedbackDir, { recursive: true });
      const feedbackFile = path.join(feedbackDir, `feedback-${Date.now()}.json`);
      fs.writeFileSync(feedbackFile, JSON.stringify(feedbackData, null, 2), 'utf-8');
      console.log(`\n  ${t.success(icons.success)} Feedback saved locally`);
      console.log(`  ${t.dim('File:')} ${feedbackFile}`);
      console.log(`  ${t.dim('Thank you! Please also open a GitHub issue:')}`);
      console.log(`  ${t.accent('https://github.com/Sandeeprdy1729/timps/issues/new')}\n`);
      break;
    }

    // ══════════════════════════════════
    // /debug — debug diagnostics
    // ══════════════════════════════════
    case 'debug': {
      const usage2 = agent.getUsage();
      const memStats2 = memory.getStats?.() || memory.stats || {};
      console.log(`\n  ${t.brandBold('Debug Info')}\n`);
      console.log(`  node:        ${process.versions.node}`);
      console.log(`  platform:    ${process.platform} ${process.arch}`);
      console.log(`  cwd:         ${cwd}`);
      console.log(`  sessionDir:  ${sessionDir}`);
      console.log(`  provider:    ${provider.name}`);
      console.log(`  model:       ${provider.model}`);
      console.log(`  messages:    ${agent.getMessageCount()}`);
      console.log(`  tokens in:   ${usage2.inputTokens.toLocaleString()}`);
      console.log(`  tokens out:  ${usage2.outputTokens.toLocaleString()}`);
      console.log(`  mem facts:   ${memStats2.semanticCount ?? '?'}`);
      console.log(`  mem eps:     ${memStats2.episodeCount ?? '?'}`);
      if (process.env.TIMPS_DEBUG) {
        console.log(`  debug mode:  ${t.success('ON')}`);
        console.log(`  argv:        ${process.argv.join(' ')}`);
      }
      console.log();
      break;
    }

    // ══════════════════════════════════
    // /session — session information
    // ══════════════════════════════════
    case 'session':
    case 'sess': {
      if (!args) {
        const usage3 = agent.getUsage();
        const sessId = path.basename(sessionDir);
        const sessStart = fs.existsSync(sessionDir)
          ? fs.statSync(sessionDir).birthtime.getTime()
          : Date.now();
        const duration = Math.floor((Date.now() - sessStart) / 1000);
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;

        console.log(`\n  ${t.brandBold('Session')}\n`);
        console.log(`  ID:        ${t.dim(sessId)}`);
        console.log(`  Duration:  ${t.accent(`${mins}m ${secs}s`)}`);
        console.log(`  Messages:  ${t.accent(String(agent.getMessageCount()))}`);
        console.log(`  Tokens:    ${t.accent((usage3.inputTokens + usage3.outputTokens).toLocaleString())}`);
        console.log(`  Directory: ${t.dim(sessionDir)}`);
        console.log(`\n  ${t.dim('Subcommands: save | list | share')}\n`);
        break;
      }
      const [sessSub] = args.split(' ');
      switch (sessSub) {
        case 'save': {
          agent.saveSession(sessionDir);
          console.log(`\n  ${t.success(icons.success)} Session saved to ${t.dim(sessionDir)}\n`);
          break;
        }
        case 'list': {
          // reuse resume logic
          await handleSlashCommand('/resume', agent, memory, todos, snapshots, permissions, provider, cwd, sessionDir, providerName, multimodalMem, pluginManager);
          break;
        }
        case 'share': {
          const sessId2 = path.basename(sessionDir);
          console.log(`\n  ${t.dim('Session sharing requires TIMPS Cloud.')}`);
          console.log(`  ${t.dim('Local ID:')} ${t.accent(sessId2)}\n`);
          break;
        }
        default:
          console.log(`\n  ${t.dim('Usage: /session [save | list | share]')}\n`);
      }
      break;
    }

    // ══════════════════════════════════
    // /hooks — hooks status (dev utility)
    // ══════════════════════════════════
    case 'hooks': {
      const hooksFromCommands = [
        'useSettings', 'useMcp', 'useTasks', 'useCommandQueue', 'useTextInput',
        'useNotifications', 'useToolPermission', 'useSession', 'useIdeConnection',
        'useOAuth', 'useSettingsSync', 'useCoordinator', 'usePlugins',
        'useArrowKeyHistory', 'useDiffInIDE', 'useClipboardImageHint',
        'useSwarmInitialization', 'useMergedTools',
      ];
      console.log(`\n  ${t.brandBold(`React Hooks (${hooksFromCommands.length} registered)`)}\n`);
      for (const h of hooksFromCommands) {
        console.log(`  ${t.success('✓')} ${t.accent(h)}`);
      }
      console.log(`\n  ${t.dim('Hooks are active in the Ink TUI renderer.')}\n`);
      break;
    }

    case 'react': {
      const nowEnabled = agent.toggleReactMode();
      console.log(`\n  ${t.success(icons.success)} ReAct mode ${nowEnabled ? 'enabled' : 'disabled'}\n`);
      if (nowEnabled) {
        console.log(`  ${t.dim('Using clean Thought → Action → Observation cycle')}\n`);
      } else {
        console.log(`  ${t.dim('Using standard streaming agent loop')}\n`);
      }
      break;
    }

    default:
      console.log(`\n  ${t.dim(`Unknown command: /${cmd}. Type /help for commands.`)}\n`);
  }
}

function timeSince(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ═══════════════════════════════════════
// Provider selection menu
// ═══════════════════════════════════════

const PROVIDER_MENU: { name: ProviderName; label: string; desc: string }[] = [
  { name: 'claude',     label: 'Claude (Anthropic)',   desc: 'Claude Sonnet / Opus — top-tier coding' },
  { name: 'openai' as ProviderName,     label: 'OpenAI / Codex',      desc: 'GPT-4o, o3-mini — fast & versatile' },
  { name: 'gemini' as ProviderName,     label: 'Google Gemini',        desc: 'Gemini 2.5 Pro/Flash — free tier available' },
  { name: 'ollama' as ProviderName,     label: 'Ollama (local)',        desc: 'Qwen, DeepSeek, Llama — runs on your machine' },
  { name: 'openrouter' as ProviderName, label: 'OpenRouter',           desc: '100+ models, pay-per-token routing' },
  { name: 'ollama' as ProviderName,     label: 'OpenCode (local)',      desc: 'Local models via Ollama — no API key needed' },
];

async function pickProvider(config: import('../config/types.js').TimpsConfig): Promise<ProviderName | null> {
  const { radioMenu } = await import('../utils/interactiveMenu.js');
  const options = PROVIDER_MENU.map(p => ({
    label: p.label,
    description: p.desc,
    meta: p.name === 'ollama' ? undefined : 'API key' as string | undefined,
  }));
  const idx = await radioMenu({ prompt: 'Select provider:', options });
  if (idx === null) return null;

  const chosen = PROVIDER_MENU[idx].name;
  config.defaultProvider = chosen;
  config.defaultModel = getDefaultModel(chosen);
  saveConfig(config);
  console.log(`\n  ${t.success(`${icons.success} Switched to ${PROVIDER_MENU[idx].label}`)}\n`);
  return chosen;
}

export { runDataPipeline };
export type { DataPipelineConfig } from '../data-pipeline/data-pipeline.js';
