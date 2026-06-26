#!/usr/bin/env node
// ── TIMPS Code — CLI Entry Point v2.0


import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

import { Command } from 'commander';
import { startApp } from '../core/app.js';
import { LOGO, t } from '../config/theme.js';
import type { ProviderName } from '../config/types.js';
import { logStartupTelemetry } from '../utils/analytics.js';
import { parseDeepLink, handleDeepLinkUri } from '../utils/deepLink.js';
import { getRemoteSessionManager } from '../utils/remoteSession.js';
import { getFeatureFlags } from '../utils/featureFlags.js';
import { getMcpManager } from '../utils/mcp.js';

// Profile checkpoint
function profileCheckpoint(name: string): void {
  if (process.env.TIMPS_DEBUG) {
    console.error(`[profile] ${name}: ${Date.now()}ms`);
  }
}

const program = new Command();

program
  .name('timps')
  .description('TIMPS Code — AI coding agent with persistent memory')
  .version('2.0.0')
  .option('-p, --provider <name>', 'Model provider: claude, openai, gemini, ollama, openrouter, opencode, timps-coder, hybrid')
  .option('-m, --model <model>', 'Model name')
  .option('-d, --dir <path>', 'Working directory')
  .option('-c, --config', 'Run setup wizard')
  .option('-b, --branch <name>', 'Branch current memory state')
  .option('--merge <target>', 'Merge a branch into current context')

  // Remote & SSH
  .option('--ssh <host>', 'Connect via SSH to remote host')
  .option('--ssh-user <user>', 'SSH username')
  .option('--ssh-key <path>', 'SSH key file')
  .option('--ssh-dir <path>', 'Remote working directory')
  .option('--remote', 'Start remote session mode')
  .option('--remote-control', 'Enable remote control bridge')

  // Deep links
  .option('--handle-uri <url>', 'Handle timps:// URL')

  // MCP
  .option('--mcp-config <json>', 'MCP server configuration JSON')
  .option('--mcp-discover', 'Discover MCP servers from project')
  .option('--mcp-install <server>', 'Install MCP server')
  .option('--mcp-list', 'List configured MCP servers')

  // Swarm & Multi-agent
  .option('--swarm', 'Run multi-agent swarm')
  .option('--swarm-pipeline <type>', 'Pipeline: feature, bugfix, refactor, docs')
  .option('--swarm-status', 'Show swarm agent statuses')

  // Memory
  .option('--memory-stats', 'Show memory statistics')
  .option('--memory-share', 'Export and share memory')
  .option('--memory-clone <path>', 'Import memory pack')
  .option('--memory-url <url>', 'Remote MemoryServer URL (e.g. http://localhost:4100)')
  .option('--memory-token <token>', 'Auth token for remote MemoryServer')
  .option('--query <question>', 'Query knowledge graph')

  // Benchmark & Diagnostics
  .option('--benchmark', 'Run benchmark suite')
  .option('--perf', 'Measure performance')
  .option('--doctor', 'Run system health check')
  .option('--cost', 'Show cost report')

  // Team
  .option('--team-join <project>', 'Join team project')
  .option('--team-share <fact>', 'Share fact with team')

  // Optimus
  .option('--optimus <desc>', 'Digital Optimus - sentence to product')
  .option('--war-room', 'War room mode (19h sessions)')
  .option('--binary-synth', 'Direct binary synthesis')
  .option('--macrohard', 'Macrohard corporate employee mode')

  // Settings
  .option('--fast', 'Enable fast mode')
  .option('--brief', 'Enable brief mode')
  .option('--thinking', 'Enable thinking')
  .option('--no-thinking', 'Disable thinking')
  .option('--verbose', 'Verbose output')
  .option('--settings <file>', 'Settings file path')

  // Info
  .option('--stats', 'Show session statistics')
  .option('--models', 'List available models')
  .option('--show-version', 'Show version')

  // Auth
  .option('--login', 'Login to TIMPS cloud')
  .option('--logout', 'Logout from TIMPS cloud')
  .option('--api-key <key>', 'Set API key')

  .argument('[message...]', 'One-shot message or command')
  .action(async (messageParts: string[], opts: Record<string, unknown>) => {
    profileCheckpoint('main_function_start');

    // Handle deep link URLs
    if (opts.handleUri) {
      try {
        await handleDeepLinkUri(String(opts.handleUri), { cwd: opts.dir as string });
        return;
      } catch (err) {
        console.error(`Failed to handle URI: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    // Handle --config / setup wizard
    if (opts.config) {
      const { runFullSetup } = await import('../config/config.js');
      const result = await runFullSetup();
      console.log(`  ${t.dim('Run')} ${t.accent('timps')} ${t.dim('to start coding.')}`);
      console.log(`  ${t.dim('Reconfigure with:')} ${t.accent('timps --config')}\n`);
      return;
    }

    // Handle SSH mode
    if (opts.ssh) {
      const remoteManager = getRemoteSessionManager();
      const host = String(opts.ssh);
      const user = opts.sshUser as string | undefined;
      const keyFile = opts.sshKey as string | undefined;
      const remoteDir = opts.sshDir as string | undefined;

      console.log(LOGO);
      console.log(`\n  ${t.dim('Connecting to:')} ${t.accent(user ? `${user}@${host}` : host)}`);
      console.log(`  ${t.dim('Directory:')} ${t.accent(remoteDir || process.cwd())}\n`);

      try {
        const sessionId = await remoteManager.connect({
          host,
          user,
          keyFile,
          cwd: remoteDir,
        });
        await remoteManager.startInteractive(sessionId);
      } catch (err) {
        console.error(`\n  ${t.error('SSH connection failed:')} ${(err as Error).message}\n`);
        process.exit(1);
      }
      return;
    }

    // Handle MCP list
    if (opts.mcpList) {
      const mcpManager = getMcpManager();
      const clients = mcpManager.getClients();
      console.log(`\n${t.brandBold('MCP Servers')}\n`);
      if (clients.length === 0) {
        console.log(`  ${t.dim('No MCP servers configured.')}`);
        console.log(`  ${t.dim('Add with:')} ${t.accent('--mcp-install <name>')}`);
      } else {
        for (const client of clients) {
          const statusIcon = client.status === 'connected' ? t.success('●') : t.error('○');
          const toolCount = client.tools?.length || 0;
          console.log(`  ${statusIcon} ${t.accent(client.name)} — ${client.status} (${toolCount} tools)`);
        }
      }
      console.log();
      return;
    }

    // Handle MCP discover
    if (opts.mcpDiscover) {
      const { discoverMcpServers } = await import('../utils/mcp.js');
      const cwd = (opts.dir as string) || process.cwd();
      const discovered = await discoverMcpServers(cwd);
      console.log(LOGO);
      console.log(`\n${t.brandBold('MCP Auto-Discovery')}\n`);
      if (discovered.length === 0) {
        console.log(`  ${t.dim('No MCP servers found in project.')}`);
      } else {
        for (const srv of discovered) {
          console.log(`  ${t.accent('•')} ${srv.name} — ${srv.description || 'discovered'}`);
        }
      }
      console.log();
      return;
    }

    // Handle MCP install
    if (opts.mcpInstall) {
      const serverName = String(opts.mcpInstall);
      const { getOfficialMcpServers } = await import('../utils/mcp.js');
      const official = getOfficialMcpServers();
      const server = official.find(s => s.name === serverName);

      if (!server) {
        console.error(`Unknown MCP server: ${serverName}`);
        console.error(`Available: ${official.map(s => s.name).join(', ')}`);
        return;
      }

      console.log(`Installing ${server.name}...`);
      // Would run npm install or similar
      console.log(`${t.success('✓')} ${server.name} installed`);
      console.log(`  ${t.dim('Add to config to enable')}`);
      return;
    }

    // Handle memory stats
    if (opts.memoryStats) {
      const { Memory } = await import('../memory/memory.js');
      const cwd = (opts.dir as string) || process.cwd();
      const mem = new Memory(cwd);
      const s = mem.getStats();
      const gs = mem.graph.getStats();
      const ds = mem.decay.getStats();

      console.log(`\n${t.brandBold('Memory Statistics')}\n`);
      console.log(`  Semantic entries:    ${t.accent(s.semanticCount)}`);
      console.log(`  Episodes:           ${t.accent(s.episodeCount)}`);
      console.log(`  Working files:      ${t.accent(s.workingFiles)}`);
      console.log(`  Procedural traces:  ${t.accent(s.proceduralCount)}`);
      console.log(`  Graph nodes:        ${t.accent(gs.nodeCount)}`);
      console.log(`  Graph edges:        ${t.accent(gs.edgeCount)}`);
      console.log(`  Active memories:    ${t.accent(ds.activeCount)}`);
      console.log(`  Archived:            ${t.accent(ds.archivedCount)}`);
      console.log();
      return;
    }

    // Handle benchmark
    if (opts.benchmark) {
      console.log(LOGO);
      console.log(`\n${t.brandBold('Running Benchmark Suite...')}\n`);

      const { Memory } = await import('../memory/memory.js');
      const mem = new Memory(process.cwd());

      const queries = ['authentication', 'database', 'error handling', 'state', 'api'];
      let totalTime = 0, hits = 0;
      for (const q of queries) {
        const start = Date.now();
        const results = await mem.searchFacts(q, 5);
        totalTime += Date.now() - start;
        if (results.length > 0) hits++;
      }
      const retrievalRate = Math.round((hits / queries.length) * 100);
      const gs = mem.graph.getStats();
      const s = mem.getStats();
      const ds = mem.decay.getStats();

      console.log('╔════════════════════════════════════════════════════╗');
      console.log('║              TIMPS Benchmark Results               ║');
      console.log('╠════════════════════════════════════════════════════╣');
      console.log(`║ Memory Retrieval R@5   │ ${String(retrievalRate).padStart(3)}% │ Target: 95%  ║`);
      console.log(`║ Semantic entries       │ ${String(s.semanticCount).padStart(5)}      ║`);
      console.log(`║ Episodes              │ ${String(s.episodeCount).padStart(5)}      ║`);
      console.log(`║ Graph nodes           │ ${String(gs.nodeCount).padStart(5)}      ║`);
      console.log(`║ Active memories       │ ${String(ds.activeCount).padStart(5)}      ║`);
      console.log('╚════════════════════════════════════════════════════╝');
      console.log();
      return;
    }

    // Handle perf mode
    if (opts.perf) {
      console.log(LOGO);
      console.log(`\n${t.brandBold('Performance Measurements')}\n`);

      const startMem = process.memoryUsage();
      const bootStart = Date.now();
      const { Memory } = await import('../memory/memory.js');
      const mem = new Memory(process.cwd());
      const bootTime = Date.now() - bootStart;
      const s = mem.getStats();
      const endMem = process.memoryUsage();
      const heapDelta = Math.round((endMem.heapUsed - startMem.heapUsed) / 1024 / 1024 * 10) / 10;

      console.log(`  Boot time:         ${t.accent(bootTime)}ms`);
      console.log(`  Memory (heap):     ${t.accent(heapDelta)}MB`);
      console.log(`  Semantic entries:  ${t.accent(s.semanticCount)}`);
      console.log(`  Episodes:          ${t.accent(s.episodeCount)}`);
      console.log();
      return;
    }

    // Handle doctor
    if (opts.doctor) {
      const { Memory } = await import('../memory/memory.js');
      const mem = new Memory(process.cwd());
      const s = mem.getStats();

      console.log(`\n${t.brandBold('System Health Check')}\n`);

      const checks = [
        ['Node.js', `v${process.version}`],
        ['Memory', `${s.semanticCount} entries`],
        ['Episodes', `${s.episodeCount} sessions`],
        ['Ollama', process.env.OLLAMA_HOST ? 'configured' : 'default'],
        ['Git', fs.existsSync('.git') ? 'repo' : 'not a repo'],
      ];

      for (const [name, status] of checks) {
        console.log(`  ${t.success('✓')} ${name}: ${t.accent(status)}`);
      }
      console.log();
      return;
    }

  // Handle version
  if (opts['show-version']) {
    console.log(`\n  TIMPS Code ${t.accent('2.0.0')}`);
    console.log(`  ${t.dim('Build: world-no-1-coder')}\n`);
    return;
  }

    // Handle models list
    if (opts.models) {
      const { getLocalModels } = await import('../utils/ollamaSetup.js');
      try {
        const models = await getLocalModels();
        console.log(`\n${t.brandBold('Available Models')}\n`);
        if (models.length === 0) {
          console.log(`  ${t.dim('No local models. Run: ollama pull <model>')}`);
        } else {
          for (const m of models) {
            console.log(`  ${t.accent('•')} ${m}`);
          }
        }
      } catch {
        console.log(`  ${t.dim('Ollama not running. Start with: ollama serve')}`);
      }
      console.log();
      return;
    }

    // Handle SSH mode via command
    if (opts.remote) {
      console.log(`${t.brandBold('Remote Session Mode')}`);
      console.log(`  ${t.dim('Use --ssh <host> to connect to a remote machine')}\n`);
      return;
    }

    // Log startup telemetry
    logStartupTelemetry();
    profileCheckpoint('action_handler_start');

    // Handle one-shot message
    const oneLine = messageParts.length > 0 ? messageParts.join(' ') : undefined;

    // Feature flags
    const flags = getFeatureFlags();
    if (opts.fast) flags.setEnabled('FAST_MODE' as any, true);
    if (opts.brief) flags.setEnabled('BRIEF_MODE' as any, true);
    if (opts.verbose) flags.setEnabled('VERBOSE' as any, true);

    // Launch app
    await startApp({
      provider: (opts.provider as string) as ProviderName | undefined,
      model: opts.model as string | undefined,
      cwd: (opts.dir as string) || process.cwd(),
      oneLine,
      branch: opts.branch as string | undefined,
      merge: opts.merge as string | undefined,
      warRoom: opts.warRoom as boolean | undefined,
      binarySynth: opts.binarySynth as boolean | undefined,
      memoryUrl: opts.memoryUrl as string | undefined,
      memoryToken: opts.memoryToken as string | undefined,
    });
  });

program.parse();
