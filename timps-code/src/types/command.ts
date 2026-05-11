// ── TIMPS Code — Command Types (from Claude Code pattern)
// Defines all slash commands with their categories, aliases, and features

export type CommandCategory =
  | 'Session'
  | 'Configuration'
  | 'Tools'
  | 'Info'
  | 'Git'
  | 'Tasks'
  | 'Review'
  | 'MCP'
  | 'Remote'
  | 'Team'
  | 'Enterprise'
  | 'Exit';

export type CommandAvailability = 'cli' | 'console' | 'ide';

export type CommandSource = 'builtin' | 'skills' | 'plugin' | 'mcp' | 'bundled';

export interface CommandArg {
  name: string;
  description: string;
  required?: boolean;
}

export interface CommandDef {
  name: string;
  description: string;
  category: CommandCategory;
  aliases: string[];
  argsHint?: string;
  subcommands?: string[];
  availability?: CommandAvailability[];
  source?: CommandSource;
  isHidden?: boolean;
  isEnabled?: () => boolean;
  userFacingName?: () => string;
  version?: string;
  whenToUse?: string;
  argumentHint?: string;
}

export interface CommandHandler {
  (args: string, context: CommandContext): Promise<CommandResult>;
}

export interface CommandContext {
  cwd: string;
  agent: any;
  memory: any;
  todos: any;
  snapshots: any;
  permissions: any;
  provider: any;
  sessionDir: string;
  providerName?: string;
}

export type CommandResult =
  | { type: 'text'; value: string }
  | { type: 'skip' }
  | { type: 'error'; message: string };

export interface QueuedCommand {
  id: string;
  command: string;
  args: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'done';
}
