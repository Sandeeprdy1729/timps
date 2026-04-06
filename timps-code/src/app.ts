// ── TIMPS Code — CLI Application ──
// Beautiful REPL with slash commands, streaming, and session management

import * as readline from 'node:readline';
import * as childProcess from 'node:child_process';
import { render } from 'ink';
import React from 'react';
import { App } from './ui/App.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import chalk from 'chalk';
import type { ModelProvider, ProviderName, TokenUsage, TechStack } from './types.js';
import { Agent } from './agent.js';
import { Memory } from './memory.js';
import { TeamMemory } from './teamMemory.js';
import { SnapshotManager } from './snapshot.js';
import { Permissions } from './permissions.js';
import { TodoStore } from './todo.js';
import { loadConfig, saveConfig, runSetupWizard, getProjectId, getApiKey, getDefaultModel } from './config.js';
import { createProvider, POPULAR_MODELS } from './models/index.js';
import { t, icons, SMALL_LOGO, panel } from './theme.js';
import {
  renderAgentEvent, renderLandingPage, renderHelp,
  renderPrompt, renderError, flushText, renderChatReady,
  renderMemoryPanel, renderTodoList, renderDoctorReport,
  renderGitStatus, renderGitLog, renderModelsList, renderSkills,
} from './renderer.js';
import { ensureOllamaReady, getLocalModels, isOllamaInstalled, installOllama, isOllamaRunning, tryStartOllama, pullModel } from './ollamaSetup.js';
import { searchSkills, installSkill, uninstallSkill, getInstalledSkills, fetchSkillContent } from './skills.js';
import { MultimodalMemory } from './multimodalMemory.js';
import { handleMultimodalCommand } from './multimodalCommands.js';
import { handleVoiceCommand, handleDocumentCommand, handleUploadCommand } from './inputCommands.js';
import { formatCost } from './utils.js';

export interface AppOptions {
  provider?: ProviderName;
  model?: string;
  cwd?: string;
  oneLine?: string;  // single-shot mode
  branch?: string;   // ProvenForge lineage integration
  merge?: string;    // ProvenForge state sync integration
}

export async function startApp(opts: AppOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();
  const config = loadConfig();
  let ollamaModels: string[] = [];

  // ── Step 1: Show the TIMPS banner immediately ──
  console.log();
  const bannerLines = SMALL_LOGO.split('\n');
  for (const line of bannerLines) console.log(line);
  console.log();

  // ── Step 2: Provider selection ──
  // Always ask on first run (no keys set), or use CLI flag / saved config
  let providerName: ProviderName;

  if (opts.provider) {
    // CLI flag overrides
    providerName = opts.provider;
  } else {
    const hasAnyKey = Object.values(config.keys).some(k => !!k);
    const isFirstRun = !hasAnyKey && config.defaultProvider === 'ollama';

    if (isFirstRun) {
      // First launch — always show provider picker
      console.log(`  ${t.brandBold('Welcome to TIMPS Code!')} ${t.dim('Choose your AI provider to get started.')}\n`);
      const picked = await pickProvider(config);
      if (!picked) {
        console.log(`\n  ${t.dim('No provider selected. Exiting.')}\n`);
        process.exit(1);
      }
      providerName = picked;
    } else {
      providerName = config.defaultProvider;
    }
  }

  // ── Step 3: Provider-specific setup ──
  if (providerName === 'ollama') {
    // Auto-install Ollama if not present, auto-start, auto-pull qwen coder
    const modelName = opts.model || config.defaultModel || 'qwen2.5-coder:7b';

    if (!isOllamaInstalled()) {
      console.log(`\n  ${t.accent('⚡ Setting up Ollama (local AI)...')}`);
      const installed = await installOllama();
      if (!installed) {
        console.log(`\n  ${t.dim('Ollama install failed. Choose another provider:')}\n`);
        const picked = await pickProvider(config);
        if (!picked) process.exit(1);
        providerName = picked;
      }
    }

    if (providerName === 'ollama') {
      // Start Ollama if not running
      let running = await isOllamaRunning(config.ollamaUrl);
      if (!running) {
        console.log(`  ${t.dim('Starting Ollama...')}`);
        tryStartOllama();
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 1000));
          running = await isOllamaRunning(config.ollamaUrl);
          if (running) break;
        }
        if (!running) {
          console.log(`  ${t.error('Could not start Ollama.')}`);
          console.log(`  ${t.dim('Try manually:')} ${t.accent('ollama serve')}\n`);
          const picked = await pickProvider(config);
          if (!picked) process.exit(1);
          providerName = picked;
        } else {
          console.log(`  ${t.success(`${icons.success} Ollama running`)}`);
        }
      }
    }

    if (providerName === 'ollama') {
      // Auto-pull qwen coder if no models available
      ollamaModels = await getLocalModels(config.ollamaUrl);
      const modelName2 = opts.model || config.defaultModel || 'qwen2.5-coder:7b';
      const hasModel = ollamaModels.some(m => m === modelName2 || m.startsWith(modelName2.split(':')[0]));
      if (!hasModel) {
        console.log(`\n  ${t.accent(`📦 Pulling ${modelName2} (first time only)...`)}`);
        const pulled = await pullModel(modelName2, config.ollamaUrl);
        if (pulled) {
          ollamaModels = await getLocalModels(config.ollamaUrl);
        } else {
          console.log(`  ${t.warning('Could not pull model. Using available models or switch provider.')}`);
        }
      }
    }
  }

  // ── Step 4: For cloud providers, ensure API key ──
  const localProviders: ProviderName[] = ['ollama', 'opencode'];
  if (!localProviders.includes(providerName) && !getApiKey(config, providerName)) {
    console.log(`\n  ${t.warning(`${icons.key} No API key for ${providerName}`)}`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const key = await new Promise<string>(resolve => {
      rl.question(`  ${t.prompt('API key:')} `, answer => { rl.close(); resolve(answer.trim()); });
    });
    if (key) {
      config.keys[providerName] = key;
      saveConfig(config);
      console.log(`  ${t.success(`${icons.success} Key saved`)}`);
    } else {
      console.log(`  ${t.dim('No key provided. Exiting.')}\n`);
      process.exit(1);
    }
  }

  // Create provider
  let provider: ModelProvider;
  try {
    provider = createProvider(providerName, opts.model);
  } catch (err) {
    console.error(`\n  ${t.error((err as Error).message)}`);
    process.exit(1);
  }

  // Init subsystems
  const projectId = getProjectId(cwd);
  const memory = new Memory(projectId);
  const todos = new TodoStore(projectId);
  const snapshots = new SnapshotManager(projectId);
  const permissions = new Permissions(config.trustLevel, config.pathRules);
  const multimodalMemory = new MultimodalMemory(cwd);

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
  });
  agent.setTodoStore(todos);
  
  if (opts.merge) {
    // A signal to perform sync against provenForge when possible
    agent.setPendingMergeTarget(opts.merge);
  }

  // If team config exists, auto-join team
  let teamMemory: TeamMemory | undefined;
  if (config.team) {
    const rl3 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const pw = await new Promise<string>(resolve => {
      rl3.question(`\n  ${t.info('🔐')} Team "${config.team!.projectName}" — password: `, a => { rl3.close(); resolve(a.trim()); });
    });
    if (pw) {
      try {
        teamMemory = new TeamMemory(config.team.projectName, pw);
        if (teamMemory.validate()) {
          teamMemory.join(config.team.memberName);
          agent.setTeamMemory(teamMemory);
          console.log(`  ${t.success(`${icons.success} Joined team "${config.team.projectName}" as ${config.team.memberName}`)}`);
        } else {
          console.log(`  ${t.error('Wrong team password. Running without team memory.')}`);
          teamMemory = undefined;
        }
      } catch (err) {
        console.log(`  ${t.error((err as Error).message)}`);
        teamMemory = undefined;
      }
    }
  }

  // Single-shot mode
  if (opts.oneLine) {
    await runSingleTurn(agent, opts.oneLine, provider.model);
    return;
  }

  // Session persistence directory
  const sessionDir = path.join(os.homedir(), '.timps', 'sessions', projectId);

  // Check for resumable session
  const sessionInfo = agent.hasResumableSession(sessionDir);
  if (sessionInfo.exists) {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>(resolve => {
      rl2.question(
        `\n  ${t.info(icons.memory)} Previous session found (${sessionInfo.messageCount} messages, ${sessionInfo.age}). Resume? ${t.dim('[y/N]')} `,
        a => { rl2.close(); resolve(a.trim().toLowerCase()); }
      );
    });
    if (answer === 'y' || answer === 'yes') {
      if (agent.restoreSession(sessionDir)) {
        console.log(`  ${t.success(`${icons.success} Session restored`)}`);
      }
    }
  }

  // Interactive REPL — show landing page
  const memoryCount = memory.query('', 999).length;
  renderLandingPage(provider.model, providerName, cwd, memoryCount, ollamaModels, todos.getOpen().length);

  // Interactive REPL — Handled by Ink UI
  process.on('SIGINT', () => {
    agent.saveSession(sessionDir);
    agent.saveEpisode('success').catch(() => {});
    process.exit(0);
  });

  const { waitUntilExit } = render(React.createElement(App, {
    agent, memory, todos, snapshots, permissions, provider, cwd, sessionDir, multimodalMem: multimodalMemory
  }));
  await waitUntilExit();
}

// ═══════════════════════════════════════
// Single-shot execution
// ═══════════════════════════════════════

async function runSingleTurn(agent: Agent, message: string, model: string): Promise<void> {
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
        { name: 'claude', models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'] },
        { name: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'] },
        { name: 'gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
        { name: 'ollama', models: ['qwen2.5-coder:7b', 'deepseek-r1:7b', 'codellama:7b'] },
        { name: 'deepseek', models: ['deepseek-chat', 'deepseek-coder'] },
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
        console.log(`  ${t.dim('Providers: claude, openai, gemini, ollama, openrouter')}\n`);
        break;
      }
      const [prov, mod] = args.split(' ');
      try {
        const newProvider = createProvider(prov as ProviderName, mod);
        agent.switchProvider(newProvider);
        console.log(`\n  ${t.success(icons.success)} Switched to ${t.accent(newProvider.model)}\n`);
      } catch (err) {
        renderError((err as Error).message);
      }
      break;
    }

    case 'memory':
    case 'mem': {
      if (!args) {
        const entries = memory.loadSemanticEntries();
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
          const results = memory.query(subArg, 20);
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
          const data = memory.exportMemory();
          const outFile = path.join(cwd, 'timps-memory-export.json');
          fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf-8');
          console.log(`\n  ${t.success(icons.success)} Memory exported to ${t.file('timps-memory-export.json')}\n`);
          break;
        }

        case 'import': {
          const importFile = subArg || path.join(cwd, 'timps-memory-export.json');
          if (!fs.existsSync(importFile)) {
            console.log(`\n  ${t.error('File not found:')} ${importFile}\n`);
            break;
          }
          const data = JSON.parse(fs.readFileSync(importFile, 'utf-8'));
          const count = memory.importMemory(data);
          console.log(`\n  ${t.success(icons.success)} Imported ${count} memory entries\n`);
          break;
        }

        case 'consolidate': {
          const merged = memory.consolidate();
          console.log(`\n  ${t.success(icons.success)} Merged ${merged} duplicate entries\n`);
          break;
        }

        default: {
          const entries = memory.loadSemanticEntries();
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
        permissions.setTrust(args as any);
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
        ? formatCost(usage.estimatedCost)
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
            installSkill({ id: subQuery, name: subQuery, description: '', category: 'general', content });
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

    case 'provider': {
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
        const localProviders = ['ollama', 'opencode'];
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

      const memStats = memory.stats();
      checks.push({
        name: 'memory health',
        ok: true,
        detail: `${memStats.facts} facts, ${memStats.episodes} sessions, ${memStats.patterns} patterns`,
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
          const pf = require('../../sandeep-ai/core/provenForge.js');
          return pf.provenForge;
        } catch {
          const { provenForge } = await import('./provenForgeStub.js');
          return provenForge;
        }
      };

      switch (forgeCmd) {
        case 'branch':
        case 'branches': {
          const pf = await loadProvenForge();
          if (!pf) {
            console.log(`\n  ${t.dim('ProvenForge not available (requires sandeep-ai connection)')}\n`);
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
            `${t.accent('/forge branches')}    ${t.dim('List all branches')}`,
            `${t.accent('/forge log')}         ${t.dim('Show recent versions')}`,
            `${t.accent('/forge tier <name>')} ${t.dim('Show versions by tier (raw|episodic|semantic)')}`,
            `${t.accent('/forge stats')}       ${t.dim('Show ProvenForge statistics')}`,
            `${t.accent('/forge lineage <id>')} ${t.dim('Show version ancestry')}`,
          ].join('\n'))}\n`);
          break;
        }
      }
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
  { name: 'claude',     label: '🟣 Claude (Anthropic)',   desc: 'Claude Sonnet / Opus — top-tier coding' },
  { name: 'openai',     label: '🟢 OpenAI / Codex',      desc: 'GPT-4o, o3-mini — fast & versatile' },
  { name: 'gemini',     label: '🔵 Google Gemini',        desc: 'Gemini 2.5 Pro/Flash — free tier available' },
  { name: 'ollama',     label: '⚪ Ollama (local)',        desc: 'Qwen, DeepSeek, Llama — runs on your machine' },
  { name: 'openrouter', label: '🟡 OpenRouter',           desc: '100+ models, pay-per-token routing' },
  { name: 'opencode',   label: '🔶 OpenCode (local)',      desc: 'Local models via Ollama — no API key needed' },
];

async function pickProvider(config: import('./types.js').TimpsConfig): Promise<ProviderName | null> {
  console.log(`  ${t.brandBold('Choose a provider:')}\n`);

  for (let i = 0; i < PROVIDER_MENU.length; i++) {
    const p = PROVIDER_MENU[i];
    const hasKey = p.name === 'ollama' || !!getApiKey(config, p.name);
    const badge = hasKey ? t.success(' ✔') : '';
    console.log(`  ${t.accent(`${i + 1}.`)} ${p.label}${badge}`);
    console.log(`     ${t.dim(p.desc)}`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => {
    rl.question(`\n  ${t.prompt('Select [1-6]:')} `, a => { rl.close(); resolve(a.trim()); });
  });

  const idx = parseInt(answer) - 1;
  if (idx < 0 || idx >= PROVIDER_MENU.length) return null;

  const chosen = PROVIDER_MENU[idx].name;
  config.defaultProvider = chosen;
  config.defaultModel = getDefaultModel(chosen);
  saveConfig(config);
  console.log(`\n  ${t.success(`${icons.success} Switched to ${PROVIDER_MENU[idx].label}`)}`);
  return chosen;
}

