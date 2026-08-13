import { describe, it, expect } from 'vitest';
import {
  scanForPermissions,
  assertDeclaredPermissions,
  invalidPermissions,
  deriveToolRisk,
  VALID_PERMISSIONS,
} from '../permissions.js';
import type { Permission, Plugin } from '../types.js';

function makePlugin(name: string, permissions?: Permission[]): Plugin {
  return {
    manifest: {
      name,
      version: '0.1.0',
      description: `Test plugin: ${name}`,
      ...(permissions ? { timps: { permissions } } : {}),
    },
  };
}

describe('scanForPermissions', () => {
  it('detects child_process usage as process:spawn', () => {
    const source = `
      import { execSync } from 'child_process';
      export function run() { return execSync('ls'); }
    `;
    const scan = scanForPermissions(source);
    expect(scan.required.has('process:spawn')).toBe(true);
    expect(scan.unverifiable).toBe(false);
  });

  it('detects require("child_process") as process:spawn', () => {
    const scan = scanForPermissions(`const cp = require('child_process'); cp.exec('id');`);
    expect(scan.required.has('process:spawn')).toBe(true);
  });

  it('detects fs read usage as fs:read', () => {
    const scan = scanForPermissions(`const fs = require('fs'); fs.readFileSync('/etc/passwd');`);
    expect(scan.required.has('fs:read')).toBe(true);
  });

  it('detects fs write usage as fs:write', () => {
    const scan = scanForPermissions(`const fs = require('fs'); fs.writeFileSync('/tmp/x', 'y');`);
    expect(scan.required.has('fs:write')).toBe(true);
  });

  it('detects process.env as env:read', () => {
    const scan = scanForPermissions(`const token = process.env.OPENAI_API_KEY;`);
    expect(scan.required.has('env:read')).toBe(true);
  });

  it('detects fetch and http imports as network', () => {
    const scan = scanForPermissions(`
      import http from 'http';
      const res = await fetch('https://evil.example');
    `);
    expect(scan.required.has('network')).toBe(true);
  });

  it('flags eval() as unverifiable', () => {
    const scan = scanForPermissions(`eval(atob('Y29uc29sZS5sb2coMSk='));`);
    expect(scan.unverifiable).toBe(true);
  });

  it('flags new Function() as unverifiable', () => {
    const scan = scanForPermissions(`const f = new Function('return process');`);
    expect(scan.unverifiable).toBe(true);
  });

  it('returns empty for benign source', () => {
    const scan = scanForPermissions(`const s = 'hello'; export const x = s.length;`);
    expect(scan.required.size).toBe(0);
    expect(scan.unverifiable).toBe(false);
  });
});

describe('assertDeclaredPermissions', () => {
  it('allows declared permissions matching source usage', () => {
    const plugin = makePlugin('ok', ['process:spawn']);
    const source = `import { execSync } from 'child_process';`;
    expect(() => assertDeclaredPermissions(plugin, source)).not.toThrow();
  });

  it('throws when source uses child_process but nothing is declared', () => {
    const plugin = makePlugin('bad');
    const source = `import { execSync } from 'child_process';`;
    expect(() => assertDeclaredPermissions(plugin, source)).toThrow(/process:spawn/);
  });

  it('throws listing all missing permissions', () => {
    const plugin = makePlugin('bad2', ['memory:read']);
    const source = `const fs = require('fs'); fs.writeFileSync('/x','y');`;
    expect(() => assertDeclaredPermissions(plugin, source)).toThrow(/fs:write/);
    expect(() => assertDeclaredPermissions(plugin, source)).toThrow(/fs:read/);
  });

  it('throws on eval() and refuses to load', () => {
    const plugin = makePlugin('evil', ['process:spawn']);
    const source = `eval(atob('cA=='))`;
    expect(() => assertDeclaredPermissions(plugin, source)).toThrow(/eval|verif/i);
  });

  it('respects allowUnverifiable option', () => {
    const plugin = makePlugin('evil2', []);
    const source = `const f = new Function('x', 'return x');`;
    expect(() => assertDeclaredPermissions(plugin, source, { allowUnverifiable: true })).not.toThrow();
  });
});

describe('invalidPermissions', () => {
  it('returns empty for known permissions', () => {
    expect(invalidPermissions([...VALID_PERMISSIONS])).toHaveLength(0);
  });

  it('flags unknown permission strings', () => {
    expect(invalidPermissions(['fs:write', 'root', 'process:spawn'] as any)).toEqual(['root']);
  });
});

describe('deriveToolRisk', () => {
  it('maps process:spawn to high', () => {
    expect(deriveToolRisk(['process:spawn'])).toBe('high');
  });

  it('maps network to high', () => {
    expect(deriveToolRisk(['network'])).toBe('high');
  });

  it('maps fs:write to high', () => {
    expect(deriveToolRisk(['fs:write'])).toBe('high');
  });

  it('maps fs:read / env:read to medium', () => {
    expect(deriveToolRisk(['fs:read'])).toBe('medium');
    expect(deriveToolRisk(['env:read'])).toBe('medium');
  });

  it('maps memory-only to low', () => {
    expect(deriveToolRisk(['memory:read', 'memory:write'])).toBe('low');
  });

  it('maps empty / undefined to low', () => {
    expect(deriveToolRisk([])).toBe('low');
    expect(deriveToolRisk(undefined)).toBe('low');
  });
});
