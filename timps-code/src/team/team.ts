// team.ts - Team Collaboration Features
// Shared memory and context across team members

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getMemoryDir } from '../config/config.js';

export interface TeamMember {
  id: string;
  name: string;
  joinedAt: number;
  lastActive: number;
  role: 'owner' | 'member';
}

export interface SharedFact {
  id: string;
  content: string;
  type: 'fact' | 'decision' | 'convention' | 'todo';
  author: string;
  createdAt: number;
  votes: number;
  tags: string[];
}

export interface TeamProgress {
  id: string;
  task: string;
  status: 'todo' | 'in-progress' | 'done';
  assignee?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface TeamSession {
  memberId: string;
  timestamp: number;
  summary: string;
  filesChanged: string[];
  toolsUsed: string[];
}

export interface TeamConfig {
  projectName: string;
  passwordHash: string;
  createdAt: number;
  members: TeamMember[];
}

export class Team {
  private teamPath: string;
  private config: TeamConfig | null = null;
  private sharedFacts: SharedFact[] = [];
  private progress: TeamProgress[] = [];
  private sessions: TeamSession[] = [];

  constructor(projectName: string, password?: string) {
    const baseDir = path.join(process.env.HOME || '~', '.timps', 'teams');
    this.teamPath = path.join(baseDir, projectName);
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.teamPath)) {
        const configFile = path.join(this.teamPath, 'config.json');
        if (fs.existsSync(configFile)) {
          this.config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        }
        this.loadFacts();
        this.loadProgress();
        this.loadSessions();
      }
    } catch {}
  }

  private save(): void {
    if (!this.config) return;
    fs.mkdirSync(this.teamPath, { recursive: true });
    fs.writeFileSync(
      path.join(this.teamPath, 'config.json'),
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );
  }

  private loadFacts(): void {
    try {
      const factsFile = path.join(this.teamPath, 'facts.jsonl');
      if (fs.existsSync(factsFile)) {
        const lines = fs.readFileSync(factsFile, 'utf-8').trim().split('\n');
        this.sharedFacts = lines.map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
      }
    } catch {}
  }

  private saveFact(fact: SharedFact): void {
    const factsFile = path.join(this.teamPath, 'facts.jsonl');
    fs.appendFileSync(factsFile, JSON.stringify(fact) + '\n', 'utf-8');
    this.sharedFacts.push(fact);
  }

  private loadProgress(): void {
    try {
      const progressFile = path.join(this.teamPath, 'progress.json');
      if (fs.existsSync(progressFile)) {
        this.progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      }
    } catch {}
  }

  private saveProgress(): void {
    const progressFile = path.join(this.teamPath, 'progress.json');
    fs.writeFileSync(progressFile, JSON.stringify(this.progress, null, 2), 'utf-8');
  }

  private loadSessions(): void {
    try {
      const sessionsFile = path.join(this.teamPath, 'sessions.jsonl');
      if (fs.existsSync(sessionsFile)) {
        const lines = fs.readFileSync(sessionsFile, 'utf-8').trim().split('\n');
        this.sessions = lines.map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
      }
    } catch {}
  }

  private saveSession(session: TeamSession): void {
    const sessionsFile = path.join(this.teamPath, 'sessions.jsonl');
    fs.appendFileSync(sessionsFile, JSON.stringify(session) + '\n', 'utf-8');
    this.sessions.push(session);
  }

  create(name: string, password: string): boolean {
    if (this.config) return false;

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    this.config = {
      projectName: name,
      passwordHash,
      createdAt: Date.now(),
      members: [{
        id: crypto.randomUUID(),
        name,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        role: 'owner',
      }],
    };

    this.save();
    return true;
  }

  validate(password: string): boolean {
    if (!this.config) return false;
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash === this.config.passwordHash;
  }

  join(name: string): TeamMember | null {
    if (!this.config) return null;

    const member: TeamMember = {
      id: crypto.randomUUID(),
      name,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      role: 'member',
    };

    this.config.members.push(member);
    this.save();
    return member;
  }

  leave(memberId: string): boolean {
    if (!this.config) return false;

    const idx = this.config.members.findIndex(m => m.id === memberId);
    if (idx === -1) return false;

    if (this.config.members[idx].role === 'owner') return false;

    this.config.members.splice(idx, 1);
    this.save();
    return true;
  }

  addFact(content: string, type: SharedFact['type'], tags: string[] = [], author?: string): SharedFact {
    const fact: SharedFact = {
      id: crypto.randomUUID(),
      content,
      type,
      author: author || 'anonymous',
      createdAt: Date.now(),
      votes: 0,
      tags,
    };
    this.saveFact(fact);
    return fact;
  }

  voteFact(factId: string, delta: number): void {
    const fact = this.sharedFacts.find(f => f.id === factId);
    if (fact) {
      fact.votes += delta;
    }
  }

  getFacts(filter?: { type?: SharedFact['type']; minVotes?: number }): SharedFact[] {
    let facts = [...this.sharedFacts];

    if (filter?.type) {
      facts = facts.filter(f => f.type === filter.type);
    }
    if (filter?.minVotes !== undefined) {
      facts = facts.filter(f => f.votes >= filter.minVotes!);
    }

    return facts.sort((a, b) => b.votes - a.votes);
  }

  addProgress(task: string, status: TeamProgress['status'], assignee?: string): TeamProgress {
    const progress: TeamProgress = {
      id: crypto.randomUUID(),
      task,
      status,
      assignee,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: status === 'done' ? Date.now() : undefined,
    };
    this.progress.push(progress);
    this.saveProgress();
    return progress;
  }

  updateProgress(progressId: string, updates: Partial<TeamProgress>): TeamProgress | null {
    const idx = this.progress.findIndex(p => p.id === progressId);
    if (idx === -1) return null;

    this.progress[idx] = {
      ...this.progress[idx],
      ...updates,
      id: this.progress[idx].id,
      updatedAt: Date.now(),
      completedAt: updates.status === 'done' ? Date.now() : this.progress[idx].completedAt,
    };

    this.saveProgress();
    return this.progress[idx];
  }

  getProgress(): TeamProgress[] {
    return [...this.progress].sort((a, b) => {
      const statusOrder = { 'in-progress': 0, 'todo': 1, 'done': 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  recordSession(session: Omit<TeamSession, 'timestamp'>): void {
    this.saveSession({ ...session, timestamp: Date.now() });
  }

  getRecentSessions(limit: number = 10): TeamSession[] {
    return this.sessions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getMembers(): TeamMember[] {
    return this.config?.members || [];
  }

  getStats(): { members: number; facts: number; progress: number; sessions: number } {
    return {
      members: this.config?.members.length || 0,
      facts: this.sharedFacts.length,
      progress: this.progress.length,
      sessions: this.sessions.length,
    };
  }

  getContextString(): string {
    if (!this.config) return '';

    const parts: string[] = [];
    parts.push(`## Team: ${this.config.projectName}`);
    parts.push(`Members: ${this.config.members.map(m => m.name).join(', ')}`);

    const recentFacts = this.getFacts({ minVotes: 0 }).slice(0, 5);
    if (recentFacts.length > 0) {
      parts.push('\nShared Knowledge:');
      for (const fact of recentFacts) {
        parts.push(`• ${fact.content} (${fact.votes} votes, ${fact.author})`);
      }
    }

    const progress = this.getProgress().filter(p => p.status !== 'done').slice(0, 5);
    if (progress.length > 0) {
      parts.push('\nCurrent Tasks:');
      for (const p of progress) {
        const status = p.status === 'in-progress' ? '◐' : '○';
        parts.push(`• ${status} ${p.task}${p.assignee ? ` (${p.assignee})` : ''}`);
      }
    }

    return parts.join('\n');
  }

  export(): string {
    return JSON.stringify({
      config: this.config,
      facts: this.sharedFacts,
      progress: this.progress,
    }, null, 2);
  }
}
