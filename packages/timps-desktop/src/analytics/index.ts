/**
 * TIMPS Desktop - Analytics
 * Track user events and analytics.
 */

type EventCategory = 'memory' | 'chat' | 'ui' | 'system';

interface AnalyticsEvent {
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private maxEvents = 1000;

  track(event: AnalyticsEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    console.debug('Analytics:', event);
  }

  trackMemory(action: string, value?: number): void {
    this.track({ category: 'memory', action, value });
  }

  trackChat(action: string, value?: number): void {
    this.track({ category: 'chat', action, value });
  }

  trackUI(action: string, value?: number): void {
    this.track({ category: 'ui', action, value });
  }

  trackSystem(action: string, value?: number): void {
    this.track({ category: 'system', action, value });
  }

  getEvents(category?: EventCategory): AnalyticsEvent[] {
    if (!category) return this.events;
    return this.events.filter(e => e.category === category);
  }

  export(): string {
    return JSON.stringify(this.events, null, 2);
  }

  clear(): void {
    this.events = [];
  }
}

export const analytics = new Analytics();

export const trackMemories = {
  viewed: () => analytics.trackMemory('viewed'),
  added: () => analytics.trackMemory('added'),
  deleted: () => analytics.trackMemory('deleted'),
  searched: () => analytics.trackMemory('searched'),
};

export const trackChat = {
  started: () => analytics.trackChat('started'),
  messageSent: () => analytics.trackChat('message_sent'),
  error: () => analytics.trackChat('error'),
};

export const trackUI = {
  tabChanged: (tab: string) => analytics.trackUI(`tab_${tab}`),
  modalOpened: (modal: string) => analytics.trackUI(`modal_${modal}`),
  shortcutUsed: (shortcut: string) => analytics.trackUI(`shortcut_${shortcut}`),
};