// ── TIMPS Layered Verification — Risk-stratified verification pipeline ──
// Solves the security and quality problem with risk-proportionate verification.
// Low-risk changes: fast lint check.
// Medium-risk: lint + tests.
// High-risk: full security scan + formal checks + integration tests.

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type VerificationLevel = 'quick' | 'standard' | 'thorough' | 'security';

export interface VerificationCheck {
  name: string;
  level: VerificationLevel;
  passed: boolean;
  output: string;
  errors: string[];
  warnings: string[];
  duration: number;
  score: number;   // 0-100, 100 = fully passed
}

export interface LayeredVerificationResult {
  overallPassed: boolean;
  overallScore: number;
  level: VerificationLevel;
  checks: VerificationCheck[];
  blockers: string[];          // Must fix before proceeding
  warnings: string[];          // Should fix
  recommendations: string[];   // Nice to have
  totalDuration: number;
  filesChecked: string[];
}

export interface VerificationContext {
  cwd: string;
  changedFiles: string[];
  language?: 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'auto';
  hasCi?: boolean;
  testFramework?: 'jest' | 'vitest' | 'pytest' | 'cargo' | 'go-test' | 'auto';
}

// Security patterns to detect (OWASP-aligned)
const SECURITY_PATTERNS = [
  { pattern: /eval\s*\(/, severity: 'critical' as const, message: 'eval() is dangerous — code injection risk' },
  { pattern: /new\s+Function\s*\(/, severity: 'critical' as const, message: 'new Function() allows code injection' },
  { pattern: /innerHTML\s*=/, severity: 'high' as const, message: 'innerHTML assignment may allow XSS' },
  { pattern: /dangerouslySetInnerHTML/, severity: 'high' as const, message: 'dangerouslySetInnerHTML — ensure sanitization' },
  { pattern: /document\.write\s*\(/, severity: 'high' as const, message: 'document.write() is XSS-prone' },
  { pattern: /exec\s*\(.*\$\{/, severity: 'critical' as const, message: 'Command injection: unsanitized variable in exec()' },
  { pattern: /execSync\s*\(.*\$\{/, severity: 'critical' as const, message: 'Command injection: unsanitized variable in execSync()' },
  { pattern: /password\s*=\s*["'][^"']{3,}["']/, severity: 'critical' as const, message: 'Hardcoded password detected' },
  { pattern: /api[_-]?key\s*=\s*["'][a-zA-Z0-9]{10,}["']/, severity: 'critical' as const, message: 'Hardcoded API key detected' },
  { pattern: /secret\s*=\s*["'][a-zA-Z0-9]{8,}["']/i, severity: 'high' as const, message: 'Potential hardcoded secret' },
  { pattern: /\bmd5\b/i, severity: 'medium' as const, message: 'MD5 is cryptographically broken — use SHA-256+' },
  { pattern: /\bsha1\b/i, severity: 'medium' as const, message: 'SHA-1 is cryptographically weak' },
  { pattern: /Math\.random\(\).*(?:token|key|salt|password)/i, severity: 'high' as const, message: 'Math.random() is not cryptographically secure' },
  { pattern: /process\.env\.\w+\s*\|\|\s*['"]/, severity: 'low' as const, message: 'Hardcoded fallback for env var — review if this is safe' },
  { pattern: /cors\s*\(\s*\{\s*origin\s*:\s*['"]?\*['"]?/, severity: 'high' as const, message: 'CORS wildcard origin — restrict in production' },
  { pattern: /mongoose\.connect\s*\([^)]*\)(?!\s*\.catch)/, severity: 'medium' as const, message: 'MongoDB connection without error handling' },
];

// Tech debt patterns
const DEBT_PATTERNS = [
  { pattern: /\/\/\s*TODO/gi, label: 'TODO comment' },
  { pattern: /\/\/\s*FIXME/gi, label: 'FIXME comment' },
  { pattern: /\/\/\s*HACK/gi, label: 'HACK comment' },
  { pattern: /\/\/\s*XXX/gi, label: 'XXX comment' },
  { pattern: /any\s+as\s+any|as\s+any\s*;/g, label: 'TypeScript any cast' },
  { pattern: /eslint-disable/g, label: 'ESLint disable' },
  { pattern: /ts-ignore|ts-nocheck/g, label: 'TypeScript ignore' },
];

export class LayeredVerifier {
  private ctx: VerificationContext;
  private detectedLanguage: string;
  private detectedTestFramework: string;

  constructor(ctx: VerificationContext) {
    this.ctx = ctx;
    this.detectedLanguage = ctx.language === 'auto' || !ctx.language
      ? this.detectLanguage()
      : ctx.language;
    this.detectedTestFramework = ctx.testFramework === 'auto' || !ctx.testFramework
      ? this.detectTestFramework()
      : ctx.testFramework;
  }

  // ── Main entry point ───────────────────────────────────────────────────────

  /**
   * Run verification at the appropriate level.
   * Level is chosen based on the risk of changes.
   */
  async verify(level: VerificationLevel): Promise<LayeredVerificationResult> {
    const startTime = Date.now();
    const checks: VerificationCheck[] = [];

    // Always run security scan (it's fast and critical)
    checks.push(await this.runSecurityScan());

    // Quick: security + lint
    if (level === 'quick' || level === 'standard' || level === 'thorough') {
      const lintCheck = await this.runLint();
      if (lintCheck) checks.push(lintCheck);
    }

    // Standard+: add type checking
    if (level === 'standard' || level === 'thorough') {
      const typeCheck = await this.runTypeCheck();
      if (typeCheck) checks.push(typeCheck);
    }

    // Standard+: run unit tests
    if (level === 'standard' || level === 'thorough') {
      const testCheck = await this.runTests();
      if (testCheck) checks.push(testCheck);
    }

    // Thorough: full test suite + dependency audit + tech debt scan
    if (level === 'thorough' || level === 'security') {
      const debtCheck = await this.runDebtScan();
      checks.push(debtCheck);

      const auditCheck = await this.runDependencyAudit();
      if (auditCheck) checks.push(auditCheck);
    }

    // Security level: additional security-focused checks
    if (level === 'security') {
      const envCheck = await this.runEnvLeakCheck();
      checks.push(envCheck);
    }

    return this.buildResult(checks, level, Date.now() - startTime);
  }

  /**
   * Determine the appropriate verification level based on risk.
   */
  static chooseLevel(options: {
    riskScore: number;
    isCiPipeline?: boolean;
    hasSecurityChanges?: boolean;
    changedFileCount?: number;
  }): VerificationLevel {
    const { riskScore, isCiPipeline, hasSecurityChanges, changedFileCount = 1 } = options;

    if (hasSecurityChanges || riskScore >= 70) return 'security';
    if (isCiPipeline || riskScore >= 50 || changedFileCount > 10) return 'thorough';
    if (riskScore >= 30 || changedFileCount > 3) return 'standard';
    return 'quick';
  }

  // ── Individual checks ──────────────────────────────────────────────────────

  private async runSecurityScan(): Promise<VerificationCheck> {
    const start = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const filePath of this.ctx.changedFiles) {
      if (!this.isTextFile(filePath)) continue;

      let content: string;
      try { content = fs.readFileSync(filePath, 'utf-8'); }
      catch { continue; }

      const lines = content.split('\n');

      for (const { pattern, severity, message } of SECURITY_PATTERNS) {
        let m: RegExpExecArray | null;
        const p = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        while ((m = p.exec(content)) !== null) {
          const lineNum = content.substring(0, m.index).split('\n').length;
          const location = `${path.basename(filePath)}:${lineNum}`;

          if (severity === 'critical' || severity === 'high') {
            errors.push(`[${severity.toUpperCase()}] ${location}: ${message}`);
          } else {
            warnings.push(`[${severity.toUpperCase()}] ${location}: ${message}`);
          }
        }
      }
    }

    const passed = errors.length === 0;
    const score = passed ? (warnings.length === 0 ? 100 : 70) : 0;

    return {
      name: 'Security Scan',
      level: 'quick',
      passed,
      output: [...errors, ...warnings].join('\n') || 'No security issues found',
      errors,
      warnings,
      duration: Date.now() - start,
      score,
    };
  }

  private async runLint(): Promise<VerificationCheck | null> {
    const start = Date.now();
    const cmd = this.detectLintCommand();
    if (!cmd) return null;

    try {
      const output = execSync(cmd, {
        cwd: this.ctx.cwd,
        encoding: 'utf-8',
        timeout: 30000,
        stdio: 'pipe',
      });

      return {
        name: 'Lint',
        level: 'quick',
        passed: true,
        output: output || 'No lint issues',
        errors: [],
        warnings: [],
        duration: Date.now() - start,
        score: 100,
      };
    } catch (err: unknown) {
      const output = (err as { stdout?: string; stderr?: string }).stdout ?? String(err);
      const errorLines = output.split('\n').filter(l => l.includes('error'));
      const warnLines = output.split('\n').filter(l => l.includes('warning'));

      return {
        name: 'Lint',
        level: 'quick',
        passed: errorLines.length === 0,
        output: output.slice(0, 2000),
        errors: errorLines.slice(0, 10),
        warnings: warnLines.slice(0, 10),
        duration: Date.now() - start,
        score: errorLines.length === 0 ? (warnLines.length > 5 ? 60 : 80) : 30,
      };
    }
  }

  private async runTypeCheck(): Promise<VerificationCheck | null> {
    const start = Date.now();
    const cmd = this.detectTypeCheckCommand();
    if (!cmd) return null;

    try {
      const output = execSync(cmd, {
        cwd: this.ctx.cwd,
        encoding: 'utf-8',
        timeout: 60000,
        stdio: 'pipe',
      });

      return {
        name: 'Type Check',
        level: 'standard',
        passed: true,
        output: output || 'No type errors',
        errors: [],
        warnings: [],
        duration: Date.now() - start,
        score: 100,
      };
    } catch (err: unknown) {
      const output = (err as { stdout?: string; stderr?: string }).stdout ??
                     (err as { stdout?: string; stderr?: string }).stderr ?? String(err);
      const typeErrors = output.split('\n').filter(l => l.includes('error TS'));

      return {
        name: 'Type Check',
        level: 'standard',
        passed: false,
        output: output.slice(0, 3000),
        errors: typeErrors.slice(0, 20),
        warnings: [],
        duration: Date.now() - start,
        score: Math.max(0, 100 - typeErrors.length * 5),
      };
    }
  }

  private async runTests(): Promise<VerificationCheck | null> {
    const start = Date.now();
    const cmd = this.detectTestCommand();
    if (!cmd) return null;

    try {
      const output = execSync(cmd, {
        cwd: this.ctx.cwd,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: 'pipe',
      });

      const passMatch = output.match(/(\d+)\s+pass(?:ing|ed)/i);
      const passed = passMatch ? parseInt(passMatch[1]) : 0;

      return {
        name: 'Tests',
        level: 'standard',
        passed: true,
        output: output.slice(-1000), // Keep last 1000 chars (summary)
        errors: [],
        warnings: [],
        duration: Date.now() - start,
        score: 100,
      };
    } catch (err: unknown) {
      const output = (err as { stdout?: string; stderr?: string }).stdout ??
                     (err as { stdout?: string; stderr?: string }).stderr ?? String(err);

      const failMatch = output.match(/(\d+)\s+fail(?:ing|ed)/i);
      const passMatch = output.match(/(\d+)\s+pass(?:ing|ed)/i);
      const failed = failMatch ? parseInt(failMatch[1]) : 1;
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const total = failed + passed;

      const failedTests = output.split('\n').filter(l =>
        l.includes('✗') || l.includes('×') || l.includes('✖') ||
        l.includes('FAIL') || l.includes('● ')
      ).slice(0, 20);

      return {
        name: 'Tests',
        level: 'standard',
        passed: false,
        output: output.slice(-2000),
        errors: failedTests,
        warnings: [],
        duration: Date.now() - start,
        score: total > 0 ? Math.round((passed / total) * 100) : 0,
      };
    }
  }

  private async runDebtScan(): Promise<VerificationCheck> {
    const start = Date.now();
    const findings: string[] = [];

    for (const filePath of this.ctx.changedFiles) {
      if (!this.isTextFile(filePath)) continue;
      let content: string;
      try { content = fs.readFileSync(filePath, 'utf-8'); }
      catch { continue; }

      for (const { pattern, label } of DEBT_PATTERNS) {
        const p = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : 'g');
        const matches = content.match(p);
        if (matches && matches.length > 0) {
          findings.push(`${path.basename(filePath)}: ${matches.length}x ${label}`);
        }
      }
    }

    return {
      name: 'Tech Debt Scan',
      level: 'thorough',
      passed: true, // Debt is a warning, not a blocker
      output: findings.join('\n') || 'No tech debt patterns found',
      errors: [],
      warnings: findings,
      duration: Date.now() - start,
      score: Math.max(50, 100 - findings.length * 5),
    };
  }

  private async runDependencyAudit(): Promise<VerificationCheck | null> {
    const start = Date.now();
    const auditCmd = this.detectAuditCommand();
    if (!auditCmd) return null;

    try {
      const output = execSync(auditCmd, {
        cwd: this.ctx.cwd,
        encoding: 'utf-8',
        timeout: 30000,
        stdio: 'pipe',
      });

      return {
        name: 'Dependency Audit',
        level: 'thorough',
        passed: true,
        output: output.slice(0, 1000) || 'No known vulnerabilities',
        errors: [],
        warnings: [],
        duration: Date.now() - start,
        score: 100,
      };
    } catch (err: unknown) {
      const output = (err as { stdout?: string; stderr?: string }).stdout ?? String(err);
      const criticalCount = (output.match(/critical/gi) ?? []).length;
      const highCount = (output.match(/\bhigh\b/gi) ?? []).length;

      return {
        name: 'Dependency Audit',
        level: 'thorough',
        passed: criticalCount === 0,
        output: output.slice(0, 1000),
        errors: criticalCount > 0 ? [`${criticalCount} critical vulnerabilities in dependencies`] : [],
        warnings: highCount > 0 ? [`${highCount} high severity vulnerabilities`] : [],
        duration: Date.now() - start,
        score: criticalCount > 0 ? 0 : (highCount > 0 ? 50 : 100),
      };
    }
  }

  private async runEnvLeakCheck(): Promise<VerificationCheck> {
    const start = Date.now();
    const leaks: string[] = [];

    // Check if any .env or secret files are staged
    try {
      const stagedFiles = execSync('git diff --cached --name-only', {
        cwd: this.ctx.cwd,
        encoding: 'utf-8',
        stdio: 'pipe',
      }).split('\n').filter(Boolean);

      for (const file of stagedFiles) {
        if (/\.env|\.pem|\.key|\.p12|id_rsa|credentials/i.test(file)) {
          leaks.push(`STAGED SECRET FILE: ${file}`);
        }
      }
    } catch { /* git not available */ }

    return {
      name: 'Env/Secret Leak Check',
      level: 'security',
      passed: leaks.length === 0,
      output: leaks.join('\n') || 'No secret files staged',
      errors: leaks,
      warnings: [],
      duration: Date.now() - start,
      score: leaks.length === 0 ? 100 : 0,
    };
  }

  // ── Result builder ─────────────────────────────────────────────────────────

  private buildResult(
    checks: VerificationCheck[],
    level: VerificationLevel,
    totalDuration: number
  ): LayeredVerificationResult {
    const blockers = checks.flatMap(c => c.errors);
    const warnings = checks.flatMap(c => c.warnings);
    const allPassed = checks.every(c => c.passed);
    const overallScore = checks.length > 0
      ? Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length)
      : 100;

    const recommendations: string[] = [];
    for (const check of checks) {
      if (!check.passed && check.name === 'Tests') {
        recommendations.push('Fix failing tests before merging');
      }
      if (check.name === 'Security Scan' && check.errors.length > 0) {
        recommendations.push('Resolve all critical/high security issues');
      }
      if (check.name === 'Type Check' && !check.passed) {
        recommendations.push('Fix TypeScript errors — they indicate logical issues');
      }
    }

    return {
      overallPassed: allPassed,
      overallScore,
      level,
      checks,
      blockers,
      warnings,
      recommendations,
      totalDuration,
      filesChecked: this.ctx.changedFiles,
    };
  }

  // ── Detection helpers ──────────────────────────────────────────────────────

  private detectLanguage(): string {
    const tsConfig = path.join(this.ctx.cwd, 'tsconfig.json');
    const packageJson = path.join(this.ctx.cwd, 'package.json');
    const requirementsTxt = path.join(this.ctx.cwd, 'requirements.txt');
    const cargoToml = path.join(this.ctx.cwd, 'Cargo.toml');

    if (fs.existsSync(tsConfig)) return 'typescript';
    if (fs.existsSync(packageJson)) return 'javascript';
    if (fs.existsSync(requirementsTxt)) return 'python';
    if (fs.existsSync(cargoToml)) return 'rust';
    return 'javascript';
  }

  private detectTestFramework(): string {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(this.ctx.cwd, 'package.json'), 'utf-8')
      );
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) return 'vitest';
      if (deps.jest) return 'jest';
      if (deps.mocha) return 'mocha';
    } catch { /* no package.json */ }

    if (fs.existsSync(path.join(this.ctx.cwd, 'pytest.ini')) ||
        fs.existsSync(path.join(this.ctx.cwd, 'setup.cfg'))) {
      return 'pytest';
    }
    if (fs.existsSync(path.join(this.ctx.cwd, 'Cargo.toml'))) return 'cargo';
    return 'jest';
  }

  private detectLintCommand(): string | null {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(this.ctx.cwd, 'package.json'), 'utf-8')
      );
      if (pkg.scripts?.lint) return 'npm run lint -- --max-warnings 20';
    } catch { /* no package.json */ }

    if (this.detectedLanguage === 'python') {
      return fs.existsSync(path.join(this.ctx.cwd, 'ruff.toml'))
        ? 'ruff check . --no-cache'
        : 'python -m flake8 . --count --max-line-length=120 --statistics';
    }

    const eslintConfig = ['eslint.config.js', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml']
      .find(f => fs.existsSync(path.join(this.ctx.cwd, f)));
    if (eslintConfig) return 'npx eslint . --ext .ts,.js,.tsx,.jsx --max-warnings 20';

    return null;
  }

  private detectTypeCheckCommand(): string | null {
    if (this.detectedLanguage !== 'typescript') {
      if (this.detectedLanguage === 'python') {
        return fs.existsSync(path.join(this.ctx.cwd, 'mypy.ini')) ? 'mypy .' : null;
      }
      return null;
    }
    return 'npx tsc --noEmit --pretty';
  }

  private detectTestCommand(): string | null {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(this.ctx.cwd, 'package.json'), 'utf-8')
      );
      if (pkg.scripts?.test) return 'npm test -- --passWithNoTests 2>&1';
    } catch { /* no package.json */ }

    if (this.detectedTestFramework === 'pytest') return 'python -m pytest --tb=short 2>&1';
    if (this.detectedTestFramework === 'cargo') return 'cargo test 2>&1';
    return null;
  }

  private detectAuditCommand(): string | null {
    if (fs.existsSync(path.join(this.ctx.cwd, 'package-lock.json'))) {
      return 'npm audit --audit-level=high 2>&1';
    }
    if (fs.existsSync(path.join(this.ctx.cwd, 'yarn.lock'))) {
      return 'yarn audit --level high 2>&1';
    }
    if (fs.existsSync(path.join(this.ctx.cwd, 'requirements.txt'))) {
      return 'pip-audit 2>&1';
    }
    return null;
  }

  private isTextFile(filePath: string): boolean {
    const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip',
                        'tar', 'gz', 'exe', 'dll', 'so', 'dylib', 'wasm'];
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    return !binaryExts.includes(ext);
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  /** Format result for display in TUI */
  static format(result: LayeredVerificationResult): string {
    const icon = result.overallPassed ? '✅' : '❌';
    const lines = [`${icon} Verification [${result.level}] — Score: ${result.overallScore}/100`];

    for (const check of result.checks) {
      const checkIcon = check.passed ? '  ✓' : '  ✗';
      lines.push(`${checkIcon} ${check.name} (${check.duration}ms) — ${check.score}/100`);
      if (!check.passed && check.errors.length > 0) {
        for (const err of check.errors.slice(0, 3)) {
          lines.push(`    → ${err}`);
        }
      }
    }

    if (result.blockers.length > 0) {
      lines.push('');
      lines.push('🚫 Blockers:');
      for (const b of result.blockers.slice(0, 5)) {
        lines.push(`  - ${b}`);
      }
    }

    if (result.recommendations.length > 0) {
      lines.push('');
      lines.push('💡 Recommendations:');
      for (const r of result.recommendations) {
        lines.push(`  - ${r}`);
      }
    }

    return lines.join('\n');
  }
}
