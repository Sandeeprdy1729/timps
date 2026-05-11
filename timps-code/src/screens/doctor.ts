// TIMPS Code — Doctor Screen
// Comprehensive system health check display

import * as os from 'node:os';
import * as fs from 'node:fs';
import { execSync, exec } from 'node:child_process';
import {
  boldText,
  boldColored,
  success,
  error,
  warning,
  info,
  divider,
  table,
  defaultTheme,
} from './components.js';

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

export interface DiagnosticInfo {
  installationType: string;
  version: string;
  packageManager: string | null;
  installationPath: string;
  invokedBinary: string;
  configInstallMethod: string;
  ripgrepStatus: {
    working: boolean;
    mode: string;
  };
  autoUpdates: string;
  hasUpdatePermissions: boolean | null;
  warnings: Array<{ issue: string; fix: string }>;
  multipleInstallations: Array<{ type: string; path: string }>;
  recommendation: string | null;
}

export interface VersionLockInfo {
  enabled: boolean;
  locks: Array<{ version: string; pid: number; isProcessRunning: boolean }>;
  locksDir: string;
  staleLocksCleaned: number;
}

export interface AgentInfo {
  activeAgents: Array<{ agentType: string; source: string }>;
  userAgentsDir: string;
  projectAgentsDir: string;
  userDirExists: boolean;
  projectDirExists: boolean;
  failedFiles?: Array<{ path: string; error: string }>;
}

export interface ContextWarnings {
  unreachableRulesWarning?: { message: string; details: string[] };
  claudeMdWarning?: { message: string; details: string[] };
  agentWarning?: { message: string; details: string[] };
  mcpWarning?: { message: string; details: string[] };
}

async function getDiagnosticInfo(): Promise<DiagnosticInfo> {
  const info: DiagnosticInfo = {
    installationType: 'npm',
    version: '1.0.0',
    packageManager: null,
    installationPath: process.execPath,
    invokedBinary: 'timps',
    configInstallMethod: 'manual',
    ripgrepStatus: { working: false, mode: 'system' },
    autoUpdates: 'disabled',
    hasUpdatePermissions: null,
    warnings: [],
    multipleInstallations: [],
    recommendation: null,
  };

  try {
    const packageJsonPath = require.resolve('../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    info.version = packageJson.version || 'unknown';
  } catch {}

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    info.packageManager = `npm ${npmVersion}`;
  } catch {}

  try {
    const whichResult = execSync('which rg', { encoding: 'utf-8' }).trim();
    if (whichResult) {
      info.ripgrepStatus = { working: true, mode: 'system' };
    }
  } catch {
    try {
      execSync('rg --version', { encoding: 'utf-8' });
      info.ripgrepStatus = { working: true, mode: 'embedded' };
    } catch {
      info.ripgrepStatus = { working: false, mode: 'not found' };
    }
  }

  try {
    const isGitRepo = execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf-8' }).trim();
    if (isGitRepo === 'true') {
      info.recommendation = 'Working in a git repository';
    }
  } catch {}

  const homeDir = os.homedir();
  const timpsDir = `${homeDir}/.timps`;
  if (!fs.existsSync(timpsDir)) {
    info.warnings.push({
      issue: 'TIMPS directory not initialized',
      fix: 'Run timps init to set up configuration',
    });
    info.recommendation = 'Initialize TIMPS configuration';
  }

  return info;
}

async function checkVersionLocks(): Promise<VersionLockInfo> {
  const xdgStateHome = process.env.XDG_STATE_HOME || `${os.homedir()}/.local/share`;
  const locksDir = `${xdgStateHome}/timps/locks`;
  
  const result: VersionLockInfo = {
    enabled: false,
    locks: [],
    locksDir,
    staleLocksCleaned: 0,
  };

  if (!fs.existsSync(locksDir)) {
    return result;
  }

  result.enabled = true;

  try {
    const files = fs.readdirSync(locksDir);
    for (const file of files) {
      if (file.endsWith('.lock')) {
        const lockPath = `${locksDir}/${file}`;
        try {
          const content = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
          const isRunning = content.pid ? process.kill(content.pid, 0) : false;
          result.locks.push({
            version: content.version || file.replace('.lock', ''),
            pid: content.pid || 0,
            isProcessRunning: isRunning,
          });
        } catch {}
      }
    }
  } catch {}

  return result;
}

async function checkAgentInfo(): Promise<AgentInfo | null> {
  const homeDir = os.homedir();
  const cwd = process.cwd();
  
  const userAgentsDir = `${homeDir}/.claude/agents`;
  const projectAgentsDir = `${cwd}/.claude/agents`;

  let userDirExists = false;
  let projectDirExists = false;

  try {
    userDirExists = fs.existsSync(userAgentsDir);
    projectDirExists = fs.existsSync(projectAgentsDir);
  } catch {
    return null;
  }

  const activeAgents: Array<{ agentType: string; source: string }> = [];

  if (userDirExists) {
    try {
      const files = fs.readdirSync(userAgentsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          activeAgents.push({
            agentType: file.replace('.md', ''),
            source: 'user',
          });
        }
      }
    } catch {}
  }

  if (projectDirExists) {
    try {
      const files = fs.readdirSync(projectAgentsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          activeAgents.push({
            agentType: file.replace('.md', ''),
            source: 'project',
          });
        }
      }
    } catch {}
  }

  return {
    activeAgents,
    userAgentsDir,
    projectAgentsDir,
    userDirExists,
    projectDirExists,
  };
}

function checkMcpServers(): { configured: number; running: number } {
  const homeDir = os.homedir();
  const mcpConfigPath = `${homeDir}/.timps/mcp-config.json`;
  
  let configured = 0;
  let running = 0;

  if (fs.existsSync(mcpConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      configured = config.servers ? Object.keys(config.servers).length : 0;
    } catch {}
  }

  return { configured, running };
}

function checkEnvironmentVariables(): Array<{ name: string; status: string; message: string }> {
  const envChecks: Array<{ name: string; status: string; message: string }> = [];
  
  const relevantVars = [
    'TIMPS_MODEL',
    'TIMPS_API_KEY',
    'TIMPS_MAX_TOKENS',
    'NODE_ENV',
  ];

  for (const varName of relevantVars) {
    const value = process.env[varName];
    if (value) {
      envChecks.push({
        name: varName,
        status: 'pass',
        message: value.length > 20 ? value.substring(0, 20) + '...' : value,
      });
    } else {
      envChecks.push({
        name: varName,
        status: 'warn',
        message: 'not set',
      });
    }
  }

  return envChecks;
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  checks.push({
    name: 'Node.js',
    status: 'pass',
    message: `v${process.version}`,
  });

  checks.push({
    name: 'Platform',
    status: 'pass',
    message: `${os.platform()} ${os.arch()}`,
  });

  checks.push({
    name: 'CPU Cores',
    status: 'pass',
    message: `${os.cpus().length} cores`,
  });

  const memFree = os.freemem();
  const memTotal = os.totalmem();
  const memPercent = (memFree / memTotal) * 100;
  
  checks.push({
    name: 'Memory',
    status: memPercent < 10 ? 'fail' : memPercent < 20 ? 'warn' : 'pass',
    message: `${Math.round(memFree / 1024 / 1024)}MB free / ${Math.round(memTotal / 1024 / 1024)}MB total (${Math.round(memPercent)}%)`,
  });

  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
    checks.push({
      name: 'Git',
      status: 'pass',
      message: gitVersion,
    });
  } catch {
    checks.push({
      name: 'Git',
      status: 'fail',
      message: 'Not installed',
    });
  }

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    checks.push({
      name: 'NPM',
      status: 'pass',
      message: `v${npmVersion}`,
    });
  } catch {
    checks.push({
      name: 'NPM',
      status: 'warn',
      message: 'Not found',
    });
  }

  const homeDir = os.homedir();
  const timpsDir = `${homeDir}/.timps`;
  const hasTimpsDir = fs.existsSync(timpsDir);
  checks.push({
    name: 'TIMPS Config',
    status: hasTimpsDir ? 'pass' : 'warn',
    message: hasTimpsDir ? timpsDir : 'Not initialized',
  });

  const settingsPath = `${timpsDir}/settings.json`;
  if (hasTimpsDir && fs.existsSync(settingsPath)) {
    checks.push({
      name: 'Settings File',
      status: 'pass',
      message: settingsPath,
    });
  }

  try {
    execSync('git status --short', { encoding: 'utf-8', timeout: 5000 });
    checks.push({
      name: 'Git Repository',
      status: 'pass',
      message: 'Working directory',
    });
  } catch {
    checks.push({
      name: 'Git Repository',
      status: 'warn',
      message: 'Not a git repository',
    });
  }

  const diag = await getDiagnosticInfo();
  checks.push({
    name: 'TIMPS Version',
    status: 'pass',
    message: diag.version,
  });

  if (diag.packageManager) {
    checks.push({
      name: 'Package Manager',
      status: 'pass',
      message: diag.packageManager,
    });
  }

  checks.push({
    name: 'Ripgrep',
    status: diag.ripgrepStatus.working ? 'pass' : 'fail',
    message: diag.ripgrepStatus.working 
      ? `OK (${diag.ripgrepStatus.mode})`
      : 'Not working',
  });

  const mcpInfo = checkMcpServers();
  checks.push({
    name: 'MCP Servers',
    status: mcpInfo.configured > 0 ? 'pass' : 'warn',
    message: `${mcpInfo.configured} configured`,
  });

  const versionLocks = await checkVersionLocks();
  if (versionLocks.enabled) {
    const staleCount = versionLocks.locks.filter(l => !l.isProcessRunning).length;
    checks.push({
      name: 'Version Locks',
      status: staleCount > 0 ? 'warn' : 'pass',
      message: `${versionLocks.locks.length} active, ${staleCount} stale`,
    });
  }

  const agentInfo = await checkAgentInfo();
  if (agentInfo && agentInfo.activeAgents.length > 0) {
    checks.push({
      name: 'Agents',
      status: 'pass',
      message: `${agentInfo.activeAgents.length} agents loaded`,
    });
  }

  const envVars = checkEnvironmentVariables();
  const missingApiKey = envVars.find(e => e.name === 'TIMPS_API_KEY' && e.status === 'warn');
  if (missingApiKey) {
    checks.push({
      name: 'API Key',
      status: 'warn',
      message: 'Not configured',
    });
  }

  return checks;
}

export function renderDoctorScreen(
  checks: HealthCheck[],
  options?: {
    includeDiagnostics?: boolean;
    includeAgentInfo?: boolean;
    includeVersionLocks?: boolean;
  }
): string {
  const lines: string[] = [];
  const opts = options || {};

  lines.push(boldColored('═'.repeat(60), defaultTheme.primary));
  lines.push(boldColored('  TIMPS Code System Health Check', defaultTheme.primary));
  lines.push(boldColored('═'.repeat(60), defaultTheme.primary));
  lines.push('');

  if (opts.includeDiagnostics) {
    const diagInfo = getDiagnosticInfoSync();
    lines.push(boldText('Diagnostics'));
    lines.push(divider('-'));
    lines.push(`  └ Installation: ${diagInfo.installationType}`);
    lines.push(`  └ Version: ${diagInfo.version}`);
    if (diagInfo.packageManager) {
      lines.push(`  └ Package manager: ${diagInfo.packageManager}`);
    }
    lines.push(`  └ Path: ${diagInfo.installationPath}`);
    lines.push(`  └ Binary: ${diagInfo.invokedBinary}`);
    if (diagInfo.configInstallMethod) {
      lines.push(`  └ Config method: ${diagInfo.configInstallMethod}`);
    }
    lines.push('');
    
    if (diagInfo.recommendation) {
      lines.push(warning(`  Recommendation: ${diagInfo.recommendation}`));
      lines.push('');
    }

    if (diagInfo.warnings.length > 0) {
      lines.push(warning('Warnings:'));
      for (const w of diagInfo.warnings) {
        lines.push(`  └ ${w.issue}`);
        lines.push(`    Fix: ${w.fix}`);
      }
      lines.push('');
    }
  }

  lines.push(boldText('Health Checks'));
  lines.push(divider('-'));

  const rows = checks.map(check => {
    const statusText = check.status === 'pass'
      ? success('✓ PASS')
      : check.status === 'fail'
        ? error('✗ FAIL')
        : warning('⚠ WARN');

    return [
      check.name,
      statusText,
      check.message,
    ];
  });

  lines.push(table(['Check', 'Status', 'Details'], rows));
  lines.push(divider('-'));

  if (opts.includeAgentInfo) {
    const agentInfoSync = getAgentInfoSync();
    if (agentInfoSync && agentInfoSync.activeAgents.length > 0) {
      lines.push('');
      lines.push(boldText('Loaded Agents'));
      lines.push(divider('-'));
      for (const agent of agentInfoSync.activeAgents) {
        lines.push(`  └ ${agent.agentType} (${agent.source})`);
      }
      lines.push(divider('-'));
    }
  }

  if (opts.includeVersionLocks) {
    const versionLocksSync = getVersionLocksSync();
    if (versionLocksSync.enabled) {
      lines.push('');
      lines.push(boldText('Version Locks'));
      lines.push(divider('-'));
      if (versionLocksSync.locks.length === 0) {
        lines.push(info('  No active version locks'));
      } else {
        for (const lock of versionLocksSync.locks) {
          const status = lock.isProcessRunning 
            ? success('running') 
            : warning('stale');
          lines.push(`  └ ${lock.version}: PID ${lock.pid} (${status})`);
        }
      }
      if (versionLocksSync.staleLocksCleaned > 0) {
        lines.push(`  Cleaned ${versionLocksSync.staleLocksCleaned} stale lock(s)`);
      }
      lines.push(divider('-'));
    }
  }

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  lines.push('');
  lines.push(`Total: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);

  if (failCount > 0) {
    lines.push('');
    lines.push(error('✗ Some checks failed. Please address the issues above.'));
  } else if (warnCount > 0) {
    lines.push('');
    lines.push(warning('⚠ System is working but there are some warnings.'));
  } else {
    lines.push('');
    lines.push(success('✓ All checks passed!'));
  }

  lines.push('');
  lines.push(boldColored('═'.repeat(60), defaultTheme.primary));

  return lines.join('\n');
}

function getDiagnosticInfoSync(): DiagnosticInfo {
  const info: DiagnosticInfo = {
    installationType: 'npm',
    version: '1.0.0',
    packageManager: null,
    installationPath: process.execPath,
    invokedBinary: 'timps',
    configInstallMethod: 'manual',
    ripgrepStatus: { working: false, mode: 'system' },
    autoUpdates: 'disabled',
    hasUpdatePermissions: null,
    warnings: [],
    multipleInstallations: [],
    recommendation: null,
  };

  try {
    const packageJsonPath = require.resolve('../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    info.version = packageJson.version || 'unknown';
  } catch {}

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    info.packageManager = `npm ${npmVersion}`;
  } catch {}

  try {
    execSync('which rg', { encoding: 'utf-8' });
    info.ripgrepStatus = { working: true, mode: 'system' };
  } catch {
    info.ripgrepStatus = { working: false, mode: 'not found' };
  }

  const homeDir = os.homedir();
  const timpsDir = `${homeDir}/.timps`;
  if (!fs.existsSync(timpsDir)) {
    info.warnings.push({
      issue: 'TIMPS directory not initialized',
      fix: 'Run timps init to set up configuration',
    });
    info.recommendation = 'Initialize TIMPS configuration';
  }

  return info;
}

function getAgentInfoSync(): AgentInfo | null {
  const homeDir = os.homedir();
  const cwd = process.cwd();
  
  const userAgentsDir = `${homeDir}/.claude/agents`;
  const projectAgentsDir = `${cwd}/.claude/agents`;

  let userDirExists = false;
  let projectDirExists = false;

  try {
    userDirExists = fs.existsSync(userAgentsDir);
    projectDirExists = fs.existsSync(projectAgentsDir);
  } catch {
    return null;
  }

  const activeAgents: Array<{ agentType: string; source: string }> = [];

  if (userDirExists) {
    try {
      const files = fs.readdirSync(userAgentsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          activeAgents.push({
            agentType: file.replace('.md', ''),
            source: 'user',
          });
        }
      }
    } catch {}
  }

  if (projectDirExists) {
    try {
      const files = fs.readdirSync(projectAgentsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          activeAgents.push({
            agentType: file.replace('.md', ''),
            source: 'project',
          });
        }
      }
    } catch {}
  }

  return {
    activeAgents,
    userAgentsDir,
    projectAgentsDir,
    userDirExists,
    projectDirExists,
  };
}

function getVersionLocksSync(): VersionLockInfo {
  const xdgStateHome = process.env.XDG_STATE_HOME || `${os.homedir()}/.local/share`;
  const locksDir = `${xdgStateHome}/timps/locks`;
  
  const result: VersionLockInfo = {
    enabled: false,
    locks: [],
    locksDir,
    staleLocksCleaned: 0,
  };

  if (!fs.existsSync(locksDir)) {
    return result;
  }

  result.enabled = true;

  try {
    const files = fs.readdirSync(locksDir);
    for (const file of files) {
      if (file.endsWith('.lock')) {
        const lockPath = `${locksDir}/${file}`;
        try {
          const content = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
          const isRunning = content.pid ? process.kill(content.pid, 0) : false;
          result.locks.push({
            version: content.version || file.replace('.lock', ''),
            pid: content.pid || 0,
            isProcessRunning: isRunning,
          });
        } catch {}
      }
    }
  } catch {}

  return result;
}

export async function showDoctorScreen(enhanced: boolean = false): Promise<void> {
  const checks = await runHealthChecks();
  const output = renderDoctorScreen(checks, {
    includeDiagnostics: enhanced,
    includeAgentInfo: enhanced,
    includeVersionLocks: enhanced,
  });
  console.log(output);
}

export async function runFullDiagnostics(): Promise<{
  diagnostics: DiagnosticInfo;
  healthChecks: HealthCheck[];
  agentInfo: AgentInfo | null;
  versionLocks: VersionLockInfo;
  mcpServers: { configured: number; running: number };
}> {
  const [diagnostics, healthChecks, agentInfo, versionLocks] = await Promise.all([
    getDiagnosticInfo(),
    runHealthChecks(),
    checkAgentInfo(),
    checkVersionLocks(),
  ]);

  const mcpServers = checkMcpServers();

  return {
    diagnostics,
    healthChecks,
    agentInfo,
    versionLocks,
    mcpServers,
  };
}