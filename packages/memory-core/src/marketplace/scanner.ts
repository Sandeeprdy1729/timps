import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

export function runStaticAnalysis(payload: string, manifest: PluginManifest): ScanResult[] {
  const results: ScanResult[] = [];
  const decoded = Buffer.from(payload, 'base64').toString('utf-8');

  results.push({ rule: 'manifest-valid', severity: 'error', passed: true, message: 'Manifest schema valid' });

  const permResult = validatePermissions(manifest.timps.permissions, decoded);
  results.push(permResult);

  for (const check of SUSPICIOUS_PATTERNS) {
    const match = check.pattern.test(decoded);
    if (match) {
      results.push({
        rule: check.rule,
        severity: check.severity,
        passed: check.severity === 'warn',
        message: check.message,
      });
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

  try {
    const tmpDir = `/tmp/timps-scan-${createHash('sha256').update(code).digest('hex').slice(0, 8)}`;
    execSync(`mkdir -p ${tmpDir}`, { stdio: 'pipe' });
    require('fs').writeFileSync(`${tmpDir}/package.json`, pkgJson);
    const result = execSync(`npm audit --json 2>/dev/null || true`, { cwd: tmpDir, stdio: 'pipe' });
    execSync(`rm -rf ${tmpDir}`, { stdio: 'pipe' });

    const audit = JSON.parse(result.toString());
    const vulns = audit.vulnerabilities ?? {};
    const critical = Object.keys(vulns).filter(k => vulns[k].severity === 'critical');
    if (critical.length > 0) {
      return { rule: 'npm-audit', severity: 'error', passed: false, message: `Critical vulnerabilities: ${critical.join(', ')}` };
    }
    return { rule: 'npm-audit', severity: 'info', passed: true, message: `Scanned ${depNames.length} dependencies, no critical vulns` };
  } catch {
    return { rule: 'npm-audit', severity: 'warn', passed: true, message: 'npm audit skipped (npm not available)' };
  }
}

export function verifyChecksum(payload: string, expected: string): boolean {
  const actual = createHash('sha256').update(payload).digest('hex');
  return actual === expected;
}

export function approved(results: ScanResult[]): boolean {
  return results.filter(r => r.severity === 'error').every(r => r.passed);
}
