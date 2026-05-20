// ── TIMPS Risk Engine — Smart approval to eliminate approval fatigue ──
// Solves Claude Code's #4 limitation: excessive approval prompts.
// Uses multi-factor risk scoring to auto-approve low-risk operations
// and only surface high-risk ones for human review.

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type ApprovalDecision = 'auto-approve' | 'require-approval' | 'deny';

export interface RiskFactor {
  name: string;
  score: number;    // 0-100
  reason: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;             // 0-100
  decision: ApprovalDecision;
  factors: RiskFactor[];
  explanation: string;
  reversible: boolean;
  canAutoApprove: boolean;
}

export interface TrustContext {
  trustedDirectories: string[];       // Dirs where writes are auto-approved
  sessionApprovedPatterns: string[];  // Patterns approved this session
  projectType: 'personal' | 'team' | 'enterprise';
  dangerousPatterns: string[];        // Extra deny-list for this project
}

// ── Risk scoring tables ────────────────────────────────────────────────────────

/** Base risk scores per tool type */
const TOOL_BASE_RISK: Record<string, number> = {
  // Read operations — always safe
  read_file: 0,
  list_directory: 0,
  find_files: 0,
  search_code: 0,
  get_git_status: 0,
  think: 0,
  TodoRead: 0,

  // Low-risk writes
  write_file: 20,
  edit_file: 15,
  multi_edit: 25,
  patch_file: 20,

  // Moderate operations
  run_tests: 30,
  run_bash: 40,

  // Higher risk
  git_commit: 35,
  git_push: 60,
  git_reset: 55,
  delete_file: 50,
};

/** Bash command risk modifiers */
const BASH_COMMAND_RISK: Array<{ pattern: RegExp; score: number; reversible: boolean; reason: string }> = [
  // Safe read commands
  { pattern: /^(ls|pwd|echo|cat|grep|find|head|tail|wc|diff|git\s+(?:status|diff|log|show|branch))/i, score: 0, reversible: true, reason: 'read-only command' },
  { pattern: /^npm\s+(test|run\s+(?:test|lint|build|typecheck))/i, score: 10, reversible: true, reason: 'test/build command' },
  { pattern: /^npx\s+tsc/i, score: 5, reversible: true, reason: 'type-check only' },

  // Install commands
  { pattern: /^npm\s+install/i, score: 30, reversible: true, reason: 'modifies node_modules' },
  { pattern: /^pip\s+install/i, score: 30, reversible: true, reason: 'modifies Python packages' },

  // Git write operations
  { pattern: /^git\s+commit/i, score: 35, reversible: true, reason: 'commits to git history' },
  { pattern: /^git\s+push/i, score: 65, reversible: false, reason: 'pushes to remote — hard to reverse' },
  { pattern: /^git\s+reset\s+--hard/i, score: 70, reversible: false, reason: 'destroys uncommitted work' },
  { pattern: /^git\s+force-push|--force/i, score: 80, reversible: false, reason: 'force push overwrites history' },

  // File system mutations
  { pattern: /^rm\s+(?!.*-rf)/i, score: 55, reversible: false, reason: 'deletes files' },
  { pattern: /^rm\s+.*-rf/i, score: 95, reversible: false, reason: 'recursive delete — DANGEROUS' },
  { pattern: /^mv\s/i, score: 40, reversible: true, reason: 'moves files (recoverable via git)' },

  // Elevated privileges
  { pattern: /^sudo\s/i, score: 90, reversible: false, reason: 'elevated privileges' },
  { pattern: /^su\s/i, score: 90, reversible: false, reason: 'user switch' },

  // Network operations
  { pattern: /^curl\s.*\|\s*(?:bash|sh)/i, score: 95, reversible: false, reason: 'executes remote code' },
  { pattern: /^wget\s.*\|\s*(?:bash|sh)/i, score: 95, reversible: false, reason: 'executes remote code' },
  { pattern: /^curl\s/i, score: 25, reversible: true, reason: 'network request' },

  // Secret-touching operations
  { pattern: /\.env|\.pem|\.key|\.p12|id_rsa|credentials/i, score: 70, reversible: false, reason: 'touches sensitive credentials' },
];

/** File path risk modifiers */
const FILE_PATH_RISK: Array<{ pattern: RegExp; score: number; reason: string }> = [
  { pattern: /\.env$|\.env\./i, score: 50, reason: 'environment file with secrets' },
  { pattern: /\.pem$|\.key$|\.p12$|\.pfx$/i, score: 60, reason: 'cryptographic key file' },
  { pattern: /id_rsa|id_ed25519|\.ssh\//i, score: 60, reason: 'SSH key material' },
  { pattern: /package\.json$/, score: 10, reason: 'manifest change' },
  { pattern: /tsconfig\.json$|webpack\.config|vite\.config/i, score: 15, reason: 'build config change' },
  { pattern: /docker-compose|Dockerfile/i, score: 20, reason: 'container config' },
  { pattern: /\.github\/workflows\//i, score: 35, reason: 'CI/CD pipeline change' },
  { pattern: /node_modules\//i, score: 5, reason: 'generated code' },
  { pattern: /dist\/|build\//i, score: 5, reason: 'compiled output' },
];

// ── RiskEngine class ───────────────────────────────────────────────────────────

export class RiskEngine {
  private trustContext: TrustContext;
  private sessionApprovedSet: Set<string>;
  private autoApproveThreshold: number;
  private requireApprovalThreshold: number;

  constructor(trustContext?: Partial<TrustContext>) {
    this.trustContext = {
      trustedDirectories: [],
      sessionApprovedPatterns: [],
      projectType: 'personal',
      dangerousPatterns: [],
      ...trustContext,
    };
    this.sessionApprovedSet = new Set(this.trustContext.sessionApprovedPatterns);

    // Thresholds: personal projects are more liberal, enterprise more conservative
    this.autoApproveThreshold = trustContext?.projectType === 'enterprise' ? 15 : 30;
    this.requireApprovalThreshold = trustContext?.projectType === 'enterprise' ? 50 : 65;
  }

  /**
   * Assess risk of a tool call and return approval decision.
   * This replaces the binary require-approval with intelligent scoring.
   */
  assess(toolName: string, args: Record<string, unknown>): RiskAssessment {
    const factors: RiskFactor[] = [];
    let totalScore = 0;
    let reversible = true;

    // 1. Base risk from tool type
    const baseTool = this.normalizeToolName(toolName);
    const baseScore = TOOL_BASE_RISK[baseTool] ?? 40;
    factors.push({ name: 'tool_type', score: baseScore, reason: `Tool: ${toolName}` });
    totalScore += baseScore;

    // 2. Bash command analysis
    if (toolName === 'run_bash' || toolName === 'Bash') {
      const cmd = String(args.command ?? args.cmd ?? '');
      const bashAssessment = this.assessBashCommand(cmd);
      factors.push(...bashAssessment.factors);
      totalScore = Math.max(totalScore, bashAssessment.maxScore);
      if (!bashAssessment.reversible) reversible = false;
    }

    // 3. File path risk
    const filePath = String(args.path ?? args.filePath ?? args.file ?? '');
    if (filePath) {
      const pathAssessment = this.assessFilePath(filePath);
      if (pathAssessment.score > 0) {
        factors.push({ name: 'file_path', score: pathAssessment.score, reason: pathAssessment.reason });
        totalScore = Math.max(totalScore, baseScore + pathAssessment.score * 0.5);
      }

      // Trusted directory discount
      if (this.isTrustedDirectory(filePath)) {
        const discount = 20;
        factors.push({ name: 'trusted_dir', score: -discount, reason: 'File is in a trusted directory' });
        totalScore = Math.max(0, totalScore - discount);
      }
    }

    // 4. Session-level approval cache
    const cacheKey = this.buildCacheKey(toolName, args);
    if (this.sessionApprovedSet.has(cacheKey)) {
      factors.push({ name: 'session_cached', score: -30, reason: 'Similar operation approved this session' });
      totalScore = Math.max(0, totalScore - 30);
    }

    // 5. Custom dangerous patterns
    for (const pattern of this.trustContext.dangerousPatterns) {
      const argStr = JSON.stringify(args);
      if (argStr.includes(pattern)) {
        factors.push({ name: 'custom_deny', score: 100, reason: `Matches project deny-list: ${pattern}` });
        totalScore = 100;
        reversible = false;
      }
    }

    // Clamp to 0-100
    totalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    const level = this.scoreToLevel(totalScore);
    const decision = this.levelToDecision(level, totalScore);
    const canAutoApprove = decision === 'auto-approve';

    const explanation = this.buildExplanation(toolName, factors, level, decision);

    return {
      level,
      score: totalScore,
      decision,
      factors,
      explanation,
      reversible,
      canAutoApprove,
    };
  }

  /** Record that a user approved a specific operation to avoid re-asking */
  recordApproval(toolName: string, args: Record<string, unknown>): void {
    const key = this.buildCacheKey(toolName, args);
    this.sessionApprovedSet.add(key);
  }

  /** Add a directory to the trusted list (writes auto-approved) */
  trustDirectory(dirPath: string): void {
    if (!this.trustContext.trustedDirectories.includes(dirPath)) {
      this.trustContext.trustedDirectories.push(dirPath);
    }
  }

  /** Get a human-readable risk badge for TUI display */
  badge(level: RiskLevel): string {
    const badges: Record<RiskLevel, string> = {
      safe: '🟢 SAFE',
      low: '🔵 LOW',
      medium: '🟡 MEDIUM',
      high: '🟠 HIGH',
      critical: '🔴 CRITICAL',
    };
    return badges[level];
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private assessBashCommand(cmd: string): { factors: RiskFactor[]; maxScore: number; reversible: boolean } {
    const factors: RiskFactor[] = [];
    let maxScore = 0;
    let reversible = true;

    for (const entry of BASH_COMMAND_RISK) {
      if (entry.pattern.test(cmd)) {
        factors.push({ name: 'bash_pattern', score: entry.score, reason: entry.reason });
        if (entry.score > maxScore) maxScore = entry.score;
        if (!entry.reversible) reversible = false;
        break; // Use first (most specific) match
      }
    }

    // Piped commands are riskier
    if (cmd.includes('|') && maxScore > 0) {
      factors.push({ name: 'piped_cmd', score: 10, reason: 'piped command chain' });
      maxScore = Math.min(100, maxScore + 10);
    }

    return { factors, maxScore, reversible };
  }

  private assessFilePath(filePath: string): { score: number; reason: string } {
    for (const entry of FILE_PATH_RISK) {
      if (entry.pattern.test(filePath)) {
        return { score: entry.score, reason: entry.reason };
      }
    }
    return { score: 0, reason: '' };
  }

  private isTrustedDirectory(filePath: string): boolean {
    return this.trustContext.trustedDirectories.some(dir =>
      filePath.startsWith(dir) || filePath.startsWith(dir + '/')
    );
  }

  private buildCacheKey(toolName: string, args: Record<string, unknown>): string {
    // Create a semantic key that groups similar operations
    const tool = this.normalizeToolName(toolName);

    if (tool === 'run_bash') {
      // Cache by command prefix (first 3 words)
      const cmd = String(args.command ?? '').split(/\s+/).slice(0, 3).join(' ');
      return `bash:${cmd}`;
    }

    const filePath = String(args.path ?? args.filePath ?? '');
    if (filePath) {
      // Cache by file extension + tool
      const ext = filePath.split('.').pop() ?? '*';
      return `${tool}:*.${ext}`;
    }

    return `${tool}:*`;
  }

  private normalizeToolName(name: string): string {
    const aliases: Record<string, string> = {
      Bash: 'run_bash',
      Read: 'read_file',
      Write: 'write_file',
      Edit: 'edit_file',
      Glob: 'find_files',
      Grep: 'search_code',
    };
    return aliases[name] ?? name.toLowerCase().replace(/[-\s]/g, '_');
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score <= 10) return 'safe';
    if (score <= 30) return 'low';
    if (score <= 60) return 'medium';
    if (score <= 80) return 'high';
    return 'critical';
  }

  private levelToDecision(level: RiskLevel, score: number): ApprovalDecision {
    // Critical always denied
    if (level === 'critical') return 'deny';

    // Score below auto-approve threshold → approve automatically
    if (score <= this.autoApproveThreshold) return 'auto-approve';

    // Score above require-approval threshold → always ask
    if (score >= this.requireApprovalThreshold) return 'require-approval';

    // Middle ground → require approval for high, auto for medium/low
    if (level === 'high') return 'require-approval';
    return 'auto-approve';
  }

  private buildExplanation(
    toolName: string,
    factors: RiskFactor[],
    level: RiskLevel,
    decision: ApprovalDecision
  ): string {
    const topFactors = factors
      .filter(f => Math.abs(f.score) > 5)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 3)
      .map(f => f.reason);

    const decisionText = decision === 'auto-approve' ? 'auto-approved' :
                         decision === 'deny' ? 'BLOCKED' : 'needs your approval';

    return `${toolName} [${level.toUpperCase()}]: ${decisionText}. ` +
      (topFactors.length > 0 ? `Reason: ${topFactors.join('; ')}` : '');
  }
}
