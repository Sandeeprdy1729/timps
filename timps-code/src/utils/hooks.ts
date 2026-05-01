// TIMPS Hooks System
// Like Claude Code: deterministic scripts that run on events

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'PreAgent' | 'PostAgent' | 'Start' | 'Stop';

export interface Hook {
  name: string;
  event: HookEvent;
  command: string;
  enabled: boolean;
}

const HOOKS_DIR = path.join(os.homedir(), '.timps', 'hooks');

// Shell scripts as hooks
export class HooksEngine {
  private hooks: Map<string, Hook> = new Map();
  
  constructor() {
    this.loadHooks();
  }
  
  private loadHooks(): void {
    if (!fs.existsSync(HOOKS_DIR)) return;
    
    const files = fs.readdirSync(HOOKS_DIR);
    for (const file of files) {
      if (!file.endsWith('.sh')) continue;
      
      const name = file.replace('.sh', '');
      const content = fs.readFileSync(path.join(HOOKS_DIR, file), 'utf-8');
      
      // Parse hook config from filename: event-hookname.sh
      const [event, ...hookName] = name.split('-');
      
      if (['PreToolUse', 'PostToolUse', 'PreAgent', 'PostAgent'].includes(event)) {
        this.hooks.set(name, {
          name: hookName.join('-'),
          event: event as HookEvent,
          command: content.trim(),
          enabled: true,
        });
      }
    }
  }
  
  // Run a hook
  async run(event: HookEvent, context: Record<string, unknown>): Promise<string> {
    const results: string[] = [];
    
    for (const hook of this.hooks.values()) {
      if (hook.event !== event || !hook.enabled) continue;
      
      try {
        // Set environment variables
        const env = { ...process.env };
        for (const [key, value] of Object.entries(context)) {
          env[`TIMPS_${key.toUpperCase()}`] = String(value);
        }
        
        const output = execSync(hook.command, {
          encoding: 'utf-8',
          timeout: 30000,
          env,
        });
        
        results.push(output.trim());
      } catch (err: any) {
        // Hooks that fail are skipped
        // In strict mode, could throw
      }
    }
    
    return results.join('\n');
  }
  
  // List hooks
  list(): Hook[] {
    return Array.from(this.hooks.values());
  }
  
  // Add hook
  add(event: HookEvent, name: string, command: string): void {
    const hookName = `${event}-${name}`;
    
    this.hooks.set(hookName, {
      name,
      event,
      command,
      enabled: true,
    });
    
    // Save to file
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    fs.writeFileSync(path.join(HOOKS_DIR, `${hookName}.sh`), command, 'utf-8');
  }
  
  // Enable/disable hook
  toggle(name: string, enabled: boolean): boolean {
    const hook = this.hooks.get(name);
    if (!hook) return false;
    
    hook.enabled = enabled;
    return true;
  }
  
  // Delete hook
  delete(name: string): boolean {
    const hook = this.hooks.get(name);
    if (!hook) return false;
    
    this.hooks.delete(name);
    fs.unlinkSync(path.join(HOOKS_DIR, `${name}.sh`));
    return true;
  }
}

// Pre-defined useful hooks
export const EXAMPLE_HOOKS: { name: string; event: HookEvent; command: string }[] = [
  {
    name: 'prevent-env',
    event: 'PreToolUse',
    command: `#!/bin/bash
# Block edits to .env files
if [[ "$TIMPS_TOOL" == "Write" && "$TIMPS_PATH" == *.env* ]]; then
  echo "ERROR: Writing to .env files is not allowed"
  exit 1
fi`,
  },
  {
    name: 'prettier',
    event: 'PostToolUse',
    command: `#!/bin/bash
# Run prettier after file edits
if [[ "$TIMPS_TOOL" == "Write" || "$TIMPS_TOOL" == "Edit" ]]; then
  if [[ "$TIMPS_PATH" == *.{ts,js,tsx,jsx} ]]; then
    npx prettier --write "$TIMPS_PATH" 2>/dev/null || true
  fi
fi`,
  },
  {
    name: 'lint',
    event: 'PostToolUse',
    command: `#!/bin/bash
# Run linter after file edits
if [[ "$TIMPS_TOOL" == "Write" || "$TIMPS_TOOL" == "Edit" ]]; then
  if [[ "$TIMPS_PATH" == *.{ts,js} ]]; then
    npx eslint --fix "$TIMPS_PATH" 2>/dev/null || true
  fi
fi`,
  },
  {
    name: 'git-diff',
    event: 'PostToolUse',
    command: `#!/bin/bash
# Show git diff after edits
if [[ "$TIMPS_TOOL" == "Write" || "$TIMPS_TOOL" == "Edit" ]]; then
  git diff --stat "$TIMPS_PATH" 2>/dev/null || true
fi`,
  },
];

// Singleton
export const hooksEngine = new HooksEngine();