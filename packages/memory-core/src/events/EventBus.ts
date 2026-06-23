// ── @timps/memory-core — Redis Pub/Sub Event Bus ──
// Cross-server event propagation for horizontally scaled MemoryServers.
// Any server can publish; all servers receive via Redis Pub/Sub channels.
// The server holding the agent's connection pushes events downstream.

export type EventBusChannel =
  | 'memory:stored'
  | 'memory:recalled'
  | 'insight'
  | 'contradiction'
  | 'forge:decay'
  | 'forge:echo:prediction'
  | 'forge:chronos:weave'
  | 'forge:aether:insight'
  | 'memory:consolidated'
  | 'server:heartbeat';

export interface EventBusMessage {
  channel: EventBusChannel;
  projectHash: string;
  serverId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface EventBusOptions {
  url?: string;
  keyPrefix?: string;
  serverId?: string;
}

export type EventHandler = (message: EventBusMessage) => void;

export class EventBus {
  private pub: any = null;
  private sub: any = null;
  private options: EventBusOptions;
  private ready: Promise<void>;
  private handlers = new Map<EventBusChannel, Set<EventHandler>>();
  private subscribedChannels = new Set<string>();
  private serverId: string;

  constructor(options: EventBusOptions = {}) {
    this.options = { keyPrefix: 'timps:', ...options };
    this.serverId = options.serverId ?? `server_${Date.now()}`;
    this.ready = this._connect();
  }

  private async _connect(): Promise<void> {
    try {
      const Redis: any = require('ioredis');
      const url = this.options.url;
      this.pub = url ? new Redis(url) : new Redis();
      this.sub = url ? new Redis(url) : new Redis();
      this.sub.on('message', (channel: string, message: string) => {
        try {
          const parsed: EventBusMessage = JSON.parse(message);
          if (parsed.serverId === this.serverId) return; // skip own messages
          const handlers = this.handlers.get(parsed.channel as EventBusChannel);
          if (handlers) {
            for (const handler of handlers) {
              try { handler(parsed); } catch { /* handler error */ }
            }
          }
        } catch { /* parse error */ }
      });
    } catch (e) {
      throw new Error(
        `EventBus: failed to connect. Install ioredis:\n  npm install ioredis\n  ${(e as Error).message}`
      );
    }
  }

  private async _assertReady(): Promise<void> {
    await this.ready;
  }

  /** Publish an event to all servers subscribed to this channel. */
  async publish(channel: EventBusChannel, payload: Record<string, unknown>): Promise<void> {
    await this._assertReady();
    const msg: EventBusMessage = {
      channel,
      projectHash: this.options.keyPrefix!,
      serverId: this.serverId,
      timestamp: Date.now(),
      payload,
    };
    await this.pub.publish(`timps:bus:${channel}`, JSON.stringify(msg));
  }

  /** Subscribe to a channel. Duplicate subscriptions are no-ops. */
  async subscribe(channel: EventBusChannel, handler: EventHandler): Promise<void> {
    await this._assertReady();
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);
    if (!this.subscribedChannels.has(channel)) {
      this.subscribedChannels.add(channel);
      await this.sub.subscribe(`timps:bus:${channel}`);
    }
  }

  /** Unsubscribe a handler from a channel. */
  async unsubscribe(channel: EventBusChannel, handler: EventHandler): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(channel);
        this.subscribedChannels.delete(channel);
        await this.sub.unsubscribe(`timps:bus:${channel}`);
      }
    }
  }

  /** Close connections. */
  async close(): Promise<void> {
    if (this.pub) await this.pub.quit();
    if (this.sub) await this.sub.quit();
    this.handlers.clear();
  }
}
