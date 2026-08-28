// ── @timps/memory-core — ProjectRoom: collaborative agent room ──
// Tracks which agents are connected to a project.
// Manages project-scoped Redis Pub/Sub subscription for cross-server events.

import type { MemoryEngine } from '../MemoryEngine.js';
import type { EventBus, EventBusMessage } from '../events/EventBus.js';

export interface ProjectRoomOptions {
  projectId: string;
  engine: MemoryEngine;
  eventBus?: EventBus | null;
}

export interface ProjectRoomEvent {
  type: 'agent_joined' | 'agent_left' | 'memory_stored' | 'conflict_detected' | 'conflict_resolved';
  projectId: string;
  agentId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export class ProjectRoom {
  readonly projectId: string;
  private engine: MemoryEngine;
  private eventBus: EventBus | null;
  private agents = new Set<string>();
  private agentStreams = new Map<string, { send: (msg: any) => boolean }[]>();
  private destroyed = false;
  private _unsubFromBus: (() => void) | null = null;

  constructor(options: ProjectRoomOptions) {
    this.projectId = options.projectId;
    this.engine = options.engine;
    this.eventBus = options.eventBus ?? null;

    // Subscribe to project-scoped Redis channel for cross-server events
    if (this.eventBus) {
      const channel = `room:${this.projectId}:events`;
      this.eventBus.subscribeRaw(channel, (msg: EventBusMessage) => {
        this.handleEventBusMessage(msg);
      }).then((unsub: any) => {
        this._unsubFromBus = typeof unsub === 'function' ? unsub : null;
      }).catch(() => {});
    }
  }

  get agentCount(): number {
    return this.agents.size;
  }

  get connectedAgentIds(): string[] {
    return Array.from(this.agents);
  }

  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  join(agentId: string, stream: { send: (msg: any) => boolean }): void {
    if (this.destroyed) return;
    this.agents.add(agentId);
    if (!this.agentStreams.has(agentId)) {
      this.agentStreams.set(agentId, []);
    }
    this.agentStreams.get(agentId)!.push(stream);

    this.publishToRoom({
      type: 'agent_joined',
      projectId: this.projectId,
      agentId,
      timestamp: Date.now(),
    });
  }

  leave(agentId: string, stream?: { send: (msg: any) => boolean }): void {
    if (stream && this.agentStreams.has(agentId)) {
      const streams = this.agentStreams.get(agentId)!;
      const idx = streams.indexOf(stream);
      if (idx >= 0) streams.splice(idx, 1);
      if (streams.length === 0) {
        this.agentStreams.delete(agentId);
        this.agents.delete(agentId);
      }
    } else {
      this.agentStreams.delete(agentId);
      this.agents.delete(agentId);
    }

    this.publishToRoom({
      type: 'agent_left',
      projectId: this.projectId,
      agentId,
      timestamp: Date.now(),
    });
  }

  broadcast(event: ProjectRoomEvent): void {
    for (const streams of this.agentStreams.values()) {
      for (const stream of streams) {
        try {
          stream.send({
            agent_event: null,
            memory_insight: null,
            project_event: event,
            error: null,
          });
        } catch { /* ignore stream write error */ }
      }
    }
  }

  private publishToRoom(event: ProjectRoomEvent): void {
    if (this.eventBus) {
      void this.eventBus.publishRaw(`room:${this.projectId}:events`, event as any);
    }
  }

  handleEventBusMessage(msg: EventBusMessage): void {
    if (this.destroyed) return;
    const event = msg.payload as unknown as ProjectRoomEvent;
    if (event) {
      this.broadcast(event);
    }
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  destroy(): void {
    this.destroyed = true;
    if (this._unsubFromBus) {
      this._unsubFromBus();
      this._unsubFromBus = null;
    }
    this.agents.clear();
    this.agentStreams.clear();
  }
}
