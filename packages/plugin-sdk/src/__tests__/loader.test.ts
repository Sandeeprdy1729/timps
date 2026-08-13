import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPlugin } from '../loader.js';

function writeFixture(dir: string, name: string, body: string): string {
  const file = join(dir, name);
  writeFileSync(file, body, 'utf-8');
  return file;
}

describe('loadPlugin permission enforcement', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'timps-plugin-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads a benign plugin with no privileged usage', async () => {
    const file = writeFixture(
      dir,
      'benign.js',
      `module.exports = {
        manifest: { name: 'benign', version: '1.0.0', description: 'ok' },
        commands: { async ping(args) { return args.join(' '); } },
      };`,
    );
    const plugin = await loadPlugin(file);
    expect(plugin.manifest.name).toBe('benign');
  });

  it('loads a plugin that declares the permissions its source uses', async () => {
    const file = writeFixture(
      dir,
      'declared.js',
      `const { execFileSync } = require('child_process');
       module.exports = {
         manifest: {
           name: 'declared',
           version: '1.0.0',
           description: 'ok',
           timps: { permissions: ['process:spawn'] },
         },
         commands: {
           async run(args) {
             return execFileSync('echo', args, { encoding: 'utf-8' }).trim();
           },
         },
       };`,
    );
    const plugin = await loadPlugin(file);
    expect(plugin.manifest.name).toBe('declared');
    expect(plugin.manifest.timps?.permissions).toEqual(['process:spawn']);
  });

  it('rejects a plugin using child_process without declaring process:spawn', async () => {
    const file = writeFixture(
      dir,
      'undeclared.js',
      `const { execSync } = require('child_process');
       module.exports = {
         manifest: { name: 'undeclared', version: '1.0.0', description: 'dangerous' },
         commands: {
           async run(args) {
             return execSync('ls', { encoding: 'utf-8' }).trim();
           },
         },
       };`,
    );
    await expect(loadPlugin(file)).rejects.toThrow(/process:spawn/);
  });

  it('rejects a plugin declaring permissions: [] that reads fs', async () => {
    const file = writeFixture(
      dir,
      'empty-perms.js',
      `const fs = require('fs');
       module.exports = {
         manifest: {
           name: 'empty-perms',
           version: '1.0.0',
           description: 'claims nothing',
           timps: { permissions: [] },
         },
         commands: {
           async read(args) {
             return fs.readFileSync('/etc/hostname', 'utf-8').trim();
           },
         },
       };`,
    );
    await expect(loadPlugin(file)).rejects.toThrow(/fs:read/);
  });

  it('rejects a plugin using process.env without declaring env:read', async () => {
    const file = writeFixture(
      dir,
      'env-exfil.js',
      `module.exports = {
         manifest: { name: 'env-exfil', version: '1.0.0', description: 'exfil' },
         commands: {
           async leak(args) {
             return process.env.SSH_AUTH_SOCK;
           },
         },
       };`,
    );
    await expect(loadPlugin(file)).rejects.toThrow(/env:read/);
  });

  it('rejects a plugin using eval even with broad permissions', async () => {
    const file = writeFixture(
      dir,
      'eval-plugin.js',
      `module.exports = {
         manifest: {
           name: 'eval-plugin',
           version: '1.0.0',
           description: 'evals',
           timps: { permissions: ['process:spawn', 'fs:read', 'fs:write', 'network', 'env:read', 'memory:read', 'memory:write'] },
         },
         commands: {
           async run(args) {
             return eval(atob('bGVuZ3Ro'));
           },
         },
       };`,
    );
    await expect(loadPlugin(file)).rejects.toThrow(/eval|verif/i);
  });

  it('skips enforcement when enforcePermissions is false', async () => {
    const file = writeFixture(
      dir,
      'skip-enforce.js',
      `const { execSync } = require('child_process');
       module.exports = {
         manifest: { name: 'skip-enforce', version: '1.0.0', description: 'x' },
         commands: { async run() { return execSync('ls').trim(); } },
       };`,
    );
    const plugin = await loadPlugin(file, { enforcePermissions: false });
    expect(plugin.manifest.name).toBe('skip-enforce');
  });
});
