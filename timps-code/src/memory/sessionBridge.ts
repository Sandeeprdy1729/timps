// ── TIMPS Session Bridge — Cross-session persistent memory loader ──
// Solves Claude Code's #1 limitation: re-learning the codebase every session.
// Proactively injects relevant context from past sessions at startup.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface SessionSummary {
  sessionId: string;
  timestamp: number;
  projectPath: string;
  projectHash: string;
  duration: number;           // ms
  messageCount: number;
  tasksCompleted: string[];
  filesChanged: string[];
  keyDecisions: string[];     // Important choices made
  conventions: string[];      // Discovered coding conventions
  knownIssues: string[];      // Bugs/problems discovered but not fixed
  techStack: string[];        // Detected frameworks/tools
  activeGoal: string;
  outcome: 'completed' | 'partial' | 'failed' | 'interrupted';
}

export interface ProjectProfile {
  projectPath: string;
  projectHash: string;
  firstSeen: number;
  lastSeen: number;
  totalSessions: number;
  conventions: string[];
  techStack: string[];
  knownIssues: string[];
  keyDecisions: string[];
  hotFiles: string[];          // Most frequently edited files
  teamMembers: string[];       // Git authors seen
  codebaseSize?: number;
}

export interface BridgeContext {
  projectProfile: ProjectProfile | null;
  recentSessions: SessionSummary[];
  relevantContext: string;     // Pre-built prompt injection string
  coldStartHints: string[];    // What the agent should know immediately
}

const BRIDGE_DIR = path.join(os.homedir(), '.timps', 'bridge');

export class SessionBridge {
  private projectHash: string;
  private projectPath: string;
  private bridgePath: string;
  private profilePath: string;
  private sessionsPath: string;

  constructor(projectHash: string, projectPath: string) {
    this.projectHash = projectHash;
    this.projectPath = projectPath;
    this.bridgePath = path.join(BRIDGE_DIR, projectHash);
    this.profilePath = path.join(this.bridgePath, 'profile.json');
    this.sessionsPath = path.join(this.bridgePath, 'sessions.jsonl');

    fs.mkdirSync(this.bridgePath, { recursive: true });
  }

  // ── Load context at session start ──────────────────────────────────────────

  /**
   * Returns cached context if already loaded, otherwise loads fresh.
   * Safe to call from buildSystemPrompt().
   */
  getCachedContext(): BridgeContext | null {
    if (this._cachedContext) return this._cachedContext;
    try {
      this._cachedContext = this.loadContext();
      return this._cachedContext;
    } catch {
      return null;
    }
  }
  private _cachedContext: BridgeContext | null = null;

  /**
   * Call this at the start of every session.
   * Returns pre-built context that prevents the agent from re-learning the codebase.
   */
  loadContext(currentTask?: string): BridgeContext {
    const projectProfile = this.loadProfile();
    const recentSessions = this.loadRecentSessions(5);
    const coldStartHints: string[] = [];

    if (!projectProfile && recentSessions.length === 0) {
      return {
        projectProfile: null,
        recentSessions: [],
        relevantContext: '',
        coldStartHints: [],
      };
    }

    // Build cold-start hints for the agent
    if (projectProfile) {
      if (projectProfile.techStack.length > 0) {
        coldStartHints.push(`Tech stack: ${projectProfile.techStack.join(', ')}`);
      }
      if (projectProfile.conventions.length > 0) {
        coldStartHints.push(`Conventions: ${projectProfile.conventions.slice(0, 5).join('; ')}`);
      }
      if (projectProfile.knownIssues.length > 0) {
        coldStartHints.push(`Known issues: ${projectProfile.knownIssues.slice(0, 3).join('; ')}`);
      }
      if (projectProfile.hotFiles.length > 0) {
        coldStartHints.push(`Frequently edited: ${projectProfile.hotFiles.slice(0, 5).join(', ')}`);
      }
    }

    const relevantContext = this.buildContextString(
      projectProfile,
      recentSessions,
      currentTask
    );

    const ctx = {
      projectProfile,
      recentSessions,
      relevantContext,
      coldStartHints,
    };
    this._cachedContext = ctx;
    return ctx;
  }

  private buildContextString(
    profile: ProjectProfile | null,
    sessions: SessionSummary[],
    currentTask?: string
  ): string {
    const parts: string[] = [];

    if (profile) {
      parts.push(`## Project Memory (${profile.totalSessions} sessions)`);

      if (profile.techStack.length > 0) {
        parts.push(`**Tech Stack**: ${profile.techStack.join(', ')}`);
      }

      if (profile.conventions.length > 0) {
        parts.push(`**Coding Conventions**:`);
        for (const conv of profile.conventions.slice(0, 8)) {
          parts.push(`- ${conv}`);
        }
      }

      if (profile.keyDecisions.length > 0) {
        parts.push(`**Architecture Decisions**:`);
        for (const dec of profile.keyDecisions.slice(0, 5)) {
          parts.push(`- ${dec}`);
        }
      }

      if (profile.knownIssues.length > 0) {
        parts.push(`**Known Issues (unresolved)**:`);
        for (const issue of profile.knownIssues.slice(0, 5)) {
          parts.push(`- ${issue}`);
        }
      }
    }

    if (sessions.length > 0) {
      parts.push(`\n## Recent Session History`);
      for (const session of sessions.slice(0, 3)) {
        const age = this.humanAge(session.timestamp);
        parts.push(`**${age}**: ${session.activeGoal} [${session.outcome}]`);
        if (session.filesChanged.length > 0) {
          parts.push(`  Changed: ${session.filesChanged.slice(0, 4).join(', ')}`);
        }
      }
    }

    // If current task is provided, find relevant past context
    if (currentTask) {
      const relevant = this.findRelevantPastWork(currentTask, sessions);
      if (relevant) {
        parts.push(`\n## Relevant Past Work`);
        parts.push(relevant);
      }
    }

    return parts.join('\n');
  }

  private findRelevantPastWork(task: string, sessions: SessionSummary[]): string {
    const taskWords = task.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const scored: Array<{ session: SessionSummary; score: number }> = [];

    for (const session of sessions) {
      const text = [
        session.activeGoal,
        ...session.tasksCompleted,
        ...session.conventions,
        ...session.keyDecisions,
      ].join(' ').toLowerCase();

      const score = taskWords.filter(w => text.includes(w)).length;
      if (score > 0) scored.push({ session, score });
    }

    if (scored.length === 0) return '';

    const best = scored.sort((a, b) => b.score - a.score)[0];
    const s = best.session;
    const age = this.humanAge(s.timestamp);

    return `${age}: "${s.activeGoal}" — ${s.outcome}. Decisions: ${s.keyDecisions.slice(0, 2).join('; ')}`;
  }

  // ── Save context at session end ────────────────────────────────────────────

  /**
   * Call this at the end of every session to persist learnings.
   */
  saveSession(summary: Omit<SessionSummary, 'sessionId' | 'timestamp' | 'projectPath' | 'projectHash'>): void {
    const session: SessionSummary = {
      ...summary,
      sessionId: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      projectPath: this.projectPath,
      projectHash: this.projectHash,
    };

    // Append to sessions log
    try {
      fs.appendFileSync(this.sessionsPath, JSON.stringify(session) + '\n');
    } catch { /* ignore */ }

    // Update project profile
    this.updateProfile(session);
  }

  private updateProfile(session: SessionSummary): void {
    const existing = this.loadProfile() ?? {
      projectPath: this.projectPath,
      projectHash: this.projectHash,
      firstSeen: session.timestamp,
      lastSeen: session.timestamp,
      totalSessions: 0,
      conventions: [],
      techStack: [],
      knownIssues: [],
      keyDecisions: [],
      hotFiles: [],
      teamMembers: [],
    };

    existing.lastSeen = session.timestamp;
    existing.totalSessions++;

    // Merge and deduplicate conventions
    existing.conventions = this.mergeUnique(existing.conventions, session.conventions, 20);

    // Merge tech stack
    existing.techStack = this.mergeUnique(existing.techStack, session.techStack, 15);

    // Update known issues: remove fixed ones, add new ones
    existing.knownIssues = this.mergeUnique(existing.knownIssues, session.knownIssues, 20);

    // Merge key decisions
    existing.keyDecisions = this.mergeUnique(existing.keyDecisions, session.keyDecisions, 15);

    // Update hot files: increment frequency counters
    const hotFileMap = new Map<string, number>(
      existing.hotFiles.map((f, i) => [f, existing.hotFiles.length - i])
    );
    for (const file of session.filesChanged) {
      hotFileMap.set(file, (hotFileMap.get(file) ?? 0) + 1);
    }
    existing.hotFiles = Array.from(hotFileMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([f]) => f);

    this.saveProfile(existing);
  }

  private mergeUnique(existing: string[], incoming: string[], maxSize: number): string[] {
    const set = new Set(existing);
    for (const item of incoming) set.add(item);
    return Array.from(set).slice(0, maxSize);
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private loadProfile(): ProjectProfile | null {
    try {
      if (fs.existsSync(this.profilePath)) {
        return JSON.parse(fs.readFileSync(this.profilePath, 'utf-8'));
      }
    } catch { /* ignore */ }
    return null;
  }

  private saveProfile(profile: ProjectProfile): void {
    try {
      fs.writeFileSync(this.profilePath, JSON.stringify(profile, null, 2));
    } catch { /* ignore */ }
  }

  private loadRecentSessions(limit: number): SessionSummary[] {
    try {
      if (!fs.existsSync(this.sessionsPath)) return [];
      const lines = fs.readFileSync(this.sessionsPath, 'utf-8')
        .split('\n')
        .filter(l => l.trim());

      return lines
        .slice(-limit)
        .map(l => JSON.parse(l) as SessionSummary)
        .reverse(); // Most recent first
    } catch { return []; }
  }

  // ── Convention extraction helpers ──────────────────────────────────────────

  /**
   * Extract conventions from agent output text.
   * Call this whenever the agent produces output about the codebase.
   */
  static extractConventions(agentOutput: string): string[] {
    const conventions: string[] = [];
    const patterns = [
      /uses?\s+([\w\s]+)\s+for\s+([\w\s]+)/gi,
      /follow(?:s|ing)?\s+([\w\s]+)\s+pattern/gi,
      /convention[:\s]+(.*?)(?:\.|$)/gim,
      /always\s+([\w\s]+)/gi,
      /never\s+([\w\s]+)/gi,
      /standard[:\s]+(.*?)(?:\.|$)/gim,
    ];

    for (const pattern of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(agentOutput)) !== null) {
        const conv = m[0].trim().slice(0, 120);
        if (conv.length > 10) conventions.push(conv);
      }
    }

    return [...new Set(conventions)].slice(0, 10);
  }

  /**
   * Extract known issues from agent error/problem output.
   */
  static extractKnownIssues(agentOutput: string): string[] {
    const issues: string[] = [];
    const patterns = [
      /TODO[:\s]+(.*?)(?:\n|$)/gim,
      /FIXME[:\s]+(.*?)(?:\n|$)/gim,
      /bug[:\s]+(.*?)(?:\n|$)/gim,
      /issue[:\s]+(.*?)(?:\.|$)/gim,
      /problem[:\s]+(.*?)(?:\.|$)/gim,
    ];

    for (const pattern of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(agentOutput)) !== null) {
        const issue = m[1]?.trim().slice(0, 120);
        if (issue && issue.length > 5) issues.push(issue);
      }
    }

    return [...new Set(issues)].slice(0, 10);
  }

  /**
   * Extract key decisions from agent output.
   */
  static extractKeyDecisions(agentOutput: string): string[] {
    const decisions: string[] = [];
    const patterns = [
      /chose?\s+([\w\s]+)\s+(?:because|over|instead)/gi,
      /decided\s+to\s+(.*?)(?:\.|$)/gim,
      /using\s+([\w\s]+)\s+instead\s+of\s+([\w\s]+)/gi,
      /architecture[:\s]+(.*?)(?:\.|$)/gim,
    ];

    for (const pattern of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(agentOutput)) !== null) {
        const decision = m[0].trim().slice(0, 150);
        if (decision.length > 10) decisions.push(decision);
      }
    }

    return [...new Set(decisions)].slice(0, 8);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private humanAge(timestamp: number): string {
    const ms = Date.now() - timestamp;
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(ms / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  }

  /**
   * Mark an issue as resolved so it gets removed from known issues.
   */
  resolveIssue(issueText: string): void {
    const profile = this.loadProfile();
    if (!profile) return;

    profile.knownIssues = profile.knownIssues.filter(
      issue => !issue.toLowerCase().includes(issueText.toLowerCase().slice(0, 30))
    );
    this.saveProfile(profile);
  }

  /**
   * Get a one-line summary of past experience with this project.
   */
  getProjectSummaryLine(): string {
    const profile = this.loadProfile();
    if (!profile) return '';

    const age = this.humanAge(profile.firstSeen);
    return `Project known since ${age} — ${profile.totalSessions} sessions, ` +
      `${profile.techStack.slice(0, 3).join('/')} stack`;
  }
}
