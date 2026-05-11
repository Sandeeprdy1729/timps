// ── TIMPS Multi-Agent Memory Coordination ──
// Memory leases, conflict resolution, pub/sub for team agents

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { getMemoryDir } from '../config/config.js';
import type { MemoryLease, ConflictEntry } from './types.js';

export class MemoryCoordinator {
  private dir: string;
  private leasesFile: string;
  private conflictQueueFile: string;
  private pubSubPort: number;

  constructor(projectPath: string, port = 18437) {
    this.dir = projectPath;
    this.leasesFile = path.join(this.dir, 'leases.json');
    this.conflictQueueFile = path.join(this.dir, 'conflict-queue.json');
    this.pubSubPort = port;
  }

  // ── Memory Leases ────────────────────────────────────────

  acquireLease(agentId: string, filePath: string, ttlMs = 300000): { success: boolean; expiresAt: number } {
    const leases = this.loadLeases();
    const existing = leases.find(l => l.filePath === filePath && l.expiresAt > Date.now());
    if (existing && existing.agentId !== agentId) {
      return { success: false, expiresAt: existing.expiresAt };
    }

    const expiresAt = Date.now() + ttlMs;
    const newLease: MemoryLease = { agentId, filePath, acquiredAt: Date.now(), expiresAt };
    const filtered = leases.filter(l => l.filePath !== filePath);
    filtered.push(newLease);
    this.saveLeases(filtered);

    return { success: true, expiresAt };
  }

  releaseLease(agentId: string, filePath: string): void {
    const leases = this.loadLeases().filter(l => !(l.agentId === agentId && l.filePath === filePath));
    this.saveLeases(leases);
  }

  getHotFiles(agentId: string): string[] {
    const leases = this.loadLeases().filter(l => l.agentId !== agentId && l.expiresAt > Date.now());
    return leases.map(l => l.filePath);
  }

  private loadLeases(): MemoryLease[] {
    try {
      if (!fs.existsSync(this.leasesFile)) return [];
      return JSON.parse(fs.readFileSync(this.leasesFile, 'utf-8'));
    } catch { return []; }
  }

  private saveLeases(leases: MemoryLease[]): void {
    fs.writeFileSync(this.leasesFile, JSON.stringify(leases, null, 2), 'utf-8');
  }

  // ── Conflict Resolution Queue ──────────────────────────────

  enqueueConflict(fact1: string, fact2: string, agentId: string): void {
    const conflicts = this.loadConflicts();
    conflicts.push({ fact1, fact2, detectedAt: Date.now(), resolved: false, resolution: undefined });
    fs.writeFileSync(this.conflictQueueFile, JSON.stringify(conflicts, null, 2), 'utf-8');
  }

  getPendingConflicts(): ConflictEntry[] {
    return this.loadConflicts().filter(c => !c.resolved);
  }

  resolveConflict(index: number, resolution: string): void {
    const conflicts = this.loadConflicts();
    if (conflicts[index]) {
      conflicts[index].resolved = true;
      conflicts[index].resolution = resolution;
      fs.writeFileSync(this.conflictQueueFile, JSON.stringify(conflicts, null, 2), 'utf-8');
    }
  }

  private loadConflicts(): ConflictEntry[] {
    try {
      if (!fs.existsSync(this.conflictQueueFile)) return [];
      return JSON.parse(fs.readFileSync(this.conflictQueueFile, 'utf-8'));
    } catch { return []; }
  }

  // ── Pub/Sub for Episodic Summaries ───────────────────────

  private subscribers: Map<string, (msg: { type: string; data: unknown }) => void> = new Map();
  private server: http.Server | null = null;

  startPubSub(): void {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const agentId = `agent_${Date.now()}`;
        const handler = (msg: { type: string; data: unknown }) => {
          res.write(`data: ${JSON.stringify(msg)}\n\n`);
        };
        this.subscribers.set(agentId, handler);

        req.on('close', () => {
          this.subscribers.delete(agentId);
        });
      } else if (req.method === 'POST' && req.url === '/publish') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const msg = JSON.parse(body);
            for (const handler of this.subscribers.values()) {
              handler(msg);
            }
            res.writeHead(200);
            res.end('ok');
          } catch {
            res.writeHead(400);
            res.end('invalid json');
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(this.pubSubPort);
  }

  stopPubSub(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.subscribers.clear();
    }
  }

  publish(type: string, data: unknown): void {
    const msg = { type, data, timestamp: Date.now() };
    for (const handler of this.subscribers.values()) {
      handler(msg);
    }
  }

  // ── Utility ────────────────────────────────────────────────

  getStats(): { activeLeases: number; pendingConflicts: number; subscriberCount: number } {
    const leases = this.loadLeases().filter(l => l.expiresAt > Date.now());
    return {
      activeLeases: leases.length,
      pendingConflicts: this.getPendingConflicts().length,
      subscriberCount: this.subscribers.size,
    };
  }
}