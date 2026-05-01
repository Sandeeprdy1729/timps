// TIMPS Permission System
// Like Claude Code: allow, deny, require-approval

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type PermissionMode = 'allow' | 'deny' | 'require-approval';

export interface PermissionRule {
  tool: string;        // Tool name pattern (e.g., "Bash", "Read(*.env)")
  // Allow pattern matching: exact, wildcard (*), regex
  mode: PermissionMode;
  reason?: string;
}

export interface PermissionConfig {
  mode: 'allow' | 'deny' | 'require-approval';
  allow?: string[];    // Tool patterns to allow without prompting
  deny?: string[];     // Tool patterns to always deny
  // Additional rules
  rules?: PermissionRule[];
}

const PERMISSIONS_DIR = path.join(os.homedir(), '.timps');
const PERMISSIONS_FILE = path.join(PERMISSIONS_DIR, 'permissions.json');

// Default permissions (safe defaults)
export const DEFAULT_PERMISSIONS: PermissionConfig = {
  mode: 'require-approval',
  allow: [
    'Read(*.md)',
    'Read(*.json)',
    'Read(*.ts)',
    'Read(*.js)',
    'Read(*.txt)',
    'Glob(**/*)',
    'Grep(*)',
    'TodoRead',
    'TaskList',
    'WebSearch(*)',
    'WebFetch(https://*)',
    'Bash(git status)',
    'Bash(git diff *)',
    'Bash(ls *)',
    'Bash(pwd)',
    'Bash(echo *)',
  ],
  deny: [
    'Bash(sudo *)',
    'Bash(rm -rf / *)',
    'Bash(curl | bash)',
    'Bash(wget | bash)',
    'Write(*.env)',
    'Write(*.pem)',
    'Write(*.key)',
  ],
};

export class PermissionSystem {
  private config: PermissionConfig;
  
  constructor() {
    this.config = this.loadConfig();
  }
  
  private loadConfig(): PermissionConfig {
    try {
      if (fs.existsSync(PERMISSIONS_FILE)) {
        return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_PERMISSIONS };
  }
  
  private saveConfig(): void {
    fs.mkdirSync(PERMISSIONS_DIR, { recursive: true });
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
  }
  
  // Check if a tool call requires approval
  requiresApproval(toolName: string, args?: Record<string, unknown>): boolean {
    const toolPattern = this.buildPattern(toolName, args);
    
    // Check deny list first
    for (const denyPattern of this.config.deny || []) {
      if (this.matchPattern(toolPattern, denyPattern)) {
        return true; // Always require approval for denied tools
      }
    }
    
    // Check allow list
    for (const allowPattern of this.config.allow || []) {
      if (this.matchPattern(toolPattern, allowPattern)) {
        return false; // No approval needed
      }
    }
    
    // Default: require approval based on mode
    return this.config.mode === 'require-approval';
  }
  
  // Build tool pattern from name + args
  private buildPattern(toolName: string, args?: Record<string, unknown>): string {
    if (!args) return toolName;
    
    // Add arg-based context to pattern
    if (args.command && typeof args.command === 'string') {
      return `${toolName}(${args.command.split(' ')[0]})`;
    }
    if (args.path && typeof args.path === 'string') {
      return `${toolName}(${args.path})`;
    }
    if (args.url && typeof args.url === 'string') {
      const url = args.url as string;
      return `${toolName}(${url.split('?')[0]})`;
    }
    
    return toolName;
  }
  
  // Match pattern (supports wildcards)
  private matchPattern(toolPattern: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex
      .replace(/\*/g, '.*');                  // * -> .*
    
    return new RegExp(`^${regexPattern}$`, 'i').test(toolPattern);
  }
  
  // Get current config
  getConfig(): PermissionConfig {
    return this.config;
  }
  
  // Update config
  updateConfig(updates: Partial<PermissionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }
  
  // Add to allowlist
  allow(toolPattern: string): void {
    if (!this.config.allow) this.config.allow = [];
    if (!this.config.allow.includes(toolPattern)) {
      this.config.allow.push(toolPattern);
      this.saveConfig();
    }
  }
  
  // Add to denylist
  deny(toolPattern: string): void {
    if (!this.config.deny) this.config.deny = [];
    if (!this.config.deny.includes(toolPattern)) {
      this.config.deny.push(toolPattern);
      this.saveConfig();
    }
  }
  
  // Generate allowlist from recent transcript (like /less-permission-prompts)
  generateAllowlist(transcript: string): string[] {
    const toolCalls: string[] = [];
    
    for (const line of transcript.split('\n')) {
      // Look for tool invocations
      const match = line.match(/Tool: (\w+)/);
      if (match) {
        toolCalls.push(match[1]);
      }
    }
    
    // Count occurrences
    const counts = new Map<string, number>();
    for (const tool of toolCalls) {
      counts.set(tool, (counts.get(tool) || 0) + 1);
    }
    
    // Return most used tools (that require approval)
    return Array.from(counts.entries())
      .filter(([_, count]) => count >= 3)
      .map(([tool]) => tool);
  }
  
  // Reset to defaults
  reset(): void {
    this.config = { ...DEFAULT_PERMISSIONS };
    this.saveConfig();
  }
}

// Singleton instance
export const permissions = new PermissionSystem();

// Helper to check permissions in agent
export function checkPermission(toolName: string, args?: Record<string, unknown>): {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
} {
  const perms = new PermissionSystem();
  const requiresApproval = perms.requiresApproval(toolName, args);
  
  return {
    allowed: !requiresApproval,
    requiresApproval,
  };
}