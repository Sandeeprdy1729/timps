// TIMPS Code — Command Executor
// Executes slash commands using the new services

import * as readline from 'node:readline';
import { startBridge, stopBridge, isBridgeConnected, getBridgeEnvironmentId } from '../services/bridge/index.js';
import { downloadUserSettings, uploadUserSettingsInBackground, isSettingsSyncEnabled, syncSettings } from '../services/settingsSync/index.js';
import { getPluginManager } from '../services/plugins/index.js';
import { showDoctorScreen } from '../screens/index.js';
import { getLspServerManager, initializeLsp } from '../services/lsp/manager.js';
import { Memory } from '../memory/memory.js';
import { loadConfig, saveConfig, getDefaultModel } from '../config/config.js';
import type { ProviderName, ProviderLimitConfig } from '../config/types.js';
import { encrypt, isEncrypted } from '../config/keyVault.js';
import { createUser, verifyPassword, listUsers, deleteUser, setUserRole, createSession, getSession, clearSession } from '../services/userStore.js';
import { checkRateLimit, recordUsage, getUsageStats, resetUsage, DEFAULT_PROVIDER_LIMITS } from '../services/providerRateLimiter.js';
import { runAuditCommand, runTeamDigestCommand } from './audit.js';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function executeCommand(command: string, args: string[]): Promise<CommandResult> {
  const [cmd, ...rest] = command.split(' ').filter(Boolean);
  const argString = rest.join(' ');

  switch (cmd.toLowerCase()) {
    case 'doctor':
      return runDoctorCommand();

    case 'doctor:check':
      return runDoctorCommand();

    case 'sync':
    case 'settings-sync':
      return runSyncCommand();

    case 'sync:upload':
      return runSyncUploadCommand();

    case 'sync:download':
      return runSyncDownloadCommand();

    case 'bridge':
    case 'remote':
      return runBridgeCommand(argString);

    case 'bridge:start':
      return runBridgeStartCommand(argString);

    case 'bridge:stop':
      return runBridgeStopCommand();

    case 'bridge:status':
      return runBridgeStatusCommand();

    case 'plugins':
    case 'plugin':
      return runPluginCommand(argString);

    case 'plugins:list':
      return runPluginListCommand();

    case 'plugins:install':
      return runPluginInstallCommand(rest);

    case 'plugins:remove':
      return runPluginRemoveCommand(rest);

    case 'plugins:enable':
      return runPluginEnableCommand(rest);

    case 'plugins:disable':
      return runPluginDisableCommand(rest);

    case 'lsp':
    case 'lsp-connect':
      return runLspConnectCommand();

    case 'lsp:status':
      return runLspStatusCommand();

    case 'memory:stats':
      return runMemoryStatsCommand();

    case 'memory:benchmark':
      return runMemoryBenchmarkCommand();

    case 'memory:embed-backfill':
      return runEmbedBackfillCommand();

    case 'memory:embed-status':
      return runEmbedStatusCommand();

    case 'eval':
    case 'eval:run':
      return runEvalCommand(rest);

    case 'eval:ab':
    case 'eval:abtest':
      return runEvalAbTestCommand(rest);

    case 'eval:baseline':
      return runEvalBaselineCommand(rest);

    case 'eval:gate':
      return runEvalGateCommand();

    case 'perf':
    case 'performance':
      return runPerfCommand();

    case 'cost':
      return runCostCommand();

    case 'context':
      return runContextCommand();

    case 'usage':
      return runUsageCommand();

    case 'models':
      return runModelsCommand();

    case 'env':
      return runEnvCommand();

    case 'version':
      return runVersionCommand();

    case 'upgrade':
      return runUpgradeCommand();

    case 'onboarding':
      return runOnboardingCommand();

    case 'plan':
      return runPlanCommand(argString);

    case 'worktree':
    case 'wt':
      return runWorktreeCommand(argString);

    case 'skills':
      return runSkillsCommand();

    case 'tasks':
    case 'bashes':
      return runTasksCommand(argString);

    case 'team':
      return runTeamCommand(argString);

    case 'team:digest':
      return runTeamDigestHandler(argString);

    case 'audit':
      return runAuditCommandHandler(argString);

    case 'mcp':
      return runMcpCommand(argString);

    case 'config':
    case 'settings':
      return runConfigCommand(argString);

    case 'brief':
      return runBriefCommand();

    case 'context':
      return runContextVisualizeCommand();

    case 'compact':
      return runCompactCommand(argString);

    case 'rewind':
    case 'checkpoint':
      return runRewindCommand(argString);

    case 'resume':
    case 'continue':
      return runResumeCommand(argString);

    case 'model':
      return runModelCommand(argString);

    case 'oauth':
      return runOauthCommand();

    case 'permissions':
    case 'allowed-tools':
      return runPermissionsCommand(argString);

    case 'agent':
    case 'agents':
      return runAgentsCommand(argString);

    case 'feedback':
    case 'bug':
      return runFeedbackCommand(argString);

    case 'debug':
      return runDebugCommand();

    case 'memory':
      return runMemoryCommand(argString);

    case 'sheaf':
    case 'hsw':
      return runSheafCommand(argString);

    case 'aether':
    case 'erl':
      return runAetherCommand(argString);

    case 'qisrd':
    case 'qisd':
      return runQISRDCommand(argString);

    case 'session':
    case 'remote':
      return runSessionCommand();

    case 'hooks':
      return runHooksCommand();

    case 'commit':
      return runCommitCommand();

    case 'branch':
    case 'fork':
      return runBranchCommand(argString);

    case 'config:set':
      return runConfigSetCommand(rest);

    case 'config:list-providers':
    case 'config:providers':
      return runConfigListProvidersCommand();

    case 'config:test':
      return runConfigTestCommand(rest);

    case 'config:reset-usage':
      return runConfigResetUsageCommand(rest);

    case 'auth':
    case 'login':
      return runAuthCommand(rest);

    case 'auth:create-user':
      return runAuthCreateUserCommand(rest);

    case 'auth:list-users':
      return runAuthListUsersCommand();

    case 'auth:delete-user':
      return runAuthDeleteUserCommand(rest);

    case 'auth:set-role':
      return runAuthSetRoleCommand(rest);

    case 'auth:logout':
      return runAuthLogoutCommand();

    case 'auth:status':
      return runAuthStatusCommand();

    default:
      return { success: false, output: '', error: `Unknown command: ${cmd}` };
  }
}

async function runDoctorCommand(): Promise<CommandResult> {
  try {
    await showDoctorScreen();
    return { success: true, output: 'Health check complete' };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runSyncCommand(): Promise<CommandResult> {
  try {
    if (!isSettingsSyncEnabled()) {
      return { success: false, output: '', error: 'Settings sync not configured. Set API key first.' };
    }

    const result = await syncSettings();
    const output = result.downloaded
      ? 'Settings synchronized from remote'
      : result.uploaded
        ? 'Settings uploaded to remote'
        : 'Settings already in sync';

    return { success: true, output };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runSyncUploadCommand(): Promise<CommandResult> {
  try {
    if (!isSettingsSyncEnabled()) {
      return { success: false, output: '', error: 'Settings sync not configured' };
    }
    await uploadUserSettingsInBackground();
    return { success: true, output: 'Uploading settings...' };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runSyncDownloadCommand(): Promise<CommandResult> {
  try {
    if (!isSettingsSyncEnabled()) {
      return { success: false, output: '', error: 'Settings sync not configured' };
    }
    const result = await downloadUserSettings();
    return {
      success: true,
      output: result ? 'Settings downloaded from remote' : 'No remote settings found',
    };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runBridgeCommand(args: string): Promise<CommandResult> {
  const subcommand = args.split(' ')[0];

  switch (subcommand) {
    case 'start':
      return runBridgeStartCommand(args.replace('start', '').trim());
    case 'stop':
      return runBridgeStopCommand();
    case 'status':
      return runBridgeStatusCommand();
    default:
      return runBridgeStatusCommand();
  }
}

async function runBridgeStartCommand(args: string): Promise<CommandResult> {
  try {
    if (isBridgeConnected()) {
      return { success: false, output: '', error: 'Bridge already connected' };
    }

    const dir = args || process.cwd();
    await startBridge({ dir });
    return { success: true, output: `Bridge started in ${dir}` };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runBridgeStopCommand(): Promise<CommandResult> {
  try {
    await stopBridge();
    return { success: true, output: 'Bridge stopped' };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runBridgeStatusCommand(): Promise<CommandResult> {
  const connected = isBridgeConnected();
  const envId = getBridgeEnvironmentId();

  if (!connected) {
    return { success: true, output: 'Bridge: Disconnected' };
  }

  return { success: true, output: `Bridge: Connected\nEnvironment ID: ${envId || 'unknown'}` };
}

async function runPluginCommand(args: string): Promise<CommandResult> {
  const subcommand = args.split(' ')[0];

  switch (subcommand) {
    case 'list':
      return runPluginListCommand();
    case 'install':
      return runPluginInstallCommand(args.replace('install', '').trim().split(' '));
    case 'remove':
      return runPluginRemoveCommand(args.replace('remove', '').trim().split(' '));
    case 'enable':
      return runPluginEnableCommand(args.replace('enable', '').trim().split(' '));
    case 'disable':
      return runPluginDisableCommand(args.replace('disable', '').trim().split(' '));
    default:
      return runPluginListCommand();
  }
}

async function runPluginListCommand(): Promise<CommandResult> {
  try {
    const manager = getPluginManager();
    await manager.discoverPlugins();
    const result = manager.getLoadResult();

    let output = 'Plugins:\n';
    for (const plugin of result.enabled) {
      output += `  ✓ ${plugin.name} (${plugin.source})\n`;
    }
    for (const plugin of result.disabled) {
      output += `  ✗ ${plugin.name} (${plugin.source})\n`;
    }
    if (result.enabled.length === 0 && result.disabled.length === 0) {
      output += '  No plugins installed';
    }

    return { success: true, output };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runPluginInstallCommand(args: string[]): Promise<CommandResult> {
  try {
    if (args.length < 2) {
      return { success: false, output: '', error: 'Usage: /plugins install <name> <repo>' };
    }
    const [name, repo] = args;
    const manager = getPluginManager();
    const success = await manager.installPlugin(name, repo);
    return success
      ? { success: true, output: `Plugin ${name} installed` }
      : { success: false, output: '', error: 'Install failed' };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runPluginRemoveCommand(args: string[]): Promise<CommandResult> {
  try {
    if (args.length < 1) {
      return { success: false, output: '', error: 'Usage: /plugins remove <name>' };
    }
    const [name] = args;
    const manager = getPluginManager();
    const success = await manager.removePlugin(name);
    return success
      ? { success: true, output: `Plugin ${name} removed` }
      : { success: false, output: '', error: 'Remove failed' };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runPluginEnableCommand(args: string[]): Promise<CommandResult> {
  try {
    if (args.length < 1) {
      return { success: false, output: '', error: 'Usage: /plugins enable <name>' };
    }
    const [name] = args;
    const manager = getPluginManager();
    manager.enablePlugin(name);
    return { success: true, output: `Plugin ${name} enabled` };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runPluginDisableCommand(args: string[]): Promise<CommandResult> {
  try {
    if (args.length < 1) {
      return { success: false, output: '', error: 'Usage: /plugins disable <name>' };
    }
    const [name] = args;
    const manager = getPluginManager();
    manager.disablePlugin(name);
    return { success: true, output: `Plugin ${name} disabled` };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runLspConnectCommand(): Promise<CommandResult> {
  try {
    await initializeLsp(process.cwd());
    return { success: true, output: 'LSP servers initialized' };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runLspStatusCommand(): Promise<CommandResult> {
  const manager = getLspServerManager();
  if (!manager) {
    return { success: true, output: 'LSP: Not initialized' };
  }

  const servers = manager.getServerNames();
  if (servers.length === 0) {
    return { success: true, output: 'LSP: No servers available' };
  }

  let output = 'LSP Servers:\n';
  for (const name of servers) {
    const running = manager.isServerRunning(name);
    output += `  ${running ? '✓' : '✗'} ${name}\n`;
  }

  return { success: true, output };
}

async function runMemoryStatsCommand(): Promise<CommandResult> {
  try {
    const mem = new Memory(process.cwd());
    const stats = mem.getStats();
    return {
      success: true,
      output: `Memory Stats:
  Semantic Entries: ${stats.semanticCount}
  Episodes: ${stats.episodeCount}
  Working Files: ${stats.workingFiles}
  Procedural Traces: ${stats.proceduralCount}
  Graph Nodes: ${stats.graphNodes}`,
    };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runMemoryBenchmarkCommand(): Promise<CommandResult> {
  try {
    const mem = new Memory(process.cwd());
    const report = await mem.runBenchmark();
    return { success: true, output: report };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runEmbedBackfillCommand(): Promise<CommandResult> {
  try {
    const mem = new Memory(process.cwd());
    const queued = await mem.backfillEmbeddings();
    const status = mem.embeddingStatus;
    if (!status) {
      return { success: true, output: 'Embedding pipeline not configured. Set `embedding` in MemoryEngineOptions.\n  (Qdrant + Ollama/OpenAI required for vector search.)' };
    }
    const lines: string[] = [];
    lines.push(`Embedding Provider: ${status.provider}`);
    lines.push(`Model: ${status.model}`);
    lines.push(`Queue Depth: ${status.queueDepth}${queued > 0 ? ` (+${queued} backfilled)` : ''}`);
    lines.push(`Total Embedded: ${status.totalEmbedded}`);
    lines.push(`Connected: ${status.isConnected ? 'yes' : 'no'}`);
    if (status.lastError) lines.push(`Last Error: ${status.lastError}`);
    return { success: true, output: lines.join('\n') };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runEmbedStatusCommand(): Promise<CommandResult> {
  try {
    const mem = new Memory(process.cwd());
    const status = mem.embeddingStatus;
    if (!status) {
      return { success: true, output: 'Embedding pipeline: not configured' };
    }
    const lines: string[] = [];
    lines.push(`Provider: ${status.provider}`);
    lines.push(`Model: ${status.model}`);
    lines.push(`Queue Depth: ${status.queueDepth}`);
    lines.push(`Total Embedded: ${status.totalEmbedded}`);
    lines.push(`Connected: ${status.isConnected ? 'yes' : 'no'}`);
    if (status.lastError) lines.push(`Last Error: ${status.lastError}`);
    return { success: true, output: lines.join('\n') };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runEvalCommand(args: string[]): Promise<CommandResult> {
  try {
    const { loadAllDatasets, createFreshEngine, seedEngineWithDataset, evaluateDataset, formatEvalSummary } = await import('@timps/memory-core');
    const datasets = loadAllDatasets();
    const datasetName = args[0] || 'all';

    const toRun = datasetName === 'all'
      ? datasets
      : datasets.filter(d => d.name === datasetName);

    if (toRun.length === 0) {
      return { success: true, output: `No dataset found matching "${datasetName}". Available: ${datasets.map(d => d.name).join(', ')}` };
    }

    const lines: string[] = [];
    for (const dataset of toRun) {
      const engine = createFreshEngine();
      seedEngineWithDataset(engine, dataset);
      const result = await evaluateDataset(engine, dataset, `cli-${Date.now()}`, 'unknown', 'default');
      lines.push(formatEvalSummary(result));
      lines.push('');
    }

    return { success: true, output: lines.join('\n') };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runEvalAbTestCommand(args: string[]): Promise<CommandResult> {
  try {
    const { AbTestRunner, loadDataset, createFreshEngine, seedEngineWithDataset, evaluateDataset, DATASET_NAMES } = await import('@timps/memory-core');
    const runner = new AbTestRunner();
    const variantA = { name: args[0] || 'baseline', overrides: {} };
    const variantB = { name: args[1] || 'experiment', overrides: {} };
    const datasetName = args[2] || 'multi-layer-recall';

    const results = await runner.runComparison(variantA, variantB, [datasetName], 'ab-test', 'unknown');
    const report = runner.formatReport(results);
    return { success: true, output: report };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runEvalBaselineCommand(args: string[]): Promise<CommandResult> {
  try {
    const { loadAllDatasets, createFreshEngine, seedEngineWithDataset, evaluateDataset, BaselineManager } = await import('@timps/memory-core');
    const baselineDir = args[1] || `${process.cwd()}/.timps/eval-baselines`;
    const manager = new BaselineManager(baselineDir);
    const datasetName = args[0] || 'all';

    const datasets = loadAllDatasets();
    const toRun = datasetName === 'all'
      ? datasets
      : datasets.filter(d => d.name === datasetName);

    const lines: string[] = [];
    for (const dataset of toRun) {
      const engine = createFreshEngine();
      seedEngineWithDataset(engine, dataset);
      const result = await evaluateDataset(engine, dataset, `baseline-${Date.now()}`, 'unknown', 'default');
      manager.saveBaseline(result, 'main');
      lines.push(`✅ Baseline saved: ${dataset.name}`);
    }

    return { success: true, output: lines.join('\n') };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runEvalGateCommand(): Promise<CommandResult> {
  try {
    const { loadAllDatasets, createFreshEngine, seedEngineWithDataset, evaluateDataset, BaselineManager, RegressionDetector } = await import('@timps/memory-core');
    const baselineDir = `${process.cwd()}/.timps/eval-baselines`;
    const manager = new BaselineManager(baselineDir);
    const detector = new RegressionDetector();

    const datasets = loadAllDatasets();
    const lines: string[] = [];
    let blocked = false;

    for (const dataset of datasets) {
      const engine = createFreshEngine();
      seedEngineWithDataset(engine, dataset);
      const result = await evaluateDataset(engine, dataset, `gate-${Date.now()}`, 'unknown', 'default');

      const { baseline, deltas, passed } = manager.compareAgainstBaseline(result, 'main');
      if (!baseline) {
        lines.push(`⬜ ${dataset.name}: No baseline (run /eval:baseline first)`);
        continue;
      }

      if (!passed) {
        blocked = true;
        lines.push(`🔴 ${dataset.name}: GATE BLOCKED`);
        for (const [metric, delta] of Object.entries(deltas)) {
          const bv = baseline.metrics[metric];
          const cv = result.metrics.find(m => m.name === metric)?.value;
          lines.push(`     ${metric}: ${bv} → ${cv} (Δ=${delta > 0 ? '+' : ''}${delta})`);
        }
      } else {
        lines.push(`✅ ${dataset.name}: Passed`);
      }
    }

    if (blocked) {
      lines.unshift('❌ EVAL GATE FAILED — fix regressions before merging');
    } else {
      lines.unshift('✅ EVAL GATE PASSED — all metrics meet thresholds');
    }

    return { success: true, output: lines.join('\n') };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runPerfCommand(): Promise<CommandResult> {
  const start = Date.now();
  const mem = new Memory(process.cwd());
  await mem.searchFacts('test', 5);
  const elapsed = Date.now() - start;

  return {
    success: true,
    output: `Performance:
  Memory Query: ${elapsed}ms
  Platform: ${os.platform()}
  CPU Cores: ${os.cpus().length}
  Free Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB`,
  };
}

async function runCostCommand(): Promise<CommandResult> {
  return {
    success: true,
    output: 'Token usage tracking enabled\nRun /usage for detailed stats',
  };
}

async function runContextCommand(): Promise<CommandResult> {
  const cfg = loadConfig();
  return {
    success: true,
    output: `Context Settings:
  Max Tokens: ${cfg.maxContextTokens}
  Fast Mode: ${cfg.fastMode ? 'enabled' : 'disabled'}
  Thinking: ${cfg.thinkingEnabled ? 'enabled' : 'disabled'}`,
  };
}

async function runUsageCommand(): Promise<CommandResult> {
  return {
    success: true,
    output: `Usage Stats:
  Provider: ${loadConfig().defaultProvider}
  Model: ${loadConfig().defaultModel}
  Memory: ${loadConfig().memoryEnabled ? 'enabled' : 'disabled'}`,
  };
}

async function runModelsCommand(): Promise<CommandResult> {
  return {
    success: true,
    output: `Available Models:
  Default: ${loadConfig().defaultModel}
  Provider: ${loadConfig().defaultProvider}
  Ollama: ${loadConfig().ollamaUrl || 'not configured'}`,
  };
}

async function runEnvCommand(): Promise<CommandResult> {
  const relevant = [
    'TIMPS_API_KEY', 'TIMPS_OLLAMA_URL', 'TIMPS_MCP_SERVERS',
    'TIMPS_BRIDGE_TOKEN', 'TIMPS_BRIDGE_BASE_URL', 'TIMPS_TRUSTED_DEVICE_TOKEN',
  ];

  let output = 'Environment:\n';
  for (const key of relevant) {
    const value = process.env[key];
    if (value) {
      const display = key.includes('KEY') ? '***' : value;
      output += `  ${key}: ${display}\n`;
    }
  }

  return { success: true, output };
}

async function runVersionCommand(): Promise<CommandResult> {
  return {
    success: true,
    output: `TIMPS Code v2.0.0
Platform: ${os.platform()} ${os.arch()}
Node.js: ${process.version}
Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB free`,
  };
}

async function runUpgradeCommand(): Promise<CommandResult> {
  return {
    success: true,
    output: 'Check https://github.com/timps/timps-code/releases for updates',
  };
}

async function runOnboardingCommand(): Promise<CommandResult> {
  return {
    success: true,
    output: `TIMPS Code Onboarding:

1. Configure API Key:
   /api-key set <your-key>

2. Connect to Ollama (optional):
   /model ollama qwen2.5-coder:7b

3. Enable Memory:
   Already enabled by default

4. Install Plugins:
   /plugins browse

5. Connect LSP (for code intelligence):
   /lsp-connect

Run /help for all commands`,
  };
}

// ── New Command Handlers ──

async function runPlanCommand(args: string): Promise<CommandResult> {
  return {
    success: true,
    output: args
      ? `Plan mode enabled: ${args}`
      : `Plan mode enabled. Describe your task or use /compact to summarize.`,
  };
}

async function runWorktreeCommand(args: string): Promise<CommandResult> {
  const subcommand = args.split(' ')[0];
  if (subcommand === 'create' || subcommand === 'new') {
    const name = args.replace(subcommand, '').trim();
    return { success: true, output: `Creating worktree: ${name || 'unnamed'}` };
  }
  if (subcommand === 'exit' || subcommand === 'leave') {
    return { success: true, output: 'Exiting worktree mode' };
  }
  return { success: true, output: 'Worktree: Use /worktree create <name> or /worktree exit' };
}

async function runSkillsCommand(): Promise<CommandResult> {
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  try {
    const files = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir) : [];
    if (files.length === 0) {
      return { success: true, output: 'No skills installed\nInstall skills via npm package or manual placement in ~/.claude/skills/' };
    }
    return { success: true, output: `Installed Skills:\n${files.map(f => `  • ${f}`).join('\n')}` };
  } catch {
    return { success: false, output: '', error: 'Failed to list skills' };
  }
}

async function runTasksCommand(args: string): Promise<CommandResult> {
  if (args === 'list' || !args) {
    return { success: true, output: 'Background Tasks:\n  No active background tasks' };
  }
  return { success: true, output: `Task: ${args}` };
}

async function runTeamCommand(args: string): Promise<CommandResult> {
  const subcommand = args.split(' ')[0];
  switch (subcommand) {
    case 'list':
      return { success: true, output: 'Team Agents:\n  • Coder (default)\n  • Planner\n  • Verifier' };
    case 'add':
      return { success: true, output: 'Adding agent to team...' };
    default:
      return { success: true, output: 'Team: Use /team list, /team add <agent>' };
  }
}

async function runMcpCommand(args: string): Promise<CommandResult> {
  const parts = args.split(' ');
  const subcommand = parts[0];
  const serverName = parts[1];

  switch (subcommand) {
    case 'list':
      const servers = process.env.TIMPS_MCP_SERVERS || '';
      return { success: true, output: servers ? `MCP Servers:\n${servers.split(',').map(s => `  • ${s.trim()}`).join('\n')}` : 'No MCP servers configured' };
    case 'enable':
      return serverName ? { success: true, output: `Enabling MCP server: ${serverName}` } : { success: false, output: '', error: 'Usage: /mcp enable <server-name>' };
    case 'disable':
      return serverName ? { success: true, output: `Disabling MCP server: ${serverName}` } : { success: false, output: '', error: 'Usage: /mcp disable <server-name>' };
    case 'add':
      return { success: true, output: 'Adding MCP server...' };
    default:
      return { success: true, output: 'MCP: Use /mcp list, /mcp enable <name>, /mcp disable <name>, /mcp add' };
  }
}

async function runConfigCommand(args: string): Promise<CommandResult> {
  const cfg = loadConfig();
  if (!args) {
    return {
      success: true,
      output: `Config:
  Model: ${cfg.defaultModel}
  Provider: ${cfg.defaultProvider}
  Max Tokens: ${cfg.maxContextTokens}
  Fast Mode: ${cfg.fastMode ? 'on' : 'off'}
  Memory: ${cfg.memoryEnabled ? 'enabled' : 'disabled'}`,
    };
  }

  const [key, ...valueParts] = args.split(' ');
  const value = valueParts.join(' ');

  switch (key) {
    case 'model':
      return { success: true, output: `Setting model to: ${value || cfg.defaultModel}` };
    case 'provider':
      return { success: true, output: `Setting provider to: ${value || cfg.defaultProvider}` };
    case 'fast-mode':
      return { success: true, output: `Fast mode: ${value === 'on' ? 'enabled' : 'disabled'}` };
    default:
      return { success: false, output: '', error: `Unknown config key: ${key}` };
  }
}

async function runBriefCommand(): Promise<CommandResult> {
  return { success: true, output: 'Brief-only mode: Use /brief to toggle' };
}

async function runContextVisualizeCommand(): Promise<CommandResult> {
  const cfg = loadConfig();
  const mem = new Memory(process.cwd());
  const stats = mem.getStats();
  return {
    success: true,
    output: `Context Usage:
  Max Tokens: ${cfg.maxContextTokens}
  Semantic: ${stats.semanticCount} entries
  Episodes: ${stats.episodeCount}
  Active Files: ${stats.workingFiles}`,
  };
}

async function runCompactCommand(args: string): Promise<CommandResult> {
  const mem = new Memory(process.cwd());
  const before = mem.getStats();
  const count = mem.consolidate();
  const after = mem.getStats();
  return {
    success: true,
    output: `Compact complete:
  Before: ${before.semanticCount} entries
  After: ${after.semanticCount} entries
  Removed: ${count} duplicates
  ${args ? `Custom instructions: ${args}` : ''}`,
  };
}

async function runRewindCommand(args: string): Promise<CommandResult> {
  if (!args) {
    return { success: true, output: 'Rewind: Use /rewind <checkpoint-id> or list checkpoints with /rewind list' };
  }
  if (args === 'list') {
    return { success: true, output: 'Checkpoints:\n  No checkpoints available' };
  }
  return { success: true, output: `Rewinding to: ${args}` };
}

async function runResumeCommand(args: string): Promise<CommandResult> {
  return args
    ? { success: true, output: `Resuming: ${args}` }
    : { success: true, output: 'Resume: Use /resume <conversation-id>' };
}

async function runModelCommand(args: string): Promise<CommandResult> {
  const cfg = loadConfig();
  if (!args) {
    return { success: true, output: `Current model: ${cfg.defaultModel}\nProvider: ${cfg.defaultProvider}` };
  }
  return { success: true, output: `Model set to: ${args}` };
}

async function runOauthCommand(): Promise<CommandResult> {
  return { success: true, output: 'OAuth: Initiating authentication flow...' };
}

async function runPermissionsCommand(args: string): Promise<CommandResult> {
  const parts = args.split(' ');
  const subcommand = parts[0];

  switch (subcommand) {
    case 'list':
      return { success: true, output: 'Allowed Tools:\n  • Read\n  • Edit\n  • Bash\n  • Grep\n  • Glob' };
    case 'allow':
      return { success: true, output: `Allowing tool: ${parts.slice(1).join(' ')}` };
    case 'deny':
      return { success: true, output: `Denying tool: ${parts.slice(1).join(' ')}` };
    default:
      return { success: true, output: 'Permissions: Use /permissions list, /permissions allow <tool>, /permissions deny <tool>' };
  }
}

async function runAgentsCommand(args: string): Promise<CommandResult> {
  const parts = args.split(' ');
  const subcommand = parts[0];

  switch (subcommand) {
    case 'list':
      return { success: true, output: 'Available Agents:\n  • coder (default)\n  • planner\n  • verifier\n  • swarm' };
    case 'create':
      return { success: true, output: 'Creating new agent...' };
    default:
      return { success: true, output: 'Agents: Use /agents list, /agents create <name>' };
  }
}

async function runFeedbackCommand(args: string): Promise<CommandResult> {
  return args
    ? { success: true, output: 'Thank you for your feedback!' }
    : { success: true, output: 'Feedback: Use /feedback <message> to submit feedback' };
}

async function runDebugCommand(): Promise<CommandResult> {
  return {
    success: true,
    output: `Debug Mode:
  Platform: ${os.platform()} ${os.arch()}
  Node: ${process.version}
  Memory Free: ${Math.round(os.freemem() / 1024 / 1024)}MB
  CPU: ${os.cpus().length} cores`,
  };
}

async function runSheafCommand(args: string): Promise<CommandResult> {
  const { Memory } = await import('../memory/memory.js');
  const mem = new Memory(process.cwd());
  const parts = args.trim().split(/\s+/);
  const sub = parts[0] ?? 'status';
  const domain = parts[1] ?? undefined;

  try {
    const weaver = mem.sheafWeaver;

    switch (sub) {
      case 'status': {
        const status = weaver.getStatus();
        const coh = weaver.detectContradictions();
        const lines = [
          'HarmonicSheafWeaver — Layer 9 Status',
          `  Active nodes : ${status.activeNodeCount} / ${status.nodeCount}`,
          `  Edges        : ${status.edgeCount}`,
          `  Avg amplitude: ${status.avgAmplitude.toFixed(4)}`,
          `  Spectral gap : ${status.spectralGap.toFixed(4)}`,
          `  H¹ (Betti-1) : ${status.betti1} ${status.betti1 > 0 ? '⚠️  contradictions' : '✓ consistent'}`,
          '',
          'Domain node counts:',
          ...Object.entries(status.domainCounts).map(([d, c]) => `  ${d.padEnd(16)} ${c}`),
          '',
          `Cohomology: ${coh.isConsistent ? '✓ CONSISTENT — no H¹ obstructions' : `⚠️  INCONSISTENT — ${coh.betti1} non-trivial class(es)`}`,
        ];
        if (!coh.isConsistent) {
          lines.push(`  Contradiction nodes: ${coh.contradictionNodeIds.slice(0, 5).join(', ')}${coh.contradictionNodeIds.length > 5 ? '…' : ''}`);
        }
        return { success: true, output: lines.join('\n') };
      }

      case 'predict': {
        const targetDomain = (domain as import('@timps/memory-core').SheafDomain | undefined) ?? 'burnout';
        const pred = weaver.predict(targetDomain, { lookbackDays: 30 });
        const traj = pred.trajectory.slice(0, 6).map(v => `${Math.round(v * 100)}%`).join(' → ');
        const lines = [
          `HSW Prediction — ${targetDomain}`,
          `  Risk level   : ${pred.riskLevel.toUpperCase()} (${Math.round(pred.riskScore * 100)}%)`,
          `  Trajectory   : ${traj}`,
          `  Confidence   : ${Math.round(pred.confidence * 100)}%`,
          `  Eigenweights : ${pred.eigenmodeWeights.map(w => w.toFixed(3)).join(', ')}`,
          `  Explanation  : ${pred.explanation}`,
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'contradict': {
        const targetDomain = domain as import('@timps/memory-core').SheafDomain | undefined;
        const coh = weaver.detectContradictions(targetDomain ? { domain: targetDomain } : {});
        const domainStr = Object.entries(coh.domainContradictions)
          .map(([d, n]) => `  ${d}: ${n} contradiction(s)`)
          .join('\n');
        const lines = [
          'HSW Cohomology — Algebraic Contradiction Detection',
          `  Betti-1 (H¹) : ${coh.betti1}`,
          `  Spectral gap : ${coh.spectralGap.toFixed(4)}`,
          `  Consistency  : ${coh.isConsistent ? '✓ CONSISTENT' : '⚠️  INCONSISTENT'}`,
          `  Affected nodes: ${coh.contradictionNodeIds.length}`,
          '',
          'By domain:',
          domainStr || '  (none)',
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'consolidate': {
        const report = weaver.consolidate();
        const lines = [
          'HSW Consolidation complete',
          `  Quenched (faded)    : ${report.quenched}`,
          `  Retained            : ${report.retained}`,
          `  Crystallised        : ${report.crystallised}`,
          `  Contradictions res. : ${report.contradictionsResolved}`,
          `  Spectral gap after  : ${report.spectralGap.toFixed(4)}`,
          `  H¹ after            : ${report.bettiNumbers.b1}`,
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'context': {
        const targetDomain = (domain as import('@timps/memory-core').SheafDomain | undefined) ?? 'burnout';
        const ctx = weaver.getContextString(targetDomain, 5);
        return { success: true, output: ctx };
      }

      default:
        return {
          success: true,
          output: 'Usage: /sheaf [status|predict|contradict|consolidate|context] [domain]\n' +
            '  status                   — node/edge counts, spectral gap, H¹\n' +
            '  predict [domain]         — eigenmode foresight trajectory\n' +
            '  contradict [domain]      — algebraic H¹ contradiction report\n' +
            '  consolidate              — quench faded nodes, crystallise stable ones\n' +
            '  context [domain]         — top sheaf nodes for prompt context\n' +
            '\nDomains: burnout relationship decision code_pattern contradiction goal general',
        };
    }
  } catch (err) {
    return { success: false, output: '', error: `Sheaf error: ${(err as Error).message}` };
  }
}

async function runAetherCommand(args: string): Promise<CommandResult> {
  const { Memory } = await import('../memory/memory.js');
  const mem = new Memory(process.cwd());
  const parts = args.trim().split(/\s+/);
  const sub = parts[0] ?? 'status';
  const domain = parts[1] ?? undefined;

  try {
    const forge = mem.aetherForge;

    switch (sub) {
      case 'status': {
        const status = forge.getStatus();
        const coh = forge.detectContradictions();
        const epiDist = Object.entries(status.epistemicDistribution ?? {})
          .map(([s, c]) => `  ${s.padEnd(16)} ${c}`).join('\n');
        const lines = [
          'AetherForgeERL — Layer 10 Status',
          `  Active nodes : ${status.activeNodeCount} / ${status.nodeCount}`,
          `  Edges        : ${status.edgeCount}`,
          `  Avg amplitude: ${status.avgAmplitude.toFixed(4)}`,
          `  Spectral gap : ${status.spectralGap.toFixed(4)}`,
          `  H¹ (Betti-1) : ${status.betti1} ${status.betti1 > 0 ? '⚠️  contradictions' : '✓ consistent'}`,
          `  Lattice levels: ${status.latticeLevelCount}`,
          '',
          'Epistemic status distribution:',
          epiDist || '  (none)',
          '',
          'Domain node counts:',
          ...Object.entries(status.domainCounts).map(([d, c]) => `  ${d.padEnd(16)} ${c}`),
          '',
          `Cohomology: ${coh.isConsistent ? '✓ CONSISTENT — no H¹ obstructions' : `⚠️  INCONSISTENT — ${coh.betti1} non-trivial class(es)`}`,
        ];
        if (!coh.isConsistent) {
          lines.push(`  Contradiction nodes: ${coh.contradictionNodeIds.slice(0, 5).join(', ')}${coh.contradictionNodeIds.length > 5 ? '…' : ''}`);
        }
        return { success: true, output: lines.join('\n') };
      }

      case 'predict': {
        const targetDomain = (domain as import('@timps/memory-core').ERLDomain) ?? 'burnout' as import('@timps/memory-core').ERLDomain;
        const pred = forge.predict(targetDomain, { lookbackDays: 30 });
        const traj = pred.trajectory.slice(0, 6).map(v => `${Math.round(v * 100)}%`).join(' → ');
        const lines = [
          `ERL Prediction — ${targetDomain}`,
          `  Risk level        : ${pred.riskLevel.toUpperCase()} (${Math.round(pred.riskScore * 100)}%)`,
          `  Trajectory        : ${traj}`,
          `  Confidence        : ${Math.round(pred.confidence * 100)}%`,
          `  Epistemic weight  : ${pred.epistemicWeight.toFixed(3)}`,
          `  Contradiction burd: ${pred.contradictionBurden.toFixed(3)}`,
          `  Explanation       : ${pred.explanation}`,
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'contradict': {
        const coh = forge.detectContradictions();
        const domainStr = Object.entries(coh.domainContradictions ?? {})
          .map(([d, n]) => `  ${d}: ${n} contradiction(s)`)
          .join('\n');
        const lines = [
          'ERL Cohomology — Epistemic Contradiction Detection',
          `  Betti-1 (H¹)     : ${coh.betti1}`,
          `  Spectral gap     : ${coh.spectralGap.toFixed(4)}`,
          `  Consistency       : ${coh.isConsistent ? '✓ CONSISTENT' : '⚠️  INCONSISTENT'}`,
          `  Affected nodes    : ${coh.contradictionNodeIds.length}`,
          '',
          'By domain:',
          domainStr || '  (none)',
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'consolidate': {
        const report = forge.consolidate();
        const lines = [
          'ERL Consolidation complete',
          `  Quenched (faded)    : ${report.quenched}`,
          `  Retained            : ${report.retained}`,
          `  Crystallised        : ${report.crystallised}`,
          `  Contradictions res. : ${report.contradictionsResolved}`,
          `  Spectral gap after  : ${report.spectralGap.toFixed(4)}`,
          `  H¹ after            : ${report.bettiNumbers.b1}`,
          `  Lattice levels after: ${report.latticeLevelCount}`,
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'context': {
        const targetDomain = (domain as import('@timps/memory-core').ERLDomain) ?? 'burnout' as import('@timps/memory-core').ERLDomain;
        const ctx = forge.getContextString(targetDomain, 5);
        return { success: true, output: ctx };
      }

      default:
        return {
          success: true,
          output: 'Usage: /aether [status|predict|contradict|consolidate|context] [domain]\n' +
            '  status                   — node/edge counts, spectral gap, H¹, epistemic distribution\n' +
            '  predict [domain]         — epistemic resonance drift prediction\n' +
            '  contradict               — H¹ epistemic contradiction report\n' +
            '  consolidate              — consolidate lattice, quench faded nodes\n' +
            '  context [domain]         — top epistemic nodes for prompt context\n' +
            '\nDomains: burnout contradiction relationship decision code_pattern goal general',
        };
    }
  } catch (err) {
    return { success: false, output: '', error: `Aether error: ${(err as Error).message}` };
  }
}

async function runQISRDCommand(args: string): Promise<CommandResult> {
  const { Memory } = await import('../memory/memory.js');
  const { injectQISRDContext } = await import('../memory/qisrdVeil.js');
  const mem = new Memory(process.cwd());
  const parts = args.trim().split(/\s+/);
  const sub = parts[0] ?? 'status';
  const domain = parts[1] ?? undefined;

  try {
    const q = mem.qisrd;

    switch (sub) {
      case 'status': {
        const st = q.status();
        const contra = q.detectContradictions();
        const lines = [
          'QISRD — Layer 15: Sheaf Resonance Dynamics',
          `  Nodes            : ${st.nodeCount}`,
          `  Edges            : ${st.edgeCount}`,
          `  Drift score      : ${st.driftScore.toFixed(3)}`,
          `  H¹ (Betti-1)     : ${contra.betti1} ${contra.isConsistent ? '✓ consistent' : '⚠️  contradictions'}`,
          `  Spectral gap     : ${contra.spectralGap.toFixed(4)}`,
          `  Anomaly nodes    : ${contra.anomalyNodes.length}`,
          `  Topology surgery : ${st.lastTopologySurgeryAt ? new Date(st.lastTopologySurgeryAt).toISOString() : 'never'}`,
          `  Eigenvalues      : [${st.cachedEigenvalues.slice(0, 5).map(v => v.toFixed(3)).join(', ')}${st.cachedEigenvalues.length > 5 ? '…' : ''}]`,
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'predict': {
        const targetDomain = (domain ?? 'burnout') as import('@timps/memory-core').QISRDDomain;
        const pred = q.predict(targetDomain);
        const traj = pred.trajectory.slice(0, 8).map(v => `${(v * 100).toFixed(0)}%`).join(' → ');
        const lines = [
          `QISRD Resonance Prediction — ${targetDomain}`,
          `  Risk level      : ${pred.riskLevel.toUpperCase()} (${(pred.riskScore * 100).toFixed(0)}%)`,
          `  Resonance       : ${pred.resonance.toFixed(3)}`,
          `  Uncertainty     : ${pred.uncertainty.toFixed(3)}`,
          `  Trajectory      : ${traj}${pred.trajectory.length > 8 ? '…' : ''}`,
          `  Explanation     : ${pred.explanation}`,
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'contradict': {
        const contra = q.detectContradictions(domain ? { domain: domain as import('@timps/memory-core').QISRDDomain } : {});
        const lines = [
          'QISRD Sheaf Cohomology — Contradiction Detection',
          `  H¹ (Betti-1)     : ${contra.betti1}`,
          `  Spectral gap     : ${contra.spectralGap.toFixed(4)}`,
          `  Consistency       : ${contra.isConsistent ? '✓ CONSISTENT' : '⚠️  INCONSISTENT'}`,
          `  Drift score       : ${contra.driftScore.toFixed(3)}`,
          `  Anomaly nodes     : ${contra.anomalyNodes.length}`,
        ];
        for (const a of contra.anomalyNodes.slice(0, 10)) {
          lines.push(`    ${a.nodeId.slice(-8)}  h¹=${a.h1Contribution.toFixed(2)}  [${a.domain}]`);
        }
        return { success: true, output: lines.join('\n') };
      }

      case 'consolidate': {
        const report = q.consolidate();
        const lines = [
          'QISRD Consolidation — Topology Surgery',
          `  Pruned              : ${report.pruned}`,
          `  Retained            : ${report.retained}`,
          `  Contradictions res. : ${report.resolvedContradictions}`,
          `  Surgery triggered   : ${report.topologySurgery ? 'yes' : 'no'}`,
          `  Drift after         : ${report.driftAfter.toFixed(3)}`,
        ];
        return { success: true, output: lines.join('\n') };
      }

      case 'context': {
        const ctx = injectQISRDContext(mem, domain ? [domain as import('@timps/memory-core').QISRDDomain] : undefined);
        return {
          success: true,
          output: ctx.promptFragment
            ? `QISRD Context Injection\n${ctx.promptFragment}\n${ctx.warnings.length > 0 ? `Warnings:\n${ctx.warnings.map(w => `  ⚠️  ${w}`).join('\n')}` : '  (no warnings)'}`
            : 'QISRD: no relevant context found',
        };
      }

      default:
        return {
          success: true,
          output: 'Usage: /qisrd [status|predict|contradict|consolidate|context] [domain]\n' +
            '  status                   — node/edge counts, H¹, drift, eigenvalues\n' +
            '  predict [domain]         — Langevin-resonance risk prediction\n' +
            '  contradict [domain]      — H¹ sheaf cohomology contradiction report\n' +
            '  consolidate              — topology surgery (merge/prune)\n' +
            '  context [domain]         — QISRD prompt context injection\n' +
            '\nDomains: burnout relationship decision code_pattern contradiction goal general',
        };
    }
  } catch (err) {
    return { success: false, output: '', error: `QISRD error: ${(err as Error).message}` };
  }
}

async function runMemoryCommand(args: string): Promise<CommandResult> {
  const mem = new Memory(process.cwd());
  const parts = args.split(' ');

  switch (parts[0]) {
    case 'export':
      return { success: true, output: 'Exporting memory...' };
    case 'import':
      return { success: true, output: 'Importing memory...' };
    case 'clear':
      mem.clearAll();
      return { success: true, output: 'Memory cleared' };
    case 'stats':
      const stats = mem.getStats();
      return {
        success: true,
        output: `Memory Stats:
  Semantic: ${stats.semanticCount}
  Episodes: ${stats.episodeCount}
  Working: ${stats.workingFiles}
  Procedural: ${stats.proceduralCount}
  Graph Nodes: ${stats.graphNodes}`,
      };
    case 'compact':
      const count = mem.consolidate();
      return { success: true, output: `Consolidated: ${count} entries removed` };
    default:
      return { success: true, output: 'Memory: Use /memory stats, /memory export, /memory import, /memory clear, /memory compact' };
  }
}

async function runSessionCommand(): Promise<CommandResult> {
  return { success: true, output: 'Remote session URL: Not connected\nUse /bridge start to enable remote access' };
}

async function runHooksCommand(): Promise<CommandResult> {
  return { success: true, output: 'Tool Hooks:\n  No hooks configured\nUse /hooks add <tool> <action>' };
}

async function runCommitCommand(): Promise<CommandResult> {
  return { success: true, output: 'Commit: Use /commit to create a git commit' };
}

async function runBranchCommand(args: string): Promise<CommandResult> {
  if (!args) {
    return { success: true, output: 'Branch: Use /branch <name> to create a branch' };
  }
  return { success: true, output: `Creating branch: ${args}` };
}

async function runAuditCommandHandler(args: string): Promise<CommandResult> {
  const mem = new Memory(process.cwd());
  const parts = args.split(' ');
  const options: Record<string, string> = {};
  let typeFilter: string | undefined;
  let limit: number | undefined;
  let format: 'table' | 'json' = 'table';

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '--member' || parts[i] === '-m') options.member = parts[++i];
    else if (parts[i] === '--since' || parts[i] === '-s') options.since = parts[++i];
    else if (parts[i] === '--type' || parts[i] === '-t') typeFilter = parts[++i];
    else if (parts[i] === '--limit' || parts[i] === '-l') limit = parseInt(parts[++i], 10);
    else if (parts[i] === '--json' || parts[i] === '-j') format = 'json';
  }

  try {
    const output = await runAuditCommand(mem, {
      member: options.member,
      since: options.since,
      type: typeFilter,
      limit,
      format,
    });
    return { success: true, output };
  } catch (err) {
    return { success: false, output: '', error: `Audit error: ${(err as Error).message}` };
  }
}

async function runTeamDigestHandler(args: string): Promise<CommandResult> {
  const mem = new Memory(process.cwd());
  const since = args || undefined;
  try {
    const output = await runTeamDigestCommand(mem, since);
    return { success: true, output };
  } catch (err) {
    return { success: false, output: '', error: `Digest error: ${(err as Error).message}` };
  }
}

// ── Config Commands ──

async function runConfigSetCommand(args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return { success: false, output: '', error: 'Usage: /config set <key> <value>. Keys: llm.openai.api_key, llm.anthropic.api_key, llm.openai.rate_limit, fallback.chain' };
  }
  const key = args[0];
  const value = args.slice(1).join(' ');

  const cfg = loadConfig();

  // llm.<provider>.api_key
  const apiKeyMatch = key.match(/^llm\.(\w+)\.api_key$/);
  if (apiKeyMatch) {
    const provider = apiKeyMatch[1];
    const providerMap: Record<string, ProviderName> = { anthropic: 'claude', openai: 'openai', gemini: 'gemini', openrouter: 'openrouter', deepseek: 'deepseek', groq: 'groq' };
    const mapped = providerMap[provider];
    if (!mapped) return { success: false, output: '', error: `Unknown provider: ${provider}` };
    cfg.keys[mapped] = encrypt(value);
    saveConfig(cfg);
    return { success: true, output: `API key set for ${provider} (encrypted at rest)` };
  }

  // llm.<provider>.rate_limit or llm.<provider>.rate_limit.max_per_day
  const rateLimitMatch = key.match(/^llm\.(\w+)\.rate_limit(?:\..+)?$/);
  if (rateLimitMatch) {
    const provider = rateLimitMatch[1];
    const providerMap: Record<string, ProviderName> = { anthropic: 'claude', openai: 'openai' };
    const mapped = providerMap[provider] || provider as ProviderName;
    if (!cfg.providerLimits) cfg.providerLimits = {};
    if (!cfg.providerLimits[mapped]) cfg.providerLimits[mapped] = { maxPerDay: 1000, maxPerMinute: 60 } as ProviderLimitConfig;
    const numVal = parseInt(value);
    if (isNaN(numVal)) return { success: false, output: '', error: 'Value must be a number' };
    const limits = cfg.providerLimits[mapped]!;
    if (key.endsWith('max_per_day')) {
      limits.maxPerDay = numVal;
    } else if (key.endsWith('max_per_minute')) {
      limits.maxPerMinute = numVal;
    } else {
      cfg.providerLimits[mapped] = { maxPerDay: numVal, maxPerMinute: limits.maxPerMinute };
    }
    saveConfig(cfg);
    return { success: true, output: `Rate limit set for ${mapped}: ${cfg.providerLimits[mapped]!.maxPerDay}/day, ${cfg.providerLimits[mapped]!.maxPerMinute}/min` };
  }

  if (key === 'rate_limit_strategy') {
    if (value !== 'fallback' && value !== 'block') {
      return { success: false, output: '', error: 'Strategy must be "fallback" or "block"' };
    }
    cfg.rateLimitStrategy = value as 'fallback' | 'block';
    saveConfig(cfg);
    return { success: true, output: `Rate limit strategy set to: ${value}` };
  }

  if (key === 'fallback.chain') {
    const providers = value.split(',').map(s => s.trim());
    const validProviders = ['claude', 'openai', 'gemini', 'ollama', 'openrouter', 'deepseek', 'groq'];
    for (const p of providers) {
      if (!validProviders.includes(p)) return { success: false, output: '', error: `Invalid provider: ${p}` };
    }
    cfg.fallbackChain = providers.map(p => ({ provider: p as any, model: '' }));
    saveConfig(cfg);
    return { success: true, output: `Fallback chain set to: ${providers.join(' → ')}` };
  }

  return { success: false, output: '', error: `Unknown config key: ${key}. Use /help for available keys.` };
}

async function runConfigListProvidersCommand(): Promise<CommandResult> {
  const cfg = loadConfig();
  const { getProviderStatus } = await import('../config/config.js');
  const providers = ['claude', 'openai', 'gemini', 'ollama', 'openrouter', 'deepseek', 'groq'];
  const lines: string[] = ['Provider     Status    Key     Daily Usage         Rate Limit'];
  lines.push('─── ──────── ──────── ──── ──── ─────────────         ──────────');
  for (const p of providers) {
    const status = getProviderStatus(cfg, p as any);
    const usageStr = status.configured
      ? `${status.usage.dayCount}/${status.limit.maxPerDay}`
      : '─';
    const limitStr = `${status.limit.maxPerDay}/d ${status.limit.maxPerMinute}/m`;
    const keyStr = status.keySet ? '✓' : (p === 'ollama' ? 'free' : '✗');
    const statusStr = status.configured ? '✓ active' : '○ unconfigured';
    lines.push(`${p.padEnd(12)} ${statusStr.padEnd(10)} ${keyStr.padEnd(6)} ${usageStr.padEnd(18)} ${limitStr}`);
  }
  return { success: true, output: lines.join('\n') };
}

async function runConfigTestCommand(args: string[]): Promise<CommandResult> {
  const provider = args[0];
  if (!provider) return { success: false, output: '', error: 'Usage: /config test <provider>' };
  const cfg = loadConfig();
  const { getApiKey } = await import('../config/config.js');
  const key = getApiKey(cfg, provider as any);
  if (!key && provider !== 'ollama') {
    return { success: false, output: '', error: `No API key configured for ${provider}` };
  }
  // Test by making a lightweight API call
  try {
    const start = Date.now();
    if (provider === 'ollama') {
      const response = await fetch(`${cfg.ollamaUrl || 'http://localhost:11434'}/api/tags`);
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    } else if (provider === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': key!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      if (!response.ok) throw new Error(`Claude returned ${response.status}: ${await response.text()}`);
    } else if (provider === 'openai' || provider === 'openrouter' || provider === 'deepseek' || provider === 'groq') {
      const baseUrls: Record<string, string> = { openai: 'https://api.openai.com', openrouter: 'https://openrouter.ai/api', deepseek: 'https://api.deepseek.com', groq: 'https://api.groq.com' };
      const response = await fetch(`${baseUrls[provider] || 'https://api.openai.com'}/v1/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!response.ok) throw new Error(`${provider} returned ${response.status}`);
    } else if (provider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
      if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    }
    const latency = Date.now() - start;
    recordUsage(provider as any);
    return { success: true, output: `✓ Connected to ${provider} (latency: ${latency}ms)` };
  } catch (err) {
    return { success: false, output: '', error: `✗ ${provider} connection failed: ${(err as Error).message}` };
  }
}

async function runConfigResetUsageCommand(args: string[]): Promise<CommandResult> {
  const provider = args[0] as any;
  resetUsage(provider);
  return { success: true, output: provider ? `Usage stats reset for ${provider}` : 'All usage stats reset' };
}

// ── Auth Commands ──

async function runAuthCommand(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    const session = getSession();
    if (session) {
      return { success: true, output: `Logged in as ${session.username} (${session.role}) — session expires ${new Date(session.expiresAt).toLocaleString()}` };
    }
    return { success: false, output: '', error: 'Not logged in. Use /auth create-user <username> (first time) or /auth login <username>' };
  }

  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case 'login':
      return runAuthLoginCommand(rest);
    case 'create-user':
      return runAuthCreateUserCommand(rest);
    case 'list-users':
      return runAuthListUsersCommand();
    case 'delete-user':
      return runAuthDeleteUserCommand(rest);
    case 'set-role':
      return runAuthSetRoleCommand(rest);
    case 'logout':
      return runAuthLogoutCommand();
    case 'status':
      return runAuthStatusCommand();
    default:
      return { success: false, output: '', error: `Unknown auth subcommand: ${subcommand}` };
  }
}

async function runAuthCreateUserCommand(args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return { success: false, output: '', error: 'Usage: /auth create-user <username> <password> [--role admin|member|viewer]' };
  }
  const username = args[0];
  const password = args[1];
  const roleIdx = args.indexOf('--role');
  const role = roleIdx >= 0 && args[roleIdx + 1] ? args[roleIdx + 1] as any : 'member';

  try {
    const user = createUser(username, password, role);
    return { success: true, output: `User "${user.username}" created with role "${user.role}"` };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runAuthLoginCommand(args: string[]): Promise<CommandResult> {
  if (args.length < 2) {
    return { success: false, output: '', error: 'Usage: /auth login <username> <password>' };
  }
  const username = args[0];
  const password = args[1];

  const user = verifyPassword(username, password);
  if (!user) {
    return { success: false, output: '', error: 'Invalid username or password' };
  }

  const session = createSession(username);
  return { success: true, output: `Logged in as ${session.username} (${session.role}) — session expires ${new Date(session.expiresAt).toLocaleString()}` };
}

async function runAuthListUsersCommand(): Promise<CommandResult> {
  const users = listUsers();
  if (users.length === 0) return { success: true, output: 'No users configured' };
  const lines = users.map(u => `${u.username.padEnd(20)} ${u.role.padEnd(10)} created ${new Date(u.createdAt).toLocaleDateString()}`);
  return { success: true, output: ['Users:', ...lines].join('\n') };
}

async function runAuthDeleteUserCommand(args: string[]): Promise<CommandResult> {
  if (args.length < 1) return { success: false, output: '', error: 'Usage: /auth delete-user <username>' };
  const deleted = deleteUser(args[0]);
  return deleted
    ? { success: true, output: `User "${args[0]}" deleted` }
    : { success: false, output: '', error: `User "${args[0]}" not found` };
}

async function runAuthSetRoleCommand(args: string[]): Promise<CommandResult> {
  if (args.length < 2) return { success: false, output: '', error: 'Usage: /auth set-role <username> <role>' };
  const user = setUserRole(args[0], args[1] as any);
  return user
    ? { success: true, output: `User "${user.username}" role set to ${user.role}` }
    : { success: false, output: '', error: `User "${args[0]}" not found` };
}

async function runAuthLogoutCommand(): Promise<CommandResult> {
  clearSession();
  return { success: true, output: 'Logged out' };
}

async function runAuthStatusCommand(): Promise<CommandResult> {
  const session = getSession();
  if (session) {
    return { success: true, output: `Authenticated as ${session.username} (${session.role}) — session expires ${new Date(session.expiresAt).toLocaleString()}` };
  }
  return { success: true, output: 'Not authenticated' };
}

export async function handleSlashCommand(input: string): Promise<string> {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return trimmed;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  const result = await executeCommand(command, args);

  if (result.success) {
    return result.output;
  } else if (result.error) {
    return `Error: ${result.error}`;
  }

  return '';
}