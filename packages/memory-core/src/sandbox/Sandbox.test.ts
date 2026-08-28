// ── @timps/memory-core — Sandbox tests ──

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SubprocessSandbox, PythonSandbox, NodeSandbox, BashSandbox, SandboxRouter } from './Sandbox.js';

function makeDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'timps-sbx-test-'));
}

describe('SubprocessSandbox', () => {
  it('runs a simple command and captures stdout', async () => {
    const sbx = new SubprocessSandbox({ runtime: 'bash', workspaceDir: makeDir() });
    const r = await sbx.exec('echo', ['hello']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('hello');
    await sbx.destroy();
  });

  it('kills the child after timeoutMs', async () => {
    const sbx = new SubprocessSandbox({ runtime: 'bash', workspaceDir: makeDir(), timeoutMs: 500 });
    const r = await sbx.exec('sleep', ['5']);
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).not.toBe(0);
    await sbx.destroy();
  });

  it('scopes writes to the workspace', async () => {
    const dir = makeDir();
    const sbx = new SubprocessSandbox({ runtime: 'bash', workspaceDir: dir });
    await sbx.writeFile('hello.txt', 'world');
    expect(fs.readFileSync(path.join(dir, 'hello.txt'), 'utf-8')).toBe('world');
    await sbx.destroy();
  });

  it('refuses paths that escape the workspace', async () => {
    const sbx = new SubprocessSandbox({ runtime: 'bash', workspaceDir: makeDir() });
    await expect(sbx.writeFile('/etc/passwd', 'pwned')).rejects.toThrow(/escapes/);
    await sbx.destroy();
  });

  it('cleans up the workspace on destroy', async () => {
    const dir = makeDir();
    const sbx = new SubprocessSandbox({ runtime: 'bash', workspaceDir: dir });
    await sbx.writeFile('test.txt', 'data');
    await sbx.destroy();
    expect(fs.existsSync(dir)).toBe(false);
  });
});

describe('PythonSandbox', () => {
  it('runs Python code', async () => {
    const sbx = new PythonSandbox({ runtime: 'python', workspaceDir: makeDir() });
    const r = await sbx.exec('print(2 + 2)');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('4');
    await sbx.destroy();
  });

  it('blocks network access at the language level', async () => {
    const sbx = new PythonSandbox({ runtime: 'python', workspaceDir: makeDir(), network: 'none' });
    const r = await sbx.exec(`
import urllib.request
try:
    urllib.request.urlopen('https://example.com', timeout=2)
    print('NETWORK: reachable')
except Exception as e:
    print(f'NETWORK: blocked ({type(e).__name__})')
`);
    expect(r.stdout).toContain('NETWORK: blocked');
    expect(r.stdout).toContain('PermissionError');
    await sbx.destroy();
  });
});

describe('NodeSandbox', () => {
  it('runs JavaScript', async () => {
    const sbx = new NodeSandbox({ runtime: 'node', workspaceDir: makeDir() });
    const r = await sbx.exec('console.log(2 + 2)');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('4');
    await sbx.destroy();
  });

  it('blocks network modules at the language level', async () => {
    const sbx = new NodeSandbox({ runtime: 'node', workspaceDir: makeDir(), network: 'none' });
    const r = await sbx.exec(`
try {
  const http = require('http');
  console.log('NETWORK: reachable');
} catch (e) {
  console.log('NETWORK: blocked (' + e.message.slice(0, 60) + ')');
}`);
    expect(r.stdout).toContain('NETWORK: blocked');
    expect(r.stdout).toContain('TIMPS Constitution');
    await sbx.destroy();
  });
});

describe('BashSandbox', () => {
  it('runs shell code', async () => {
    const sbx = new BashSandbox({ runtime: 'bash', workspaceDir: makeDir() });
    const r = await sbx.exec('echo "hello from bash"');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('hello from bash');
    await sbx.destroy();
  });
});

describe('SandboxRouter', () => {
  it('detects Python from a code fence', () => {
    expect(SandboxRouter.detect('print("hi")', 'script.py')).toBe('python');
    expect(SandboxRouter.detect('print("hi")', 'foo.py')).toBe('python');
  });

  it('detects Node from a code fence', () => {
    expect(SandboxRouter.detect('console.log("hi")', 'script.js')).toBe('node');
    expect(SandboxRouter.detect('console.log("hi")', 'foo.ts')).toBe('node');
  });

  it('detects Bash from shebang', () => {
    expect(SandboxRouter.detect('#!/bin/bash\necho hi', 'script.sh')).toBe('bash');
  });

  it('sniffs Python from content', () => {
    expect(SandboxRouter.detect('import os\ndef foo():\n    return 1')).toBe('python');
  });

  it('sniffs Node from content', () => {
    expect(SandboxRouter.detect('const x = require("fs");\nmodule.exports = x;')).toBe('node');
  });

  it('creates the right backend for each runtime', () => {
    expect(SandboxRouter.create({ runtime: 'python' } as any)).toBeInstanceOf(PythonSandbox);
    expect(SandboxRouter.create({ runtime: 'node' } as any)).toBeInstanceOf(NodeSandbox);
    expect(SandboxRouter.create({ runtime: 'bash' } as any)).toBeInstanceOf(BashSandbox);
  });
});
