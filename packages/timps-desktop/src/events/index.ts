/**
 * TIMPS Desktop - Event Bus
 * Global event system for component communication.
 */

type EventHandler<T = unknown> = (data: T) => void;

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    return () => this.off(event, handler);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  emit<T>(event: string, data: T): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error for ${event}:`, error);
        }
      });
    }
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    const wrapped: EventHandler<T> = (data) => {
      this.off(event, wrapped);
      handler(data);
    };
    return this.on(event, wrapped);
  }

  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  listenerCount(event: string): number {
    const handlers = this.handlers.get(event);
    return handlers ? handlers.size : 0;
  }
}

export const eventBus = new EventBus();

// Named events
export const Events = {
  PROJECT_CHANGED: 'project:changed',
  PROJECT_LOADED: 'project:loaded',
  MEMORY_UPDATED: 'memory:updated',
  MEMORY_ADDED: 'memory:added',
  MEMORY_DELETED: 'memory:deleted',
  TAB_CHANGED: 'tab:changed',
  SETTINGS_CHANGED: 'settings:changed',
  THEME_CHANGED: 'theme:changed',
  PROVIDER_CHANGED: 'provider:changed',
  SERVER_CONNECTED: 'server:connected',
  SERVER_DISCONNECTED: 'server:disconnected',
  SERVER_ERROR: 'server:error',
  QUICK_CAPTURE_OPEN: 'quick-capture:open',
  QUICK_CAPTURE_CLOSE: 'quick-capture:close',
  COMMAND_BAR_OPEN: 'command-bar:open',
  COMMAND_BAR_CLOSE: 'command-bar:close',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_INSTALLED: 'update:installed',
} as const;

// Event emitter hook
export function useEvent<T>(event: string, handler: EventHandler<T>): void {
  import('react').then(({ useEffect }) => {
    useEffect(() => {
      const unlisten = eventBus.on(event, handler);
      return unlisten;
    }, [event, handler]);
  });
}