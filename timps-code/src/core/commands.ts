// ── TIMPS Command Registry ──
// Inspired by Hermes Agent's command system, adapted for TIMPS

import type { CommandDef, CommandCategory } from '../config/types.js';

export const COMMAND_CATEGORIES: Record<CommandCategory, string> = {
  'Session': 'Session management and context',
  'Configuration': 'Model and settings',
  'Tools': 'Tool and skill management', 
  'Info': 'Information and utilities',
  'Exit': 'Exit commands',
};

export interface TimpsCommandDef {
  name: string;
  description: string;
  category: CommandCategory;
  aliases: string[];
  argsHint: string;
  subcommands: string[];
  cliOnly: boolean;
  gatewayOnly: boolean;
  handler: (args: string) => Promise<void> | void;
}

const commandRegistry: Map<string, TimpsCommandDef> = new Map();

export function registerCommand(cmd: TimpsCommandDef): void {
  commandRegistry.set(cmd.name, cmd);
  for (const alias of cmd.aliases) {
    commandRegistry.set(alias, cmd);
  }
}

export function resolveCommand(name: string): TimpsCommandDef | undefined {
  return commandRegistry.get(name.toLowerCase().replace(/^\//, ''));
}

export function getCommandsByCategory(category: CommandCategory): TimpsCommandDef[] {
  return [...commandRegistry.values()].filter(cmd => cmd.category === category);
}

export function getAllCommands(): TimpsCommandDef[] {
  return [...commandRegistry.values()];
}

export function getCommandHelp(): string {
  const lines: string[] = [];
  for (const [category, description] of Object.entries(COMMAND_CATEGORIES)) {
    const cmds = getCommandsByCategory(category as CommandCategory);
    if (cmds.length === 0) continue;
    lines.push(`\n## ${category} — ${description}`);
    for (const cmd of cmds) {
      const args = cmd.argsHint ? ` ${cmd.argsHint}` : '';
      lines.push(`- /${cmd.name}${args} — ${cmd.description}`);
      for (const alias of cmd.aliases) {
        lines.push(`  Alias: /${alias}`);
      }
    }
  }
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════
// TIMPS Core Commands
// ═══════════════════════════════════════════════════════════

export function initCommandRegistry(): void {
  // Session commands
  registerCommand({
    name: 'new',
    description: 'Start a fresh session (clears history)',
    category: 'Session',
    aliases: ['reset', 'n'],
    argsHint: '',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'branch',
    description: 'Branch session to explore a different path',
    category: 'Session',
    aliases: ['fork', 'b'],
    argsHint: '[name]',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'history',
    description: 'Show conversation history',
    category: 'Session',
    aliases: ['hist', 'h'],
    argsHint: '[lines]',
    subcommands: [],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'compress',
    description: 'Compress conversation context to save tokens',
    category: 'Session',
    aliases: ['compact', 'c'],
    argsHint: '[focus topic]',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'retry',
    description: 'Retry the last message',
    category: 'Session',
    aliases: ['rt'],
    argsHint: '',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'undo',
    description: 'Remove the last assistant exchange',
    category: 'Session',
    aliases: ['u'],
    argsHint: '[count]',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Configuration commands
  registerCommand({
    name: 'model',
    description: 'Switch to a different Ollama model',
    category: 'Configuration',
    aliases: ['m'],
    argsHint: '[model name]',
    subcommands: ['list', 'code', 'fast', 'quality', 'search'],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'models',
    description: 'Browse available Ollama models',
    category: 'Configuration',
    aliases: [],
    argsHint: '[subcommand]',
    subcommands: ['list', 'code', 'fast', 'quality', 'search', 'pull'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'trust',
    description: 'Set trust level for file operations',
    category: 'Configuration',
    aliases: [],
    argsHint: '[level]',
    subcommands: ['cautious', 'normal', 'trust', 'yolo'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'config',
    description: 'Show or edit TIMPS configuration',
    category: 'Configuration',
    aliases: ['cfg'],
    argsHint: '[key] [value]',
    subcommands: ['show', 'set', 'get'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Tools commands
  registerCommand({
    name: 'tools',
    description: 'Manage enabled tools',
    category: 'Tools',
    aliases: [],
    argsHint: '[list|enable|disable] [name]',
    subcommands: ['list', 'enable', 'disable', 'status'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'skill',
    description: 'Search, install, or manage coding skills',
    category: 'Tools',
    aliases: ['skills', 's'],
    argsHint: '[search|install|remove] [name]',
    subcommands: ['search', 'install', 'remove', 'list', 'browse'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'cron',
    description: 'Schedule recurring tasks',
    category: 'Tools',
    aliases: [],
    argsHint: '[list|add|remove|run]',
    subcommands: ['list', 'add', 'create', 'remove', 'pause', 'resume', 'run'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Memory commands
  registerCommand({
    name: 'memory',
    description: 'View or manage persistent memory',
    category: 'Session',
    aliases: ['mem', 'm'],
    argsHint: '[query|forget|consolidate]',
    subcommands: ['query', 'forget', 'consolidate', 'export', 'import', 'stats'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'learn',
    description: 'Teach TIMPS a new pattern or fact',
    category: 'Tools',
    aliases: ['teach', 'l'],
    argsHint: '<pattern or fact>',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Info commands
  registerCommand({
    name: 'help',
    description: 'Show available commands',
    category: 'Info',
    aliases: ['?'],
    argsHint: '[command]',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'cost',
    description: 'Show token usage and estimated cost',
    category: 'Info',
    aliases: [],
    argsHint: '',
    subcommands: [],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'doctor',
    description: 'Run system health check',
    category: 'Info',
    aliases: [],
    argsHint: '',
    subcommands: [],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  registerCommand({
    name: 'status',
    description: 'Show session and system status',
    category: 'Info',
    aliases: ['st'],
    argsHint: '',
    subcommands: [],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Git commands
  registerCommand({
    name: 'git',
    description: 'Run git commands',
    category: 'Info',
    aliases: ['g'],
    argsHint: '[command] [args]',
    subcommands: ['status', 'log', 'diff', 'branch', 'commit', 'push', 'pull'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Todo commands
  registerCommand({
    name: 'todo',
    description: 'Manage persistent todo list',
    category: 'Session',
    aliases: ['t', 'task'],
    argsHint: '[add|done|remove] [text]',
    subcommands: ['add', 'done', 'remove', 'clear', 'list', 'all'],
    cliOnly: false,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Team commands  
  registerCommand({
    name: 'team',
    description: 'Manage shared team memory',
    category: 'Session',
    aliases: [],
    argsHint: '[join|leave|status|progress]',
    subcommands: ['join', 'leave', 'status', 'progress', 'share'],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });

  // Exit commands
  registerCommand({
    name: 'quit',
    description: 'Exit TIMPS',
    category: 'Exit',
    aliases: ['exit', 'q'],
    argsHint: '',
    subcommands: [],
    cliOnly: true,
    gatewayOnly: false,
    handler: async () => {},
  });
}

export { COMMAND_CATEGORIES };
export type { CommandCategory } from '../config/types.js';