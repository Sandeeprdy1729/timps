// ── Smart Permission System ──
// Reduces approval fatigue with trust levels, session memory, and path-based rules

import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { RiskLevel, TrustLevel, PathRule } from '../config/types.js';
import { t, icons } from '../config/theme.js';

export class Permissions {
  private trustLevel: TrustLevel;
  private pathRules: PathRule[];
  private sessionApproved = new Set<string>();
  private rl: readline.Interface | null = null;

  constructor(trustLevel: TrustLevel, pathRules: PathRule[] = []) {
    this.trustLevel = trustLevel;
    this.pathRules = pathRules;
  }

  setTrust(level: TrustLevel): void {
    this.trustLevel = level;
    this.sessionApproved.clear();
  }

  async check(tool: string, args: Record<string, unknown>, risk: RiskLevel): Promise<boolean> {
    // Check trust level auto-approval
    if (this.autoApproves(risk)) return true;

    // Check path-based rules
    const filePath = String(args.path || args.command || '');
    if (filePath && this.pathRuleApproves(filePath, risk)) return true;

    // Check session approval
    const key = `${tool}:${risk}`;
    if (this.sessionApproved.has(key)) return true;

    // Ask user
    return this.prompt(tool, args, risk, key);
  }

  close(): void {
    if (this.rl) { this.rl.close(); this.rl = null; }
  }

  private autoApproves(risk: RiskLevel): boolean {
    switch (this.trustLevel) {
      case 'yolo': return true;
      case 'trust': return risk !== 'critical';
      case 'normal': return risk === 'low';
      case 'cautious': return false;
    }
  }

  private pathRuleApproves(filePath: string, risk: RiskLevel): boolean {
    for (const rule of this.pathRules) {
      if (this.matchGlob(filePath, rule.glob)) {
        return this.autoApprovesForTrust(rule.trust, risk);
      }
    }
    return false;
  }

  private autoApprovesForTrust(trust: TrustLevel, risk: RiskLevel): boolean {
    switch (trust) {
      case 'yolo': return true;
      case 'trust': return risk !== 'critical';
      case 'normal': return risk === 'low';
      case 'cautious': return false;
    }
  }

  private matchGlob(filePath: string, glob: string): boolean {
    // Simple glob matching — ** matches anything, * matches single level
    const pattern = glob
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{DOUBLESTAR\}\}/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${pattern}$`).test(filePath);
  }

  private async prompt(tool: string, args: Record<string, unknown>, risk: RiskLevel, sessionKey: string): Promise<boolean> {
    const riskColors: Record<string, (s: string) => string> = {
      low: t.success, medium: t.warning, high: t.error, critical: (s: string) => t.error(t.bold(s)),
    };
    const color = riskColors[risk] || t.warning;

    console.log(`\n  ${icons.lock} ${t.bold('Permission')} ${color(`[${risk}]`)}`);
    console.log(`  ${t.tool(tool)} ${t.dim(this.formatArgs(tool, args))}`);
    console.log(t.dim('  [y]es / [n]o / [s]ession / [a]lways'));

    this.rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      const answer = (await this.rl.question(t.prompt('  > '))).trim().toLowerCase();
      switch (answer) {
        case 'y': case 'yes': case '': return true;
        case 's': case 'session':
          this.sessionApproved.add(sessionKey);
          console.log(t.dim(`  ${icons.success} Auto-approved for session`));
          return true;
        case 'a': case 'always':
          this.trustLevel = 'trust';
          console.log(t.dim(`  ${icons.success} Trust elevated`));
          return true;
        default: return false;
      }
    } finally {
      this.rl.close();
      this.rl = null;
    }
  }

  private formatArgs(tool: string, args: Record<string, unknown>): string {
    if (args.path) return String(args.path);
    if (args.command) return String(args.command).slice(0, 60);
    return JSON.stringify(args).slice(0, 60);
  }
}
