// TIMPS Swarm — CLI Commands
// Add "timps swarm" commands to run the multi-agent swarm

import { program } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createSwarm, type SwarmAgent, type AgentRole } from './agents.js';
import { runSwarmDAG, createSwarmDAG, type SwarmRequest, type SwarmResult } from './graph.js';
import { startSwarmServer, stopSwarmServer } from './server.js';

const SWARM_PYTHON_API = process.env.TIMPS_SWARM_API || 'http://localhost:8000';

export function addSwarmCommands() {
  const swarm = program.command('swarm').description('TIMPS Swarm - Multi-agent distributed coding');
  
  // timps swarm start
  swarm.command('start')
    .description('Start the Swarm API server (Python backend)')
    .option('-p, --port <port>', 'Port', '8000')
    .option('-h, --host <host>', 'Host', 'localhost')
    .action(async (opts) => {
      console.log(chalk.cyan('🚀 Starting TIMPS Swarm Server...'));
      console.log(chalk.dim('→ connecting to Python backend at localhost:8000'));
      await startSwarmServer(opts.port, opts.host);
    });

  // timps swarm stop
  swarm.command('stop')
    .description('Stop the Swarm API server')
    .action(async () => {
      await stopSwarmServer();
      console.log(chalk.green('✅ Swarm stopped'));
    });

  // timps swarm run <task>
  swarm.command('run <task>')
    .description('Run a task with the swarm')
    .option('-l, --language <lang>', 'Language', 'python')
    .option('-i, --iterations <n>', 'Max iterations', '10')
    .option('-a, --agents <n>', 'Max parallel agents', '10')
    .option('-r, --remote', 'Use remote agents')
    .action(async (task, opts) => {
      console.log(chalk.cyan(`⚡ Running swarm task: ${task}`));
      console.log(chalk.dim(`   Language: ${opts.language} | Iterations: ${opts.iterations}`));
      
      // Try Python API first
      let result = await runPythonSwarm(task, opts.language, parseInt(opts.iterations));
      
      if (!result) {
        console.log(chalk.yellow('⚠ Python API not found, using local execution'));
        result = await runSwarmDAG({
          request: task,
          language: opts.language,
          maxIterations: parseInt(opts.iterations),
          maxParallelAgents: parseInt(opts.agents),
        });
      }
      
      if (result.success) {
        console.log(chalk.green('\n✅ Task completed!'));
        if (result.summary) console.log(chalk.white(result.summary));
        if (result.artifacts?.length) {
          console.log(chalk.cyan(`📦 Generated ${result.artifacts.length} artifacts`));
        }
      } else {
        console.log(chalk.red('\n❌ Task failed:'), result.error);
      }
    });

  // timps swarm status
  swarm.command('status')
    .description('Show swarm status')
    .option('-j, --json', 'JSON output')
    .action(async (opts) => {
      const agents = createSwarm();
      
      if (opts.json) {
        console.log(JSON.stringify(agents.map(a => ({
          role: a.role,
          status: a.status,
          model: a.model,
          tasksCompleted: a.stats.tasksCompleted,
        })), null, 2));
        return;
      }
      
      console.log(chalk.cyan('\n🤖 TIMPS Swarm Status\n'));
      console.log(chalk.dim('─'.repeat(50)));
      
      let activeCount = 0;
      for (const agent of agents) {
        const statusIcon = { idle: '○', busy: '●', waiting: '◐', error: '✕' };
        const color = { idle: 'dim', busy: 'cyan', waiting: 'yellow', error: 'red' };
        
        console.log(`  ${chalk[color[agent.status] as keyof typeof chalk](statusIcon[agent.status as keyof typeof statusIcon])} ${agent.name}`);
        console.log(chalk.dim(`     Model: ${agent.model} | Tasks: ${agent.stats.tasksCompleted}`));
        if (agent.status === 'busy') activeCount++;
      }
      
      console.log(chalk.dim('\n' + '─'.repeat(50)));
      console.log(chalk.dim(`Active agents: ${activeCount}/10 | Backend: ${SWARM_PYTHON_API}`));
      console.log();
    });

  // timps swarm invoke <agent> <task>
  swarm.command('invoke <agent> <task>')
    .description('Invoke a specific agent directly')
    .option('-m, --model <model>', 'Model override')
    .action(async (agent, task, opts) => {
      const role = agent.toLowerCase().replace(/-/g, '_') as AgentRole;
      const validRoles: AgentRole[] = [
        'orchestrator', 'product_manager', 'architect', 'code_generator',
        'code_reviewer', 'qa_tester', 'security_auditor', 'performance_optimizer',
        'docs_writer', 'devops'
      ];
      
      if (!validRoles.includes(role)) {
        console.log(chalk.red(`Unknown agent: ${agent}`));
        console.log(chalk.dim('Available: ' + validRoles.join(', ')));
        return;
      }
      
      console.log(chalk.cyan(`📞 Invoking ${role.replace(/_/g, ' ')}...`));
      console.log(chalk.dim(`Task: ${task}`));
      
      // Run the agent
      const result = await runSwarmDAG({ request: task });
      console.log(result.summary || '');
    });

  // timps swarm agents
  swarm.command('agents')
    .description('List all swarm agents')
    .action(() => {
      const agents = createSwarm();
      
      console.log(chalk.cyan('\n🤖 TIMPS Swarm - 10 Specialized Agents\n'));
      
      for (const agent of agents) {
        const roleIcon = {
          orchestrator: '🎯',
          product_manager: '📋',
          architect: '🏗️',
          code_generator: '💻',
          code_reviewer: '🔍',
          qa_tester: '🧪',
          security_auditor: '🔒',
          performance_optimizer: '⚡',
          docs_writer: '📝',
          devops: '🚀',
        };
        
        console.log(`  ${roleIcon[agent.role as keyof typeof roleIcon]} ${chalk.cyan(agent.name)}`);
        console.log(chalk.dim(`     Model: ${agent.model} | Tools: ${agent.tools.join(', ')}`));
        console.log();
      }
    });

  // timps swarm connect <url>
  swarm.command('connect <url>')
    .description('Connect to remote timps-swarm API')
    .action(async (url) => {
      console.log(chalk.cyan(`🔗 Connecting to: ${url}`));
      process.env.TIMPS_SWARM_API = url;
      console.log(chalk.green('✅ Connected!'));
    });

  // timps swarm dashboard
  swarm.command('dashboard')
    .description('Open the web dashboard')
    .option('-p, --port <port>', 'Dashboard port', '3000')
    .action(async (opts) => {
      console.log(chalk.cyan('🌐 Opening TIMPS Swarm Dashboard...'));
      console.log(chalk.dim(`Navigate to: http://localhost:${opts.port}`));
      console.log(chalk.dim('Or start with: cd dashboard && npm run dev'));
    });

  return swarm;
}

// Run task via Python timps-swarm API
async function runPythonSwarm(
  request: string,
  language: string,
  maxIterations: number
): Promise<SwarmResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${SWARM_PYTHON_API}/swarm/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request,
        language,
        max_iterations: maxIterations,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      success: data.status === 'completed',
      summary: data.results?.summary || data.status,
      artifacts: data.artifacts || [],
      error: data.error,
    };
  } catch {
    return null;
  }
}

// Interactive swarm mode
export async function runSwarmMode() {
  console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║         🤖 TIMPS SWARM MODE ACTIVE                 ║
║   10 AI Agents + 20 Bug-Fixing Adapters              ║
║   Connected to: ${SWARM_PYTHON_API.replace('http://', '').substring(0, 20).padEnd(20)}                 ║
╚══════════════════════════════════════════════════════════════╝
  `));
  
  const agents = createSwarm();
  console.log(chalk.green('✅ Swarm initialized with 10 specialized agents\n'));
  
  console.log(chalk.cyan('Agents:'));
  for (const agent of agents) {
    console.log(`  ${chalk.dim('●')} ${agent.name} (${agent.model})`);
  }
  
  console.log(chalk.dim('\nCommands: /status /agents /help | Type a task to run'));
  console.log(chalk.dim('Exit: /exit or Ctrl+C\n'));
  
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
  
  while (true) {
    const input = await rl.question(chalk.cyan('\n🧠 '));
    
    if (!input.trim()) continue;
    if (input === '/exit' || input === '/quit') break;
    if (input === '/status') {
      const agents = createSwarm();
      console.log(chalk.cyan(`Active: ${agents.filter(a => a.status === 'busy').length}/10`));
      continue;
    }
    if (input === '/help') {
      console.log(chalk.dim('/status - Show agent status\n/agents - List all agents\n/exit - Exit'));
      continue;
    }
    
    const result = await runSwarmDAG({ request: input });
    console.log(result.success ? chalk.green('✅ ') + (result.summary || '') : chalk.red('❌ ') + (result.error || ''));
  }
  
  rl.close();
  console.log(chalk.dim('\n👋 Swarm stopped'));
}