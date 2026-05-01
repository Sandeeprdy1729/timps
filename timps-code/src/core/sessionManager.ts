// ── TIMPS Session Manager — Branching, Persistence, Search
// Inspired by Hermes Agent's session system

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface Session {
  id: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  parentSessionId?: string;
  branchName?: string;
  archived: boolean;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    arguments: string;
  }>;
}

export class SessionManager {
  private sessionsDir: string;
  private currentSessionId: string;
  private sessions: Map<string, Session> = new Map();
  
  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir || path.join(os.homedir(), '.timps', 'sessions');
    this.currentSessionId = this.generateSessionId();
    this.ensureDir();
    this.loadSessions();
  }
  
  private ensureDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }
  
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  private loadSessions(): void {
    try {
      const entries = fs.readdirSync(this.sessionsDir);
      for (const entry of entries) {
        const sessionPath = path.join(this.sessionsDir, entry);
        if (fs.statSync(sessionPath).isDirectory()) {
          const metaPath = path.join(sessionPath, 'meta.json');
          if (fs.existsSync(metaPath)) {
            const session = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as Session;
            this.sessions.set(session.id, session);
          }
        }
      }
    } catch (e) {
      // Start fresh if load fails
    }
  }
  
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }
  
  getSessionPath(sessionId?: string): string {
    const id = sessionId || this.currentSessionId;
    return path.join(this.sessionsDir, id);
  }
  
  async createSession(name?: string, parentSessionId?: string, branchName?: string): Promise<Session> {
    const id = this.generateSessionId();
    const session: Session = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      parentSessionId,
      branchName,
      archived: false,
    };
    
    const sessionPath = path.join(this.sessionsDir, id);
    fs.mkdirSync(sessionPath, { recursive: true });
    
    // If branching from parent, copy history
    if (parentSessionId) {
      const parentPath = this.getSessionPath(parentSessionId);
      const parentMessages = path.join(parentPath, 'messages.json');
      if (fs.existsSync(parentMessages)) {
        const messages = JSON.parse(fs.readFileSync(parentMessages, 'utf-8')) as SessionMessage[];
        const newMessages = [...messages];
        fs.writeFileSync(
          path.join(sessionPath, 'messages.json'),
          JSON.stringify(newMessages, null, 2)
        );
        session.messageCount = newMessages.length;
      }
    }
    
    fs.writeFileSync(
      path.join(sessionPath, 'meta.json'),
      JSON.stringify(session, null, 2)
    );
    
    this.sessions.set(id, session);
    return session;
  }
  
  async branchSession(name?: string): Promise<Session> {
    return this.createSession(name, this.currentSessionId, name || 'branch');
  }
  
  async listSessions(limit = 20): Promise<Session[]> {
    const sessions = [...this.sessions.values()]
      .filter(s => !s.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
    return sessions;
  }
  
  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }
  
  async saveMessages(sessionId: string, messages: SessionMessage[]): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    this.ensureDir();
    fs.writeFileSync(
      path.join(sessionPath, 'messages.json'),
      JSON.stringify(messages, null, 2)
    );
  }
  
  async loadMessages(sessionId: string): Promise<SessionMessage[]> {
    const sessionPath = this.getSessionPath(sessionId);
    const messagesPath = path.join(sessionPath, 'messages.json');
    if (fs.existsSync(messagesPath)) {
      return JSON.parse(fs.readFileSync(messagesPath, 'utf-8')) as SessionMessage[];
    }
    return [];
  }
  
  async appendMessage(
    sessionId: string, 
    message: Omit<SessionMessage, 'timestamp'>
  ): Promise<void> {
    const messages = await this.loadMessages(sessionId);
    messages.push({
      ...message,
      timestamp: Date.now(),
    });
    await this.saveMessages(sessionId, messages);
    
    // Update session metadata
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = messages.length;
      session.updatedAt = Date.now();
      const sessionPath = this.getSessionPath(sessionId);
      fs.writeFileSync(
        path.join(sessionPath, 'meta.json'),
        JSON.stringify(session, null, 2)
      );
    }
  }
  
  async searchSessions(query: string, limit = 10): Promise<Session[]> {
    const results: Array<{ session: Session; score: number }> = [];
    const queryLower = query.toLowerCase();
    
    for (const session of this.sessions.values()) {
      if (session.archived) continue;
      
      // Search in session messages
      const messages = await this.loadMessages(session.id);
      let score = 0;
      
      for (const msg of messages) {
        if (msg.content.toLowerCase().includes(queryLower)) {
          score += 1;
        }
      }
      
      // Bonus for name match
      if (session.name?.toLowerCase().includes(queryLower)) {
        score += 5;
      }
      
      if (score > 0) {
        results.push({ session, score });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.session);
  }
  
  async archiveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.archived = true;
      const sessionPath = this.getSessionPath(sessionId);
      fs.writeFileSync(
        path.join(sessionPath, 'meta.json'),
        JSON.stringify(session, null, 2)
      );
    }
  }
  
  async renameSession(sessionId: string, name: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.name = name;
      session.updatedAt = Date.now();
      const sessionPath = this.getSessionPath(sessionId);
      fs.writeFileSync(
        path.join(sessionPath, 'meta.json'),
        JSON.stringify(session, null, 2)
      );
    }
  }
  
  async compressSession(sessionId: string, focusTopic?: string): Promise<number> {
    const messages = await this.loadMessages(sessionId);
    if (messages.length < 10) return 0;
    
    // Keep first system message and last messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const recentMessages = messages.slice(-20);
    
    const compressed: SessionMessage[] = [
      ...systemMessages,
      {
        role: 'system',
        content: `[Context compressed from ${messages.length} messages. ${
          focusTopic ? `Focus: ${focusTopic}. ` : ''
        }Full history available in session backup.]`,
        timestamp: Date.now(),
      },
      ...recentMessages,
    ];
    
    await this.saveMessages(sessionId, compressed);
    
    // Update count
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = compressed.length;
      session.updatedAt = Date.now();
      const sessionPath = this.getSessionPath(sessionId);
      fs.writeFileSync(
        path.join(sessionPath, 'meta.json'),
        JSON.stringify(session, null, 2)
      );
    }
    
    return messages.length - compressed.length;
  }
  
  async switchToSession(sessionId: string): Promise<boolean> {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId;
      return true;
    }
    return false;
  }
  
  getSessionStats(sessionId?: string): {
    id: string;
    name?: string;
    messages: number;
    created: string;
    updated: string;
    branches: number;
  } {
    const id = sessionId || this.currentSessionId;
    const session = this.sessions.get(id);
    if (!session) {
      return { id: 'unknown', messages: 0, created: '', updated: '', branches: 0 };
    }
    
    // Count branches
    let branches = 0;
    for (const s of this.sessions.values()) {
      if (s.parentSessionId === id) branches++;
    }
    
    return {
      id: session.id,
      name: session.name,
      messages: session.messageCount,
      created: new Date(session.createdAt).toISOString(),
      updated: new Date(session.updatedAt).toISOString(),
      branches,
    };
  }
}

export const sessionManager = new SessionManager();