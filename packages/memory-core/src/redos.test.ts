// ── @timps/memory-core — ReDoS regression tests ──
// Each input is sized so the old regex took seconds (quadratic backtracking,
// CodeQL js/polynomial-redos); the fixed regexes stay well under the budget.
// Temp dirs only.

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ContentCompressor } from './compaction/ContentCompressor.js';
import { runStaticAnalysis } from './marketplace/scanner.js';
import type { PluginManifest } from './marketplace/types.js';
import { ConstitutionalSandbox } from './sandbox/ConstitutionalSandbox.js';
import { MeetingGhost } from './intelligence/meetingGhost.js';

const BUDGET_MS = 1000;

function timed<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'redos-test-'));

describe('ContentCompressor file-path entities', () => {
  const compressor = new ContentCompressor({ preserveFilePaths: true });
  const extract = (s: string): string[] => (compressor as any)._extractEntities(s);

  it('stays linear on long runs of path characters', () => {
    const { ms } = timed(() => extract('-'.repeat(100_000)));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('still extracts file paths', () => {
    const entities = extract('see src/lib/foo.ts and ./bar.json, not a.b.c.d');
    expect(entities).toContain('src/lib/foo.ts');
    expect(entities).toContain('./bar.json');
  });
});

describe('marketplace scanner dependency parsing', () => {
  const manifest: PluginManifest = {
    name: 'redos-probe',
    version: '0.0.0',
    description: '',
    author: '',
    license: 'MIT',
    timps: { version: '1', permissions: [] },
  };
  const scan = (code: string) => runStaticAnalysis(Buffer.from(code).toString('base64'), manifest);

  it('stays linear on repeated "dependencies":{{ prefixes', () => {
    const { result, ms } = timed(() => scan('"dependencies":{{'.repeat(25_000)));
    expect(ms).toBeLessThan(BUDGET_MS);
    expect(result.find(r => r.rule === 'npm-audit')?.message).toBe('No npm dependencies declared');
  });
});

describe('ConstitutionalSandbox code-fence extraction', () => {
  const sandbox = new ConstitutionalSandbox(tmpDir(), {} as never);
  const extract = (prompt: string): string | null => (sandbox as any).extractCode(prompt, 'python');

  it('stays linear on an unclosed fence followed by word characters', () => {
    const { ms } = timed(() => extract('```' + '0'.repeat(200_000)));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('strips a language tag only when a newline follows it', () => {
    expect(extract('```python\nprint(1)\n```')).toBe('print(1)');
    expect(extract('```\necho hi\n```')).toBe('echo hi');
    // Previously "print" was taken as the language tag and dropped.
    expect(extract("```print('hi')```")).toBe("print('hi')");
  });
});

describe('MeetingGhost deadlines', () => {
  it('still finds "due:" deadlines', () => {
    const ghost = new MeetingGhost(tmpDir());
    const { commitments } = ghost.extract('I will ship the release notes, due: friday');
    expect(commitments.some(c => c.deadline === 'friday')).toBe(true);
  });
});
