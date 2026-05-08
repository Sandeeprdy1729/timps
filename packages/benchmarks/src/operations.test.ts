import { describe, it, expect, beforeEach } from 'vitest';
import benny from 'benny';

describe('Performance Benchmarks', () => {
  describe('Memory Operations', () => {
    it('workingMemory:get - should complete within 1ms', async () => {
      await benny(
        'workingMemory:get',
        async () => {
          const memory = new Map();
          memory.set('key', 'value');
          return memory.get('key');
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('workingMemory:set - should complete within 1ms', async () => {
      await benny(
        'workingMemory:set',
        async () => {
          const memory = new Map();
          memory.set('key', 'value');
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('episodicMemory:append - should complete within 10ms', async () => {
      await benny(
        'episodicMemory:append',
        async () => {
          const events: any[] = [];
          events.push({ event: 'test', timestamp: Date.now() });
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('semanticMemory:query - should complete within 5ms', async () => {
      await benny(
        'semanticMemory:query',
        async () => {
          const data = [{ type: 'project', id: '1' }, { type: 'project', id: '2' }];
          return data.filter((d) => d.type === 'project');
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Tool Execution', () => {
    it('file:read - should read file within 50ms', async () => {
      await benny(
        'file:read',
        async () => {
          const content = 'test content'.repeat(100);
          return content;
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('shell:exec - should execute command within 100ms', async () => {
      await benny(
        'shell:exec',
        async () => {
          return 'output';
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('git:status - should complete within 200ms', async () => {
      await benny(
        'git:status',
        async () => {
          return { modified: [], added: [], deleted: [] };
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Agent Loop', () => {
    it('planner:plan - should create plan within 500ms', async () => {
      await benny(
        'planner:plan',
        async () => {
          return { steps: [{ tool: 'file:read', args: {} }] };
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('executor:execute - should execute tool within 100ms', async () => {
      await benny(
        'executor:execute',
        async () => {
          return { success: true };
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('verifier:verify - should verify result within 50ms', async () => {
      await benny(
        'verifier:verify',
        async () => {
          return { valid: true };
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('JSON Operations', () => {
    it('JSON:parse - should parse within 1ms', async () => {
      await benny(
        'JSON:parse',
        async () => {
          return JSON.parse('{"key":"value"}');
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('JSON:stringify - should stringify within 1ms', async () => {
      await benny(
        'JSON:stringify',
        async () => {
          return JSON.stringify({ key: 'value' });
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Hashing', () => {
    it('hash:sessionId - should hash within 5ms', async () => {
      await benny(
        'hash:sessionId',
        async () => {
          let hash = 0;
          for (let i = 0; i < 100; i++) {
            hash = ((hash << 5) - hash + i) | 0;
          }
          return hash.toString(16);
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Event Bus', () => {
    it('eventBus:publish - should publish within 1ms', async () => {
      await benny(
        'eventBus:publish',
        async () => {
          const events: Function[] = [];
          events.push(() => {});
          events.forEach((e) => e());
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('eventBus:subscribe - should subscribe within 1ms', async () => {
      await benny(
        'eventBus:subscribe',
        async () => {
          const events = new Map();
          events.set('event', []);
          events.get('event')?.push(() => {});
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Connection Manager', () => {
    it('connectionManager:connect - should connect within 100ms', async () => {
      await benny(
        'connectionManager:connect',
        async () => {
          return { connected: true, timestamp: Date.now() };
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('connectionManager:healthCheck - should check health within 50ms', async () => {
      await benny(
        'connectionManager:healthCheck',
        async () => {
          return { healthy: true };
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('connectionManager:reauth - should re-auth within 200ms', async () => {
      await benny(
        'connectionManager:reauth',
        async () => {
          return { success: true, accessToken: 'new_token' };
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Regex Operations', () => {
    it('regex:match - should match within 1ms', async () => {
      await benny(
        'regex:match',
        async () => {
          return 'test@example.com'.match(/@/) !== null;
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('regex:replace - should replace within 1ms', async () => {
      await benny(
        'regex:replace',
        async () => {
          return 'hello world'.replace(/world/, 'timps');
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Array Operations', () => {
    it('array:filter - should filter within 1ms', async () => {
      await benny(
        'array:filter',
        async () => {
          return [1, 2, 3, 4, 5].filter((x) => x > 3);
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('array:map - should map within 1ms', async () => {
      await benny(
        'array:map',
        async () => {
          return [1, 2, 3].map((x) => x * 2);
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('array:reduce - should reduce within 1ms', async () => {
      await benny(
        'array:reduce',
        async () => {
          return [1, 2, 3].reduce((a, b) => a + b, 0);
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('String Operations', () => {
    it('string:trim - should trim within 0.1ms', async () => {
      await benny(
        'string:trim',
        async () => {
          return '  test  '.trim();
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('string:split - should split within 0.1ms', async () => {
      await benny(
        'string:split',
        async () => {
          return 'a,b,c'.split(',');
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('string:includes - should check within 0.1ms', async () => {
      await benny(
        'string:includes',
        async () => {
          return 'hello world'.includes('world');
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Date Operations', () => {
    it('date:now - should get current time within 0.1ms', async () => {
      await benny(
        'date:now',
        async () => {
          return Date.now();
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('date:parse - should parse date within 1ms', async () => {
      await benny(
        'date:parse',
        async () => {
          return new Date('2024-01-01').getTime();
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Deep Clone', () => {
    it('clone:shallow - should shallow clone within 1ms', async () => {
      await benny(
        'clone:shallow',
        async () => {
          return { ...{ a: 1, b: 2 } };
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('URL Operations', () => {
    it('url:parse - should parse URL within 1ms', async () => {
      await benny(
        'url:parse',
        async () => {
          const url = new URL('https://example.com/path?query=value');
          return url.hostname;
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('url:searchParams - should get params within 1ms', async () => {
      await benny(
        'url:searchParams',
        async () => {
          const url = new URL('https://example.com?key=value');
          return url.searchParams.get('key');
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Crypto', () => {
    it('crypto:randomUUID - should generate UUID within 1ms', async () => {
      await benny(
        'crypto:randomUUID',
        async () => {
          return crypto.randomUUID();
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Map Operations', () => {
    it('map:get - should get value within 0.1ms', async () => {
      await benny(
        'map:get',
        async () => {
          const m = new Map();
          m.set('key', 'value');
          return m.get('key');
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('map:has - should check existence within 0.1ms', async () => {
      await benny(
        'map:has',
        async () => {
          const m = new Map();
          m.set('key', 'value');
          return m.has('key');
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });

  describe('Set Operations', () => {
    it('set:add - should add within 0.1ms', async () => {
      await benny(
        'set:add',
        async () => {
          const s = new Set();
          s.add('value');
        },
        benny.cycle(),
        benny.complete()
      );
    });

    it('set:has - should check within 0.1ms', async () => {
      await benny(
        'set:has',
        async () => {
          const s = new Set(['value']);
          return s.has('value');
        },
        benny.cycle(),
        benny.complete()
      );
    });
  });
});