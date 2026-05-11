// TIMPS Code — REPL Screen
// Interactive terminal REPL component

import * as readline from 'node:readline';
import * as os from 'node:os';
import {
  boldText,
  boldColored,
  success,
  error,
  warning,
  info,
  divider,
  defaultTheme,
} from './components.js';
import { runHealthChecks, type HealthCheck } from './doctor.js';

export interface REPLHistoryEntry {
  input: string;
  output: string;
  timestamp: Date;
  isCommand: boolean;
}

export interface REPLContext {
  sessionId: string;
  cwd: string;
  user: string;
  host: string;
  history: REPLHistoryEntry[];
  variables: Map<string, string>;
}

export interface REPLCommand {
  name: string;
  description: string;
  execute: (args: string[], context: REPLContext) => Promise<string> | string;
  aliases?: string[];
}

function createREPLContext(): REPLContext {
  return {
    sessionId: Date.now().toString(36),
    cwd: process.cwd(),
    user: os.userInfo().username,
    host: os.hostname(),
    history: [],
    variables: new Map(),
  };
}

export const builtInCommands: REPLCommand[] = [
  {
    name: 'help',
    description: 'Show available commands',
    execute: () => {
      let output = boldText('Available Commands:\n');
      output += divider('-');
      for (const cmd of builtInCommands) {
        output += `  ${cmd.name.padEnd(12)} - ${cmd.description}\n`;
      }
      output += divider('-');
      output += '\nType <command> --help for detailed help';
      return output;
    },
    aliases: ['h', '?'],
  },
  {
    name: 'clear',
    description: 'Clear the screen',
    execute: () => '\x1Bc',
    aliases: ['cls'],
  },
  {
    name: 'exit',
    description: 'Exit the REPL',
    execute: () => {
      process.exit(0);
      return '';
    },
    aliases: ['quit', 'q'],
  },
  {
    name: 'doctor',
    description: 'Run system health checks',
    execute: async () => {
      const checks = await runHealthChecks();
      let output = boldColored('\nTIMPS Code Health Check', defaultTheme.primary) + '\n';
      output += divider('=') + '\n';
      
      for (const check of checks) {
        const status = check.status === 'pass' 
          ? success('✓')
          : check.status === 'fail'
            ? error('✗')
            : warning('⚠');
        output += `  ${status} ${check.name.padEnd(20)} ${check.message}\n`;
      }
      
      output += divider('=');
      return output;
    },
    aliases: ['health', 'diag'],
  },
  {
    name: 'history',
    description: 'Show command history',
    execute: (_, context) => {
      let output = boldText('Command History:\n');
      output += divider('-') + '\n';
      
      const commands = context.history.filter(h => h.isCommand);
      if (commands.length === 0) {
        return info('No commands in history');
      }
      
      commands.forEach((entry, index) => {
        output += `  ${(index + 1).toString().padStart(3)}  ${entry.input}\n`;
      });
      
      return output;
    },
    aliases: ['hist'],
  },
  {
    name: 'set',
    description: 'Set a variable (Usage: set <name> <value>)',
    execute: (args, context) => {
      if (args.length < 2) {
        return error('Usage: set <name> <value>');
      }
      const [name, ...valueParts] = args;
      const value = valueParts.join(' ');
      context.variables.set(name, value);
      return success(`Set ${name}=${value}`);
    },
  },
  {
    name: 'env',
    description: 'Show environment variables',
    execute: (_, context) => {
      let output = boldText('Session Variables:\n');
      output += divider('-') + '\n';
      
      if (context.variables.size === 0) {
        return info('No variables set');
      }
      
      for (const [name, value] of context.variables) {
        output += `  ${name} = ${value}\n`;
      }
      
      return output;
    },
  },
  {
    name: 'info',
    description: 'Show session information',
    execute: (_, context) => {
      let output = boldColored('TIMPS Code Session Info', defaultTheme.primary) + '\n';
      output += divider('-') + '\n';
      output += `  Session ID: ${context.sessionId}\n`;
      output += `  Working Dir: ${context.cwd}\n`;
      output += `  User: ${context.user}@${context.host}\n`;
      output += `  Platform: ${os.platform()} ${os.arch()}\n`;
      output += `  Node.js: ${process.version}\n`;
      output += divider('-');
      return output;
    },
  },
  {
    name: 'echo',
    description: 'Echo text (Usage: echo <text>)',
    execute: (args) => {
      return args.join(' ');
    },
  },
  {
    name: 'pwd',
    description: 'Print working directory',
    execute: (_, context) => context.cwd,
    aliases: ['cwd'],
  },
];

function findCommand(name: string): REPLCommand | undefined {
  const lowerName = name.toLowerCase();
  return builtInCommands.find(cmd => 
    cmd.name.toLowerCase() === lowerName ||
    cmd.aliases?.some(alias => alias.toLowerCase() === lowerName)
  );
}

function parseInput(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { command: '', args: [] };
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  return { command, args };
}

function formatPrompt(context: REPLContext): string {
  const userColor = defaultTheme.primary;
  const pathColor = defaultTheme.secondary || defaultTheme.info;
  const promptColor = defaultTheme.success || '\x1b[32m';
  
  const shortCwd = context.cwd.replace(os.homedir(), '~');
  
  return `${promptColor}timps${userColor}@${context.user} ${pathColor}${shortCwd}${promptColor}$ `;
}

export function createREPLInterface(): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
    terminal: true,
    historySize: 100,
  });

  return rl;
}

export async function runREPL(
  initialInput?: string,
  onOutput?: (output: string) => void
): Promise<void> {
  const context = createREPLContext();
  const rl = createREPLInterface();
  
  let currentOutput = '';

  const displayOutput = (output: string) => {
    if (output === '\x1Bc') {
      console.clear();
    } else {
      console.log(output);
    }
    currentOutput = output;
  };

  if (onOutput) {
    onOutput(currentOutput);
  }

  const displayBanner = () => {
    console.log(boldColored('═'.repeat(60), defaultTheme.primary));
    console.log(boldColored('  TIMPS Code Interactive REPL', defaultTheme.primary));
    console.log(boldColored('  Type "help" for available commands', defaultTheme.info));
    console.log(boldColored('═'.repeat(60), defaultTheme.primary));
    console.log('');
  };

  displayBanner();

  const handleInput = async (input: string) => {
    if (!input.trim()) {
      rl.close();
      return;
    }

    context.history.push({
      input,
      output: '',
      timestamp: new Date(),
      isCommand: true,
    });

    const { command, args } = parseInput(input);

    if (!command) {
      rl.close();
      return;
    }

    const cmd = findCommand(command);

    if (cmd) {
      try {
        const result = await cmd.execute(args, context);
        if (result) {
          displayOutput(result);
        }
      } catch (err) {
        displayOutput(error(`Error: ${err instanceof Error ? err.message : String(err)}`));
      }
    } else {
      displayOutput(error(`Unknown command: ${command}. Type "help" for available commands.`));
    }

    console.log('');
    rl.close();
  };

  if (initialInput) {
    await handleInput(initialInput);
  } else {
    rl.question('', handleInput);
  }
}

export function startREPL(): void {
  const context = createREPLContext();
  const rl = createREPLInterface();

  console.log(boldColored('═'.repeat(60), defaultTheme.primary));
  console.log(boldColored('  TIMPS Code Interactive REPL', defaultTheme.primary));
  console.log(boldColored('  Type "help" for available commands', defaultTheme.info));
  console.log(boldColored('═'.repeat(60), defaultTheme.primary));
  console.log('');

  const updatePrompt = () => {
    rl.setPrompt(formatPrompt(context));
    rl.prompt();
  };

  rl.on('line', async (input) => {
    const trimmed = input.trim();
    
    if (!trimmed) {
      updatePrompt();
      return;
    }

    context.history.push({
      input: trimmed,
      output: '',
      timestamp: new Date(),
      isCommand: true,
    });

    const { command, args } = parseInput(trimmed);
    const cmd = findCommand(command);

    if (cmd) {
      try {
        const result = await cmd.execute(args, context);
        if (result) {
          if (result === '\x1Bc') {
            console.clear();
          } else {
            console.log(result);
          }
        }
      } catch (err) {
        console.log(error(`Error: ${err instanceof Error ? err.message : String(err)}`));
      }
    } else {
      console.log(error(`Unknown command: ${command}. Type "help" for available commands.`));
    }

    console.log('');
    updatePrompt();
  });

  rl.on('close', () => {
    console.log(success('\nGoodbye!'));
    process.exit(0);
  });

  updatePrompt();
}

export async function runCommandInREPL(
  command: string,
  context?: REPLContext
): Promise<string> {
  const ctx = context || createREPLContext();
  const { command: cmdName, args } = parseInput(command);
  const cmd = findCommand(cmdName);

  if (!cmd) {
    return error(`Unknown command: ${cmdName}`);
  }

  try {
    return await cmd.execute(args, ctx);
  } catch (err) {
    return error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}