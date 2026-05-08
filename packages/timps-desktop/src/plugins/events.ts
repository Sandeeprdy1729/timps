import { EventHandler, Plugin } from './types';

type EventCallback = (data?: unknown) => void;

interface EventMap {
  [event: string]: Set<EventCallback>;
}

export class PluginEventEmitter {
  private events: EventMap = {};
  private pluginEvents: Map<string, EventMap> = new Map();

  on(event: string, handler: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = new Set();
    }
    this.events[event].add(handler);
  }

  off(event: string, handler?: EventCallback): void {
    if (!handler) {
      delete this.events[event];
      return;
    }
    this.events[event]?.delete(handler);
  }

  emit(event: string, data?: unknown): void {
    const handlers = this.events[event];
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  once(event: string, handler: EventCallback): void {
    const wrapper: EventCallback = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  clear(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  listenerCount(event: string): number {
    return this.events[event]?.size ?? 0;
  }

  eventNames(): string[] {
    return Object.keys(this.events);
  }
}

export class PluginEventBus extends PluginEventEmitter {
  private static instance: PluginEventBus;

  static getInstance(): PluginEventBus {
    if (!PluginEventBus.instance) {
      PluginEventBus.instance = new PluginEventBus();
    }
    return PluginEventBus.instance;
  }

  broadcast(event: string, data?: unknown): void {
    this.emit(event, data);
  }

  subscribe(pluginId: string, event: string, handler: EventCallback): void {
    if (!this.pluginEvents.has(pluginId)) {
      this.pluginEvents.set(pluginId, {});
    }
    const events = this.pluginEvents.get(pluginId)!;
    if (!events[event]) {
      events[event] = new Set();
    }
    events[event].add(handler);
  }

  unsubscribe(pluginId: string, event?: string): void {
    const events = this.pluginEvents.get(pluginId);
    if (!events) return;
    if (event) {
      delete events[event];
    } else {
      this.pluginEvents.delete(pluginId);
    }
  }

  emitToPlugin(pluginId: string, event: string, data?: unknown): void {
    const events = this.pluginEvents.get(pluginId);
    if (!events?.[event]) return;
    events[event].forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error emitting to plugin ${pluginId}:`, error);
      }
    });
  }
}

export const pluginEventBus = PluginEventBus.getInstance();

export class PluginIPC {
  private handlers: Map<string, Set<(data?: unknown) => unknown>> = new Map();
  private pending: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private messageId = 0;

  send(channel: string, data?: unknown): void {
    const event = new CustomEvent(`ipc:${channel}`, { detail: data });
    window.dispatchEvent(event);
  }

  async invoke<T>(channel: string, data?: unknown, timeout = 30000): Promise<T> {
    const id = `${++this.messageId}-${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`IPC timeout: ${channel}`));
      }, timeout);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      const event = new CustomEvent(`ipc:${channel}`, { detail: { id, data } });
      window.dispatchEvent(event);
    });
  }

  on(channel: string, handler: (data?: unknown) => unknown): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);
  }

  off(channel: string, handler?: (data?: unknown) => unknown): void {
    if (!handler) {
      this.handlers.delete(channel);
      return;
    }
    this.handlers.get(channel)?.delete(handler);
  }

  handle(channel: string, handler: (data?: unknown) => unknown): void {
    this.on(channel, handler);
  }

  reply(id: string, data?: unknown, error?: Error): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    if (error) {
      pending.reject(error);
    } else {
      pending.resolve(data!);
    }
    this.pending.delete(id);
  }
}

export const pluginIPC = new PluginIPC();

export class CrossPluginBridge {
  private bridges: Map<string, (data?: unknown) => unknown> = new Map();

  register(source: string, target: string, handler: (data?: unknown) => unknown): void {
    const key = `${source}:${target}`;
    this.bridges.set(key, handler);
  }

  unregister(source: string, target: string): void {
    const key = `${source}:${target}`;
    this.bridges.delete(key);
  }

  async send<T>(source: string, target: string, data?: unknown): Promise<T | undefined> {
    const key = `${source}:${target}`;
    const handler = this.bridges.get(key);
    if (!handler) {
      console.warn(`No bridge from ${source} to ${target}`);
      return undefined;
    }
    return handler(data) as T;
  }

  hasBridge(source: string, target: string): boolean {
    return this.bridges.has(`${source}:${target}`);
  }

  getBridges(source: string): string[] {
    const bridges: string[] = [];
    for (const key of this.bridges.keys()) {
      if (key.startsWith(`${source}:`)) {
        bridges.push(key.split(':')[1]);
      }
    }
    return bridges;
  }
}

export const crossPluginBridge = new CrossPluginBridge();

export default { pluginEventBus, pluginIPC, crossPluginBridge };