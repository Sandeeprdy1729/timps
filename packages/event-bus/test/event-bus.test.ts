import { EventBus } from '../src/index';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('publish / subscribe', () => {
    it('delivers events to subscribers', () => {
      const received: any[] = [];
      bus.subscribe({}, (e) => { received.push(e.payload); });
      const evt = bus.publish('test-source', 'test.event', { hello: 'world' });
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ hello: 'world' });
      expect(evt.id).toMatch(/^evt-/);
      expect(evt.source).toBe('test-source');
      expect(evt.type).toBe('test.event');
    });

    it('filters by event type', () => {
      const received: string[] = [];
      bus.subscribe({ type: 'foo' }, (e) => { received.push(e.type); });
      bus.publish('s', 'foo', {});
      bus.publish('s', 'bar', {});
      expect(received).toEqual(['foo']);
    });

    it('filters by source', () => {
      const received: string[] = [];
      bus.subscribe({ source: 'a' }, (e) => { received.push(e.source); });
      bus.publish('a', 't', {});
      bus.publish('b', 't', {});
      expect(received).toEqual(['a']);
    });

    it('filters by timestamp range', () => {
      const received: string[] = [];
      bus.subscribe({
        fromTimestamp: new Date(Date.now() + 1000).toISOString(),
      }, (e) => { received.push(e.id); });
      bus.publish('s', 't', {});
      expect(received).toHaveLength(0);
    });
  });

  describe('unsubscribe', () => {
    it('stops delivering events after unsubscribe', () => {
      const received: any[] = [];
      const id = bus.subscribe({}, (e) => { received.push(e); });
      bus.publish('s', 't', { n: 1 });
      expect(received).toHaveLength(1);
      bus.unsubscribe(id);
      bus.publish('s', 't', { n: 2 });
      expect(received).toHaveLength(1);
    });

    it('returns false for unknown id', () => {
      expect(bus.unsubscribe('nope')).toBe(false);
    });
  });

  describe('query', () => {
    it('returns published events', () => {
      bus.publish('s', 'a', { x: 1 });
      bus.publish('s', 'b', { x: 2 });
      expect(bus.query({})).toHaveLength(2);
    });

    it('filters by type', () => {
      bus.publish('s', 'a', {});
      bus.publish('s', 'b', {});
      expect(bus.query({ type: 'a' })).toHaveLength(1);
    });

    it('filters by source', () => {
      bus.publish('a', 't', {});
      bus.publish('b', 't', {});
      expect(bus.query({ source: 'a' })).toHaveLength(1);
    });

    it('respects limit', () => {
      for (let i = 0; i < 10; i++) bus.publish('s', 't', { i });
      expect(bus.query({}, 3)).toHaveLength(3);
    });
  });

  describe('clear', () => {
    it('removes all stored events', () => {
      bus.publish('s', 't', {});
      bus.clear();
      expect(bus.query({})).toHaveLength(0);
    });
  });

  describe('getSubscriptions', () => {
    it('returns all active subscriptions', () => {
      bus.subscribe({ type: 'a' }, () => {});
      bus.subscribe({ type: 'b' }, () => {});
      expect(bus.getSubscriptions()).toHaveLength(2);
    });
  });

  describe('singleton', () => {
    it('getInstance returns the same instance', () => {
      const a = EventBus.getInstance();
      const b = EventBus.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('event store size limit', () => {
    it('does not exceed maxStoreSize', () => {
      for (let i = 0; i < 1100; i++) bus.publish('s', 't', { i });
      expect(bus.query({}).length).toBeLessThanOrEqual(1000);
    });
  });
});
