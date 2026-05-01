// TIMPS Custom Commands System
// Like Claude Code / OpenCode custom commands

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface Command {
  name: string;
  description: string;
  template?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

export interface CommandsManifest {
  version: string;
  commands: Record<string, Command>;
}

const COMMANDS_DIR = path.join(os.homedir(), '.timps', 'commands');
const MANIFEST_FILE = path.join(COMMANDS_DIR, 'commands.json');

export class CommandsEngine {
  private manifest: CommandsManifest;
  
  constructor() {
    this.manifest = this.loadManifest();
  }
  
  private loadManifest(): CommandsManifest {
    try {
      if (fs.existsSync(MANIFEST_FILE)) {
        return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { version: '1.0', commands: {} };
  }
  
  private saveManifest(): void {
    fs.mkdirSync(COMMANDS_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(this.manifest, null, 2), 'utf-8');
  }
  
  listCommands(): Command[] {
    return Object.values(this.manifest.commands);
  }
  
  getCommand(name: string): Command | undefined {
    return this.manifest.commands[name];
  }
  
  addCommand(name: string, cmd: Command): void {
    this.manifest.commands[name] = cmd;
    this.saveManifest();
  }
  
  addCommandFromFile(filePath: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      let name = path.basename(filePath, '.md');
      let description = '';
      let template = '';
      let inTemplate = false;
      
      for (const line of lines) {
        if (line.startsWith('# ')) {
          name = line.slice(2).trim();
        } else if (line.startsWith('> ')) {
          description = line.slice(2).trim();
        } else if (line.startsWith('```')) {
          inTemplate = !inTemplate;
        } else if (inTemplate) {
          template += line + '\n';
        }
      }
      
      this.manifest.commands[name] = { name, description, template };
      this.saveManifest();
      return true;
    } catch {
      return false;
    }
  }
  
  removeCommand(name: string): boolean {
    if (!this.manifest.commands[name]) return false;
    delete this.manifest.commands[name];
    this.saveManifest();
    return true;
  }
  
  buildPrompt(name: string, args: Record<string, string>): string {
    const cmd = this.manifest.commands[name];
    if (!cmd) return '';
    
    let prompt = cmd.template || cmd.description || '';
    
    for (const [key, value] of Object.entries(args)) {
      prompt = prompt.split(`$${key}`).join(value);
    }
    
    return prompt;
  }
}

// Built-in commands (like Claude Code)
export const BUILTIN_COMMANDS: Command[] = [
  {
    name: '/init',
    description: 'Initialize a new project',
  },
  {
    name: '/undo',
    description: 'Undo the last edit',
  },
  {
    name: '/redo',
    description: 'Redo the last undone edit',
  },
  {
    name: '/share',
    description: 'Share a link to the current session',
  },
  {
    name: '/help',
    description: 'Show help',
  },
  {
    name: '/new',
    description: 'Start a new conversation',
  },
  {
    name: '/reset',
    description: 'Reset the current conversation',
  },
  {
    name: '/model',
    description: 'Switch the model',
  },
  {
    name: '/retry',
    description: 'Retry the last message',
  },
  {
    name: '/compress',
    description: 'Compress context',
  },
  {
    name: '/usage',
    description: 'Show token usage',
  },
  {
    name: '/skills',
    description: 'Browse skills',
  },
  {
    name: '/recap',
    description: 'Generate a one-line summary of prior context',
  },
  {
    name: '/ultrareview',
    description: 'Deep multi-agent code review',
  },
  {
    name: '/effort',
    description: 'Tune model speed vs intelligence',
  },
  {
    name: '/loop',
    description: 'Run a prompt repeatedly on interval',
  },
  {
    name: '/less-permission-prompts',
    description: 'Auto-approve common tool calls',
  },
  {
    name: '/platforms',
    description: 'Show messaging platform status',
  },
  {
    name: '/status',
    description: 'Show gateway status',
  },
  {
    name: '/sethome',
    description: 'Set home platform for gateway',
  },
];