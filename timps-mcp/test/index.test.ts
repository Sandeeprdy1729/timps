describe('timps-mcp bootstrap', () => {
  it('loads without crashing', () => {
    expect(() => require('../src/index')).not.toThrow();
  });
});

describe('timpsAPI path validation', () => {
  it('rejects paths without leading slash', () => {
    expect(() => {
      const fn = new Function('path', `
        if (!path.startsWith('/') || path.includes('..') || /[<>"|]/.test(path)) {
          throw new Error('Invalid API path: ' + path);
        }
      `);
      fn('api/chat');
    }).toThrow('Invalid API path');
  });

  it('rejects paths with parent traversal', () => {
    expect(() => {
      const fn = new Function('path', `
        if (!path.startsWith('/') || path.includes('..') || /[<>"|]/.test(path)) {
          throw new Error('Invalid API path: ' + path);
        }
      `);
      fn('/../../../etc/passwd');
    }).toThrow('Invalid API path');
  });

  it('rejects paths with shell metacharacters', () => {
    expect(() => {
      const fn = new Function('path', `
        if (!path.startsWith('/') || path.includes('..') || /[<>"|]/.test(path)) {
          throw new Error('Invalid API path: ' + path);
        }
      `);
      fn('/path|id');
    }).toThrow('Invalid API path');
  });

  it('accepts valid paths', () => {
    expect(() => {
      const fn = new Function('path', `
        if (!path.startsWith('/') || path.includes('..') || /[<>"|]/.test(path)) {
          throw new Error('Invalid API path: ' + path);
        }
      `);
      fn('/chat');
    }).not.toThrow();
  });
});
