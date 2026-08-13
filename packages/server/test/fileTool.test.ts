// @timps/server — M79 regression tests
// Verifies the LLM-driven file_operations tool is sandboxed: default allowlist
// is the server cwd ONLY (never $HOME or /tmp), nothing outside is readable,
// an explicit TIMPS_FILE_BASE_DIRS opt-in widens it, and symlinks cannot escape.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// config/env.ts does `import 'dotenv/config'`. Stub it so tests use process.env only.
vi.mock('dotenv/config', () => ({}));

const originalCwd = process.cwd();
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'timps-m79-'));
const inside = path.join(sandbox, 'data.txt');
const homeDir = os.homedir();

async function freshFileTool() {
  // Re-evaluate the module so ALLOWED_BASE_DIRS reflects the current env/cwd.
  vi.resetModules();
  const mod = await import('../tools/fileTool');
  return new mod.FileTool();
}

describe('file_operations sandbox (M79)', () => {
  beforeEach(() => {
    fs.writeFileSync(inside, 'secret-data');
  });

  afterEach(() => {
    delete process.env.TIMPS_FILE_BASE_DIRS;
    delete process.env.HOME;
    process.chdir(originalCwd);
  });

  it('defaults to cwd-only: denies $HOME even when HOME is set', async () => {
    delete process.env.TIMPS_FILE_BASE_DIRS;
    process.env.HOME = homeDir;
    const tool = await freshFileTool();
    const target = path.join(homeDir, '.ssh', 'id_rsa');
    const result = await tool.execute({ operation: 'read', path: target });
    expect(result).toContain('Path traversal denied');
  });

  it('defaults to cwd-only: denies /tmp (no implicit /tmp allowlist)', async () => {
    delete process.env.TIMPS_FILE_BASE_DIRS;
    delete process.env.HOME;
    const tool = await freshFileTool();
    const target = path.join(os.tmpdir(), 'some-file.txt');
    const result = await tool.execute({ operation: 'read', path: target });
    expect(result).toContain('Path traversal denied');
  });

  it('defaults to cwd-only: can read files inside the cwd', async () => {
    delete process.env.TIMPS_FILE_BASE_DIRS;
    process.chdir(sandbox); // the server cwd is the sandbox
    const tool = await freshFileTool();
    const result = await tool.execute({ operation: 'read', path: inside });
    expect(result).toBe('secret-data');
  });

  it('denies absolute paths outside every allowed base dir', async () => {
    process.env.TIMPS_FILE_BASE_DIRS = sandbox;
    const tool = await freshFileTool();
    const result = await tool.execute({ operation: 'read', path: '/etc/passwd' });
    expect(result).toContain('Path traversal denied');
  });

  it('denies path-traversal (../) escapes', async () => {
    process.env.TIMPS_FILE_BASE_DIRS = sandbox;
    const tool = await freshFileTool();
    const escape = path.join(sandbox, '..', path.basename(homeDir), 'not-allowed');
    const result = await tool.execute({ operation: 'read', path: escape });
    expect(result).toContain('Path traversal denied');
  });

  it('denies writes outside the sandbox and leaves no file behind', async () => {
    process.env.TIMPS_FILE_BASE_DIRS = sandbox;
    const tool = await freshFileTool();
    const target = path.join(os.tmpdir(), 'timps-m79-escape.txt');
    const result = await tool.execute({ operation: 'write', path: target, content: 'pwned' });
    expect(result).toContain('Path traversal denied');
    expect(fs.existsSync(target)).toBe(false);
  });

  it('cannot read through a symlink pointing outside the sandbox', async () => {
    const secretOutside = path.join(os.tmpdir(), `timps-m79-outside-${Date.now()}.txt`);
    fs.writeFileSync(secretOutside, 'outside-secret');
    const link = path.join(sandbox, 'innocent-link.txt');
    try {
      fs.symlinkSync(secretOutside, link);
      process.env.TIMPS_FILE_BASE_DIRS = sandbox;
      const tool = await freshFileTool();
      const result = await tool.execute({ operation: 'read', path: link });
      expect(result).toContain('Path traversal denied');
    } finally {
      try { fs.unlinkSync(link); } catch { /* ignore */ }
      try { fs.unlinkSync(secretOutside); } catch { /* ignore */ }
    }
  });

  it('allows an explicitly opted-in extra base dir', async () => {
    const extra = fs.mkdtempSync(path.join(os.tmpdir(), 'timps-m79-extra-'));
    const file = path.join(extra, 'allowed.txt');
    fs.writeFileSync(file, 'allowed');
    try {
      process.env.TIMPS_FILE_BASE_DIRS = `${sandbox}${path.delimiter}${extra}`;
      const tool = await freshFileTool();
      const result = await tool.execute({ operation: 'read', path: file });
      expect(result).toBe('allowed');
    } finally {
      try { fs.rmSync(extra, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
});
