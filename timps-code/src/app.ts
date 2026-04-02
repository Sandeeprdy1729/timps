// ── TIMPS Code — CLI Application ──
// Beautiful REPL with slash commands, streaming, and session management

import * as readline from 'node:readline';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ModelProvider, ProviderName, TokenUsage, TechStack } from './types.js';
import { Agent } from './agent.js';
import { Memory } from './memory.js';
import { TeamMemory } from './teamMemory.js';
import { SnapshotManager } from './snapshot.js';
import { Permissions } from './permissions.js';
import { loadConfig, saveConfig, runSetupWizard, getProjectId, getApiKey, getDefaultModel } from './config.js';
import { createProvider, POPULAR_MODELS } from './models/index.js';
import { t, icons, SMALL_LOGO, panel } from './theme.js';
import {
  renderAgentEvent, renderLandingPage, renderHelp,
  renderPrompt, renderError, flushText,
} from './renderer.js';
import { ensureOllamaReady, getLocalModels } from './ollamaSetup.js';
import { searchSkills, installSkill, uninstallSkill, getInstalledSkills, fetchSkillContent } from './skills.js';
import { formatCost } from './utils.js';

export interface AppOptions {
  provider?: ProviderName;
  model?: string;
  cwd?: string;
  oneLine?: string;  // single-shot mode
}

export async function startApp(opts: AppOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();
  const config = loadConfig();

  // Setup if no API keys configured
  let providerName = opts.provider || config.defaultProvider;

  // Ollama auto-setup: ensure server + model is ready
  let ollamaModels: string[] = [];
  if (providerName === 'ollama') {
    const modelName = opts.model || config.defaultModel || 'qwen2.5-coder:7b';
    const status = await ensureOllamaReady(modelName);
    ollamaModels = status.availableModels;

    if (!status.installed || !status.running) {
      // Ollama failed — offer provider selection
      console.log(`\n  ${t.dim('Ollama is unavailable. Choose a cloud provider instead:')}\n`);
      const picked = await pickProvider(config);
      if (!picked) {
        console.log(`\n  ${t.dim('No provider selected. Exiting.')}\n`);
        process.exit(1);
      }
      providerName = picked;
    }
  }

  // For cloud providers, check API key
  if (providerName !== 'ollama' && !getApiKey(config, providerName)) {
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
  const snapshots = new SnapshotManager(projectId);
  const permissions = new Permissions(config.trustLevel, config.pathRules);

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
  });

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
  renderLandingPage(provider.model, providerName, cwd, memoryCount, ollamaModels);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
    terminal: true,
  });

  let isProcessing = false;

  const promptUser = (): void => {
    if (!isProcessing) renderPrompt();
  };

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { promptUser(); return; }
    if (isProcessing) return;

    // Slash commands
    if (input.startsWith('/')) {
      await handleSlashCommand(input, agent, memory, snapshots, permissions, provider, cwd, sessionDir);
      promptUser();
      return;
    }

    // Process user message
    isProcessing = true;
    console.log(); // blank line before response

    try {
      for await (const event of agent.run(input)) {
        renderAgentEvent(event);
      }
      flushText();
    } catch (err) {
      renderError((err as Error).message);
    }

    isProcessing = false;
    promptUser();
  });

  rl.on('close', () => {
    agent.saveSession(sessionDir);
    agent.saveEpisode('success').catch(() => {});
    console.log(`\n  ${t.dim('session saved · goodbye')}\n`);
    process.exit(0);
  });

  // Handle Ctrl+C during processing
  process.on('SIGINT', () => {
    if (isProcessing) {
      agent.abort();
      isProcessing = false;
      console.log(`\n  ${t.dim('cancelled')}`);
      promptUser();
    } else {
      rl.close();
    }
  });

  promptUser();
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

async function handleSlashCommand(
  input: string,
  agent: Agent,
  memory: Memory,
  snapshots: SnapshotManager,
  permissions: Permissions,
  provider: ModelProvider,
  cwd: string,
  sessionDir: string,
): Promise<void> {
  const [cmd, ...rest] = input.slice(1).split(' ');
  const args = rest.join(' ').trim();

  switch (cmd) {
    case 'help':
    case 'h':
      renderHelp();
      break;

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
      const memories = memory.query(args || '', 20);
      if (memories.length === 0) {
        console.log(`\n  ${t.dim('No memories stored.')}\n`);
      } else {
        const lines = memories.map(m =>
          `${t.dim(`[${m.type}]`)} ${m.content} ${t.dim(`(${Math.round(m.confidence * 100)}%)`)}`
        );
        console.log(`\n${panel('Memory', lines.join('\n'))}\n`);
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
      console.log(`\n  ${t.dim('Context compaction will happen automatically when needed.')}`);
      console.log(`  ${t.dim(`Messages: ${agent.getMessageCount()}`)}`);
      console.log(`  ${t.dim('Full history is preserved to ~/.timps/history/ on compaction')}\n`);
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
          console.log(`  ${t.success(`${icons.success} Now using ${newProvider.model}`)}\n`);
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
    rl.question(`\n  ${t.prompt('Select [1-5]:')} `, a => { rl.close(); resolve(a.trim()); });
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
