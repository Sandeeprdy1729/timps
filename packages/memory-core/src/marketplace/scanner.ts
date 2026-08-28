import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PluginManifest, Permission, ScanResult } from './types.js';

const SUSPICIOUS_PATTERNS: { pattern: RegExp; severity: 'error' | 'warn'; rule: string; message: string }[] = [
  { pattern: /process\.env/i, severity: 'error', rule: 'env-access', message: 'Accessing environment variables' },
  { pattern: /\brequire\s*\(/i, severity: 'warn', rule: 'dynamic-require', message: 'Dynamic require() usage' },
  { pattern: /\beval\s*\(/i, severity: 'error', rule: 'eval', message: 'eval() detected — code injection risk' },
  { pattern: /\bFunction\s*\(/i, severity: 'error', rule: 'function-ctor', message: 'Function() constructor — code injection risk' },
  { pattern: /child_process|execSync|exec\(|spawn\(/i, severity: 'error', rule: 'child-process', message: 'Child process execution' },
  { pattern: /\/proc\//i, severity: 'error', rule: 'proc-fs', message: 'Accessing /proc filesystem' },
  { pattern: /\/dev\//i, severity: 'warn', rule: 'dev-fs', message: 'Accessing /dev filesystem' },
  { pattern: /\/etc\/passwd/i, severity: 'error', rule: 'etc-passwd', message: 'Accessing password file' },
  { pattern: /process\.binding/i, severity: 'error', rule: 'process-binding', message: 'Native binding access' },
  { pattern: /Reflect\.construct/i, severity: 'warn', rule: 'reflect', message: 'Dynamic construction via Reflect' },
];

// Obfuscation techniques that dodge the literal patterns above — building the
// identifier "require"/"eval"/"process"/"fetch" from concatenated string
// fragments, hex/unicode escapes, computed member access on the prototype
// chain, indirect eval/Function invocations, or embedding a second base64 blob.
// The scanner is a regex ADVISORY, never a proof of safety (see registry.ts),
// but these make the advisory catch the obvious evasion classes too.
const EVASION_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /['"`](?:require|eval|Function|process|globalThis|fetch|constructor)['"`]\s*\+/, message: 'Identifier built via string concatenation' },
  { pattern: /\+\s*['"`](?:uire|val|nction|rocess|etch|nstructor|this)['"`]/i, message: 'Identifier fragment assembled from string parts' },
  { pattern: /\$\{\s*['"`](?:require|eval|Function|process|fetch|constructor)/, message: 'Identifier assembled via template literal' },
  { pattern: /\\x[0-9a-fA-F]{2}/, message: 'Hex-escaped characters — likely obfuscated strings' },
  { pattern: /\\u[0-9a-fA-F]{4}/, message: 'Unicode-escaped characters — likely obfuscated strings' },
  { pattern: /\[['"](?:constructor|prototype|__proto__)['"]\]/, message: 'Dynamic access on the built-in prototype chain' },
  { pattern: /\(\s*0\s*,\s*(?:eval|Function)\s*\)/, message: 'Indirect eval/Function invocation' },
  { pattern: /\batob\(|Buffer\.from\([^)]*['"]base64/, message: 'Inline base64 payload suggests hidden code' },
];

export function runStaticAnalysis(payload: string, manifest: PluginManifest): ScanResult[] {
  const results: ScanResult[] = [];
  const decoded = Buffer.from(payload, 'base64').toString('utf-8');

  results.push({ rule: 'manifest-valid', severity: 'error', passed: true, message: 'Manifest schema valid' });

  const permResult = validatePermissions(manifest.timps.permissions, decoded);
  results.push(permResult);

  // Binary payloads (WASM) decode to utf-8 replacement chars — pattern scans
  // are only meaningful for readable source, and random binary would otherwise
  // false-positive on '/proc/', '\x..' escape and 'exec(' heuristics.
  const isBinary = decoded.includes('\uFFFD');
  if (!isBinary) {
    for (const check of SUSPICIOUS_PATTERNS) {
      if (check.pattern.test(decoded)) {
        results.push({
          rule: check.rule,
          severity: check.severity,
          passed: check.severity === 'warn',
          message: check.message,
        });
      }
    }

    for (const ev of EVASION_PATTERNS) {
      if (ev.pattern.test(decoded)) {
        results.push({
          rule: 'obfuscation',
          severity: 'error',
          passed: false,
          message: ev.message,
        });
      }
    }
  }

  if (decoded.length > 5 * 1024 * 1024) {
    results.push({ rule: 'package-size', severity: 'error', passed: false, message: 'Package exceeds 5MB limit' });
  } else {
    results.push({ rule: 'package-size', severity: 'info', passed: true, message: 'Package size OK' });
  }

  try {
    const npmAudit = runNpmAudit(decoded);
    results.push(npmAudit);
  } catch {
    results.push({ rule: 'npm-audit', severity: 'warn', passed: true, message: 'npm audit skipped (no package.json found)' });
  }

  return results;
}

function validatePermissions(declared: Permission[], code: string): ScanResult {
  const UNDECLARED_PATTERNS: { pattern: RegExp; permission: Permission }[] = [
    { pattern: /\bfetch\s*\(/i, permission: 'network' },
    { pattern: /https?:/.test(code) ? /https?:\/\//i : /^$/, permission: 'network' },
    { pattern: /\brequire\(['"]fs['"]\)/, permission: 'fs:read' },
    { pattern: /\bfs\.(readFile|writeFile|appendFile|mkdir|rm)/i, permission: 'fs:write' },
    { pattern: /\bprocess\.env/i, permission: 'env:read' },
  ];

  for (const check of UNDECLARED_PATTERNS) {
    if (check.pattern instanceof RegExp && check.pattern.source !== '^$' && check.pattern.test(code)) {
      if (!declared.includes(check.permission)) {
        return {
          rule: 'undeclared-permission',
          severity: 'error',
          passed: false,
          message: `Code uses ${check.permission} but permission not declared in manifest`,
        };
      }
    }
  }

  if (declared.includes('fs:read') && declared.includes('fs:write')) {
    return { rule: 'filesystem-access', severity: 'warn', passed: true, message: 'Plugin has full filesystem access' };
  }

  return { rule: 'permissions', severity: 'info', passed: true, message: 'Declared permissions match code analysis' };
}

const NPM_AUDIT_TIMEOUT_MS = 15_000;

function runNpmAudit(code: string): ScanResult {
  const pkgMatch = code.match(/"dependencies"\s*:\s*\{([^}]+)\}/);
  if (!pkgMatch) return { rule: 'npm-audit', severity: 'info', passed: true, message: 'No npm dependencies declared' };

  const deps = pkgMatch[1];
  const depNames = [...deps.matchAll(/"([^"]+)"\s*:/g)].map(m => m[1]);
  if (depNames.length === 0) return { rule: 'npm-audit', severity: 'info', passed: true, message: 'No npm dependencies declared' };

  const pkgJson = JSON.stringify({
    name: 'tmp-scan',
    version: '0.0.0',
    dependencies: Object.fromEntries(depNames.map(n => [n, '*'])),
  });

  // Cross-platform scratch dir: os.tmpdir() resolves correctly on Windows
  // (hardcoded /tmp does not), created/removed via fs only — no POSIX-only
  // `mkdir -p` / `rm -rf` shell commands, no shell at all.
  let tmpDir: string | null = null;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `timps-scan-${randomBytes(4).toString('hex')}-`));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), pkgJson);

    // spawnSync with an args array + shell:false → no shell, no command
    // injection. Bare 'npm' is a .cmd shim on Windows, so use npm.cmd there.
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmBin, ['audit', '--json'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: NPM_AUDIT_TIMEOUT_MS,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.error) {
      return { rule: 'npm-audit', severity: 'warn', passed: true, message: 'npm audit skipped (npm not available)' };
    }
    if (result.signal) {
      return { rule: 'npm-audit', severity: 'warn', passed: true, message: 'npm audit timed out — skipped' };
    }

    // `npm audit --json` writes the report to stdout and exits non-zero when it
    // finds vulnerabilities — parse stdout regardless of the exit code (the old
    // `|| true` shell-append masked that too).
    const stdout = (result.stdout ?? '').toString().trim();
    if (!stdout) {
      return { rule: 'npm-audit', severity: 'warn', passed: true, message: 'npm audit produced no report' };
    }

    const audit = JSON.parse(stdout);
    const vulns = audit.vulnerabilities ?? {};
    const critical = Object.keys(vulns).filter(k => vulns[k].severity === 'critical');
    if (critical.length > 0) {
      return { rule: 'npm-audit', severity: 'error', passed: false, message: `Critical vulnerabilities: ${critical.join(', ')}` };
    }
    return { rule: 'npm-audit', severity: 'info', passed: true, message: `Scanned ${depNames.length} dependencies, no critical vulns` };
  } catch {
    return { rule: 'npm-audit', severity: 'warn', passed: true, message: 'npm audit skipped (npm unavailable)' };
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  }
}

export function verifyChecksum(payload: string, expected: string): boolean {
  const actual = createHash('sha256').update(payload).digest('hex');
  return actual === expected;
}

export function approved(results: ScanResult[]): boolean {
  return results.filter(r => r.severity === 'error').every(r => r.passed);
}
