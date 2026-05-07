/**
 * ACP — Agent Communication Protocol (TypeScript client)
 *
 * Mirrors the Rust AcpBus for the Node.js agent stack.
 * Enables multiple timps-code agents (or integrations like VS Code extension)
 * to exchange messages: tasks, results, memory shares, and broadcasts.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ── Message types ──────────────────────────────────────────────────────────

export type AcpMessageType = 'task' | 'result' | 'memory_share' | 'broadcast' | 'heartbeat';

export interface AcpTaskMessage {
  type: 'task';
  id: string;
  from: string;
  to: string;
  prompt: string;
  context?: string;
}

export interface AcpResultMessage {
  type: 'result';
  task_id: string;
  from: string;
  to: string;
  output: string;
  success: boolean;
}

export interface AcpMemoryShareMessage {
  type: 'memory_share';
  from: string;
  key: string;
  value: string;
  importance: number;
  tags: string[];
}

export interface AcpBroadcastMessage {
  type: 'broadcast';
  from: string;
  content: string;
}

export interface AcpHeartbeatMessage {
  type: 'heartbeat';
  agent_id: string;
  timestamp: string;
}

export type AcpMessage =
  | AcpTaskMessage
  | AcpResultMessage
  | AcpMemoryShareMessage
  | AcpBroadcastMessage
  | AcpHeartbeatMessage;

// ── Helpers ────────────────────────────────────────────────────────────────

export function taskMessage(from: string, to: string, prompt: string, context?: string): AcpTaskMessage {
  return { type: 'task', id: randomUUID(), from, to, prompt, context };
}

export function resultMessage(taskId: string, from: string, to: string, output: string, success: boolean): AcpResultMessage {
  return { type: 'result', task_id: taskId, from, to, output, success };
}

export function heartbeatMessage(agentId: string): AcpHeartbeatMessage {
  return { type: 'heartbeat', agent_id: agentId, timestamp: new Date().toISOString() };
}

// ── ACP Bus ────────────────────────────────────────────────────────────────

/**
 * In-process multi-agent message bus for Node.js.
 *
 * Usage:
 *   const bus = new AcpBus();
 *   bus.onMessage('agent-b', (msg) => console.log(msg));
 *   await bus.send(taskMessage('agent-a', 'agent-b', 'do something'));
 */
export class AcpBus extends EventEmitter {
  private handlers: Map<string, ((msg: AcpMessage) => void | Promise<void>)[]> = new Map();

  /** Register a message handler for a specific agent ID. */
  onMessage(agentId: string, handler: (msg: AcpMessage) => void | Promise<void>): void {
    const list = this.handlers.get(agentId) ?? [];
    list.push(handler);
    this.handlers.set(agentId, list);
  }

  /** Remove all handlers for an agent ID. */
  unregister(agentId: string): void {
    this.handlers.delete(agentId);
  }

  /** Send a direct message to an agent (must be Task or Result). */
  async send(message: AcpTaskMessage | AcpResultMessage): Promise<void> {
    const to = message.to;
    const list = this.handlers.get(to);
    if (!list || list.length === 0) {
      throw new Error(`AcpBus: No handlers registered for agent "${to}"`);
    }
    await Promise.all(list.map((h) => h(message)));
  }

  /** Broadcast a message to all registered agents. */
  async broadcast(message: AcpBroadcastMessage | AcpHeartbeatMessage | AcpMemoryShareMessage): Promise<void> {
    const allHandlers = [...this.handlers.values()].flat();
    await Promise.all(allHandlers.map((h) => h(message)));
    this.emit('broadcast', message);
  }

  /** List all registered agent IDs. */
  agents(): string[] {
    return [...this.handlers.keys()];
  }
}

// ── ACP Swarm ──────────────────────────────────────────────────────────────

/**
 * Orchestrates named agent roles over a shared AcpBus.
 *
 * Usage:
 *   const swarm = new AcpSwarm();
 *   swarm.assignRole('coder', 'coder-instance-1');
 *   await swarm.delegateToRole('planner', 'coder', 'Implement auth module');
 */
export class AcpSwarm {
  public readonly bus: AcpBus;
  private roles: Map<string, string> = new Map();

  constructor(bus?: AcpBus) {
    this.bus = bus ?? new AcpBus();
  }

  /** Register a role → agentId mapping. */
  assignRole(role: string, agentId: string): void {
    this.roles.set(role, agentId);
  }

  /** Delegate a task prompt to a named role. */
  async delegateToRole(fromRole: string, toRole: string, prompt: string, context?: string): Promise<void> {
    const fromId = this.roles.get(fromRole) ?? fromRole;
    const toId = this.roles.get(toRole);
    if (!toId) throw new Error(`AcpSwarm: Role not found: "${toRole}"`);
    await this.bus.send(taskMessage(fromId, toId, prompt, context));
  }

  /** List all roles and their agent IDs. */
  listRoles(): { role: string; agentId: string }[] {
    return [...this.roles.entries()].map(([role, agentId]) => ({ role, agentId }));
  }
}
