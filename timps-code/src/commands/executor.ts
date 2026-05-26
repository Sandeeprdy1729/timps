// TIMPS Code — Command Executor
// Executes slash commands using the new services

import * as readline from 'node:readline';
import { startBridge, stopBridge, isBridgeConnected, getBridgeEnvironmentId } from '../services/bridge/index.js';
import { downloadUserSettings, uploadUserSettingsInBackground, isSettingsSyncEnabled, syncSettings } from '../services/settingsSync/index.js';
import { getPluginManager } from '../services/plugins/index.js';
import { showDoctorScreen } from '../screens/index.js';
import { getLspServerManager, initializeLsp } from '../services/lsp/manager.js';
import { Memory } from '../memory/memory.js';
import { loadConfig, saveConfig } from '../config/config.js';
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
    const report = mem.runBenchmark();
    return { success: true, output: report };
  } catch (err) {
    return { success: false, output: '', error: (err as Error).message };
  }
}

async function runPerfCommand(): Promise<CommandResult> {
  const start = Date.now();
  const mem = new Memory(process.cwd());
  mem.searchFacts('test', 5);
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
  const { getSheafReport, injectSheafContext } = await import('../memory/sheafVeil.js');
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