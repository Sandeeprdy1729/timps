// ── TIMPS Code — Shared Team Memory ──
// Encrypted shared memory so all team members see the same project context.
// Protected by project name + password → AES-256-GCM encryption.
// Stores: shared facts, tech stack, sessions, progress tracking.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type { TeamMemoryStore, TeamSession, MemoryEntry, TechStack } from '../config/types.js';
import { generateId } from '../utils/utils.js';

const TEAMS_DIR = path.join(os.homedir(), '.timps', 'teams');

// ═══════════════════════════════════════
// Encryption — AES-256-GCM with PBKDF2 key derivation
// ═══════════════════════════════════════

function deriveKey(projectName: string, password: string): Buffer {
  // Use project name as salt — deterministic so all team members derive same key
  const salt = crypto.createHash('sha256').update(projectName).digest();
  return crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha512');
}

function encrypt(data: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decrypt(encoded: string, key: Buffer): string | null {
  try {
    const [ivB64, tagB64, dataB64] = encoded.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
  } catch {
    return null; // Wrong password or corrupted data
  }
}

// ═══════════════════════════════════════
// Team Memory class
// ═══════════════════════════════════════

export class TeamMemory {
  private projectName: string;
  private key: Buffer;
  private storeFile: string;

  constructor(projectName: string, password: string) {
    this.projectName = projectName;
    this.key = deriveKey(projectName, password);
    // Use hashed project name as directory (don't leak project name in filesystem)
    const dirHash = crypto.createHash('sha256').update(projectName).digest('hex').slice(0, 16);
    const dir = path.join(TEAMS_DIR, dirHash);
    fs.mkdirSync(dir, { recursive: true });
    this.storeFile = path.join(dir, 'team.enc');
  }

  // ── Load / Save (encrypted) ──

  private load(): TeamMemoryStore {
    if (!fs.existsSync(this.storeFile)) {
      return this.createEmpty();
    }
    const raw = fs.readFileSync(this.storeFile, 'utf-8');
    const json = decrypt(raw, this.key);
    if (!json) {
      throw new Error('Wrong password — cannot decrypt team memory.');
    }
    return JSON.parse(json);
  }

  private save(store: TeamMemoryStore): void {
    const json = JSON.stringify(store, null, 2);
    const encrypted = encrypt(json, this.key);
    fs.writeFileSync(this.storeFile, encrypted, 'utf-8');
  }

  private createEmpty(): TeamMemoryStore {
    return {
      projectName: this.projectName,
      createdAt: Date.now(),
      techStack: { languages: [], frameworks: [], libraries: [], patterns: [], rules: [] },
      members: [],
      sessions: [],
      sharedFacts: [],
      progress: [],
    };
  }

  // ── Validate password (try decrypt) ──

  validate(): boolean {
    if (!fs.existsSync(this.storeFile)) return true; // New project, any password works
    try {
      this.load();
      return true;
    } catch {
      return false;
    }
  }

  // ── Member management ──

  join(memberName: string): void {
    const store = this.load();
    if (!store.members.includes(memberName)) {
      store.members.push(memberName);
    }
    this.save(store);
  }

  leave(memberName: string): void {
    const store = this.load();
    store.members = store.members.filter(m => m !== memberName);
    this.save(store);
  }

  getMembers(): string[] {
    return this.load().members;
  }

  // ── Tech Stack ──

  setTechStack(techStack: TechStack): void {
    const store = this.load();
    store.techStack = techStack;
    this.save(store);
  }

  getTechStack(): TechStack {
    return this.load().techStack;
  }

  // ── Sessions — each member contributes their work ──

  addSession(session: TeamSession): void {
    const store = this.load();
    store.sessions.push(session);
    // Keep last 200 sessions
    if (store.sessions.length > 200) {
      store.sessions = store.sessions.slice(-200);
    }
    this.save(store);
  }

  getSessions(count = 20): TeamSession[] {
    return this.load().sessions.slice(-count);
  }

  getSessionsByMember(memberName: string, count = 10): TeamSession[] {
    return this.load().sessions
      .filter(s => s.memberName === memberName)
      .slice(-count);
  }

  // ── Shared Facts — facts visible to all team members ──

  addFact(content: string, type: MemoryEntry['type'] = 'fact', tags: string[] = []): void {
    const store = this.load();
    // Deduplicate
    if (store.sharedFacts.some(f => this.similarity(f.content, content) > 0.8)) return;
    store.sharedFacts.push({
      id: generateId('team'),
      timestamp: Date.now(),
      type,
      content,
      tags,
      confidence: 1.0,
      accessCount: 0,
    });
    // Cap at 500
    if (store.sharedFacts.length > 500) {
      store.sharedFacts.sort((a, b) => b.confidence - a.confidence);
      store.sharedFacts.length = 500;
    }
    this.save(store);
  }

  getFacts(count = 30): MemoryEntry[] {
    return this.load().sharedFacts.slice(-count);
  }

  // ── Progress Tracking ──

  addProgress(task: string, status: string, assignee?: string): void {
    const store = this.load();
    // Update existing task or add new
    const existing = store.progress.find(p => p.task === task);
    if (existing) {
      existing.status = status;
      existing.assignee = assignee || existing.assignee;
      existing.timestamp = Date.now();
    } else {
      store.progress.push({ task, status, assignee, timestamp: Date.now() });
    }
    // Keep last 100 progress items
    if (store.progress.length > 100) {
      store.progress = store.progress.slice(-100);
    }
    this.save(store);
  }

  getProgress(): { task: string; status: string; assignee?: string; timestamp: number }[] {
    return this.load().progress;
  }

  // ── Context string for system prompt ──

  getContextString(): string {
    const store = this.load();
    const parts: string[] = [];

    parts.push(`TEAM PROJECT: ${store.projectName}`);
    parts.push(`TEAM MEMBERS: ${store.members.join(', ') || 'none yet'}`);

    // Tech stack (most important for consistent coding)
    const ts = store.techStack;
    const stackParts: string[] = [];
    if (ts.languages.length > 0) stackParts.push(`Languages: ${ts.languages.join(', ')}`);
    if (ts.frameworks.length > 0) stackParts.push(`Frameworks: ${ts.frameworks.join(', ')}`);
    if (ts.libraries.length > 0) stackParts.push(`Libraries: ${ts.libraries.join(', ')}`);
    if (ts.patterns.length > 0) stackParts.push(`Patterns: ${ts.patterns.join(', ')}`);
    if (ts.rules.length > 0) stackParts.push(`Rules:\n${ts.rules.map(r => `  - ${r}`).join('\n')}`);
    if (stackParts.length > 0) {
      parts.push(`REQUIRED TECH STACK:\n${stackParts.join('\n')}`);
    }

    // Recent sessions from other team members
    const recentSessions = store.sessions.slice(-5);
    if (recentSessions.length > 0) {
      parts.push('RECENT TEAM ACTIVITY:');
      for (const s of recentSessions) {
        const ago = this.timeSince(s.timestamp);
        parts.push(`  • [${s.memberName}] ${s.summary} (${ago})`);
        if (s.filesChanged.length > 0) {
          parts.push(`    Files: ${s.filesChanged.slice(0, 5).join(', ')}`);
        }
      }
    }

    // Shared facts
    const facts = store.sharedFacts.slice(-10);
    if (facts.length > 0) {
      parts.push('SHARED PROJECT KNOWLEDGE:');
      for (const f of facts) {
        parts.push(`  • [${f.type}] ${f.content}`);
      }
    }

    // Progress
    const progress = store.progress.filter(p => p.status !== 'done').slice(-10);
    if (progress.length > 0) {
      parts.push('PROJECT PROGRESS:');
      for (const p of progress) {
        const assignee = p.assignee ? ` (${p.assignee})` : '';
        parts.push(`  • [${p.status}] ${p.task}${assignee}`);
      }
    }

    return parts.join('\n\n');
  }

  // ── Stats ──

  stats(): { members: number; sessions: number; facts: number; progress: number; techStackSet: boolean } {
    const store = this.load();
    const ts = store.techStack;
    return {
      members: store.members.length,
      sessions: store.sessions.length,
      facts: store.sharedFacts.length,
      progress: store.progress.length,
      techStackSet: ts.languages.length > 0 || ts.frameworks.length > 0,
    };
  }

  private similarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    if (setA.size === 0 && setB.size === 0) return 1;
    let intersection = 0;
    for (const w of setA) if (setB.has(w)) intersection++;
    return (2 * intersection) / (setA.size + setB.size);
  }

  private timeSince(ts: number): string {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }
}
