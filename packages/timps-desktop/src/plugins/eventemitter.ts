export type { EventEmitter as IEventEmitter, Listener } from 'eventemitter3';

export interface EventMap {
  [event: string]: unknown[];
}

export interface EventEmitter {
  on(event: string, fn: Listener): this;
  once(event: string, fn: Listener): this;
  off(event: string, fn?: Listener): this;
  emit(event: string, ...args: unknown[]): this;
}

export type Listener = (...args: unknown[]) => void;

declare module 'eventemitter3' {
  class EventEmitter {
    constructor();
    on(event: string, fn: Listener): this;
    once(event: string, fn: Listener): this;
    off(event: string, fn?: Listener): this;
    emit(event: string, ...args: unknown[]): this;
    addListener(event: string, fn: Listener): this;
    removeListener(event: string, fn?: Listener): this;
    removeAllListeners(event?: string): this;
    listeners(event: string): Listener[];
    listenerCount(event: string): number;
    hasListeners(event: string): boolean;
  }
  export = EventEmitter;
}

export class EventEmitter3 implements EventEmitter {
  private events: Map<string, Listener[]> = new Map();
  private anyEvents: Listener[] = [];

  on(event: string, fn: Listener): this {
    const listeners = this.events.get(event) || [];
    listeners.push(fn);
    this.events.set(event, listeners);
    return this;
  }

  once(event: string, fn: Listener): this {
    const wrapper: Listener = (...args) => {
      fn(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event: string, fn?: Listener): this {
    if (!fn) {
      this.events.delete(event);
      return this;
    }
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(fn);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    const listeners = this.events.get(event);
    if (listeners) {
      for (const fn of listeners) {
        fn(...args);
      }
    }
    for (const fn of this.anyEvents) {
      fn(event, ...args);
    }
    return this;
  }

  addListener(event: string, fn: Listener): this {
    return this.on(event, fn);
  }

  removeListener(event: string, fn?: Listener): this {
    return this.off(event, fn);
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listeners(event: string): Listener[] {
    return this.events.get(event) || [];
  }

  listenerCount(event: string): number {
    return this.listeners(event).length;
  }

  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0;
  }

  onAny(fn: (event: string, ...args: unknown[]) => void): this {
    this.anyEvents.push(fn as Listener);
    return this;
  }

  offAny(fn?: (event: string, ...args: unknown[]) => void): this {
    if (!fn) {
      this.anyEvents = [];
    } else {
      const index = this.anyEvents.indexOf(fn as Listener);
      if (index !== -1) {
        this.anyEvents.splice(index, 1);
      }
    }
    return this;
  }
}

import { EventEmitter3 };
export default EventEmitter3;