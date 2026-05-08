export type EventType = string;

export interface Event<T = any> {
  id: string;
  type: EventType;
  source: string;
  timestamp: string;
  payload: T;
  metadata?: Record<string, any>;
}

export interface EventFilter {
  type?: EventType;
  source?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
}

export interface EventSubscription {
  id: string;
  filter: EventFilter;
  callback: EventCallback;
  createdAt: string;
}

type EventCallback = (event: Event) => void | Promise<void>;

export class EventBus {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventStore: Event[] = [];
  private maxStoreSize = 1000;
  private idCounter = 0;

  private static instance: EventBus | null = null;

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  subscribe(
    filter: EventFilter,
    callback: EventCallback
  ): string {
    const subscription: EventSubscription = {
      id: `sub-${++this.idCounter}`,
      filter,
      callback,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscription.id, subscription);
    return subscription.id;
  }

  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  publish<T>(source: string, type: EventType, payload: T, metadata?: Record<string, any>): Event<T> {
    const event: Event<T> = {
      id: `evt-${++this.idCounter}`,
      type,
      source,
      timestamp: new Date().toISOString(),
      payload,
      metadata,
    };

    this.storeEvent(event);
    this.deliverEvent(event);

    return event;
  }

  private storeEvent(event: Event): void {
    this.eventStore.push(event);
    
    if (this.eventStore.length > this.maxStoreSize) {
      this.eventStore = this.eventStore.slice(-this.maxStoreSize);
    }
  }

  private deliverEvent(event: Event): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(event, subscription.filter)) {
        try {
          Promise.resolve(subscription.callback(event)).catch(console.error);
        } catch (error) {
          console.error('Event callback error:', error);
        }
      }
    }
  }

  private matchesFilter(event: Event, filter: EventFilter): boolean {
    if (filter.type && event.type !== filter.type) {
      return false;
    }

    if (filter.source && event.source !== filter.source) {
      return false;
    }

    if (filter.fromTimestamp && event.timestamp < filter.fromTimestamp) {
      return false;
    }

    if (filter.toTimestamp && event.timestamp > filter.toTimestamp) {
      return false;
    }

    return true;
  }

  query(filter: EventFilter, limit = 100): Event[] {
    let results = this.eventStore;

    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }

    if (filter.source) {
      results = results.filter(e => e.source === filter.source);
    }

    if (filter.fromTimestamp) {
      results = results.filter(e => e.timestamp >= filter.fromTimestamp!);
    }

    if (filter.toTimestamp) {
      results = results.filter(e => e.timestamp <= filter.toTimestamp!);
    }

    return results.slice(-limit);
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  clear(): void {
    this.eventStore = [];
  }
}

export const eventBus = EventBus.getInstance();