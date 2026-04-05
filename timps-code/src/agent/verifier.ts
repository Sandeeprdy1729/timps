// agent/verifier.ts - Verification Agent
// Validates code correctness through tests, linting, and static analysis

import type { AgentEvent, Message } from '../types.js';
import { createProvider } from '../models/index.js';
import type { ModelProvider } from '../types.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface VerificationResult {
  passed: boolean;
  checks: CheckResult[];
  score: number;
  recommendations: string[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  error?: string;
  duration: number;
}

const VERIFIER_SYSTEM_PROMPT = `You are TIMPS Code Verifier — an expert at validating code correctness.

## Verification Focus
1. Test correctness: Do tests pass?
2. Type safety: Are there type errors?
3. Linting: Is code style consistent?
4. Security: Are there obvious vulnerabilities?
5. Performance: Are there anti-patterns?

## Verification Process
1. Run provided tests
2. Run type checker (tsc, mypy, etc.)
3. Run linter (eslint, ruff, etc.)
4. Check for common issues
5. Provide actionable feedback

## Output Format
Return a structured verification result:
{
  "passed": boolean,
  "score": 0-100,
  "checks": [
    {"name": "tests", "passed": boolean, "output": "..."},
    {"name": "types", "passed": boolean, "output": "..."}
  ],
  "recommendations": ["fix X", "improve Y"]
}
`;

export class VerifierAgent {
  private provider: ModelProvider;

  constructor(provider: ModelProvider) {
    this.provider = provider;
  }

  async verify(cwd: string, context?: string): Promise<VerificationResult> {
    const checks: CheckResult[] = [];
    const startTime = Date.now();

    checks.push(await this.runTests(cwd));
    checks.push(await this.runTypeCheck(cwd));
    checks.push(await this.runLinting(cwd));
    checks.push(await this.runSecurityCheck(cwd));

    const passed = checks.every(c => c.passed);
    const score = this.calculateScore(checks);
    const recommendations = this.generateRecommendations(checks);

    return {
      passed,
      checks,
      score,
      recommendations,
    };
  }

  private async runTests(cwd: string): Promise<CheckResult> {
    const start = Date.now();
    const testCommands = this.detectTestCommands(cwd);

    for (const cmd of testCommands) {
      try {
        const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 120000 });
        return {
          name: 'tests',
          passed: true,
          output: output.slice(0, 2000),
          duration: Date.now() - start,
        };
      } catch (e: any) {
        const errorOutput = (e.stdout || e.stderr || e.message).toString().slice(0, 2000);
        
        if (!errorOutput.includes('command not found') && !errorOutput.includes('no such file')) {
          return {
            name: 'tests',
            passed: false,
            output: errorOutput,
            error: `Test command failed: ${cmd}`,
            duration: Date.now() - start,
          };
        }
      }
    }

    return {
      name: 'tests',
      passed: true,
      output: 'No test framework detected',
      duration: Date.now() - start,
    };
  }

  private async runTypeCheck(cwd: string): Promise<CheckResult> {
    const start = Date.now();
    const typeCommands = this.detectTypeCommands(cwd);

    for (const cmd of typeCommands) {
      try {
        const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 60000 });
        return {
          name: 'types',
          passed: true,
          output: output.slice(0, 2000),
          duration: Date.now() - start,
        };
      } catch (e: any) {
        const errorOutput = (e.stdout || e.stderr || e.message).toString();
        
        if (!errorOutput.includes('command not found') && !errorOutput.includes('no such file')) {
          return {
            name: 'types',
            passed: errorOutput.length < 100,
            output: errorOutput.slice(0, 2000),
            duration: Date.now() - start,
          };
        }
      }
    }

    return {
      name: 'types',
      passed: true,
      output: 'No type checker detected',
      duration: Date.now() - start,
    };
  }

  private async runLinting(cwd: string): Promise<CheckResult> {
    const start = Date.now();
    const lintCommands = this.detectLintCommands(cwd);

    for (const cmd of lintCommands) {
      try {
        const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 60000 });
        return {
          name: 'lint',
          passed: output.length < 500,
          output: output.slice(0, 2000),
          duration: Date.now() - start,
        };
      } catch (e: any) {
        const errorOutput = (e.stdout || e.stderr || e.message).toString();
        
        if (!errorOutput.includes('command not found') && !errorOutput.includes('no such file')) {
          return {
            name: 'lint',
            passed: false,
            output: errorOutput.slice(0, 2000),
            duration: Date.now() - start,
          };
        }
      }
    }

    return {
      name: 'lint',
      passed: true,
      output: 'No linter detected',
      duration: Date.now() - start,
    };
  }

  private async runSecurityCheck(cwd: string): Promise<CheckResult> {
    const start = Date.now();
    const issues: string[] = [];

    const securityPatterns = [
      { pattern: /password\s*=\s*['"][^'"]+['"]/gi, issue: 'Hardcoded password' },
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, issue: 'Hardcoded API key' },
      { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, issue: 'Hardcoded secret' },
      { pattern: /eval\s*\(/gi, issue: 'Use of eval()' },
      { pattern: /exec\s*\(/gi, issue: 'Use of exec()' },
      { pattern: /__import__\s*\(\s*['"]os['"]\s*\)/gi, issue: 'Dynamic os import' },
    ];

    try {
      const files = this.findCodeFiles(cwd);
      for (const file of files.slice(0, 100)) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          for (const { pattern, issue } of securityPatterns) {
            if (pattern.test(content)) {
              issues.push(`${issue} in ${path.relative(cwd, file)}`);
            }
          }
        } catch {}
      }
    } catch {}

    return {
      name: 'security',
      passed: issues.length === 0,
      output: issues.length > 0 ? issues.slice(0, 10).join('\n') : 'No obvious security issues',
      duration: Date.now() - start,
    };
  }

  private calculateScore(checks: CheckResult[]): number {
    let totalWeight = 0;
    let weightedScore = 0;
    const weights: Record<string, number> = {
      tests: 0.4,
      types: 0.25,
      lint: 0.2,
      security: 0.15,
    };

    for (const check of checks) {
      const weight = weights[check.name] || 0.25;
      totalWeight += weight;
      weightedScore += check.passed ? weight : 0;
    }

    return Math.round((weightedScore / totalWeight) * 100);
  }

  private generateRecommendations(checks: CheckResult[]): string[] {
    const recommendations: string[] = [];

    for (const check of checks) {
      if (!check.passed) {
        switch (check.name) {
          case 'tests':
            recommendations.push('Fix failing tests first');
            if (check.output.includes('AssertionError')) {
              recommendations.push('Review assertion logic in tests');
            }
            break;
          case 'types':
            recommendations.push('Fix type errors before proceeding');
            break;
          case 'lint':
            recommendations.push('Address linting issues for code quality');
            break;
          case 'security':
            recommendations.push('Address security vulnerabilities immediately');
            break;
        }
      }
    }

    return recommendations;
  }

  private detectTestCommands(cwd: string): string[] {
    const commands: string[] = [];
    
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      commands.push('npm test 2>&1');
      commands.push('npm run test 2>&1');
      commands.push('npx jest 2>&1');
      commands.push('npx vitest 2>&1');
    }
    
    if (fs.existsSync(path.join(cwd, 'pytest.ini')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
      commands.push('pytest -v 2>&1');
      commands.push('python -m pytest -v 2>&1');
    }
    
    if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
      commands.push('cargo test 2>&1');
    }
    
    if (fs.existsSync(path.join(cwd, 'go.mod'))) {
      commands.push('go test ./... 2>&1');
    }

    return commands;
  }

  private detectTypeCommands(cwd: string): string[] {
    const commands: string[] = [];
    
    if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
      commands.push('npx tsc --noEmit 2>&1');
    }
    
    if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'mypy.ini'))) {
      commands.push('mypy . 2>&1');
      commands.push('python -m mypy . 2>&1');
    }

    return commands;
  }

  private detectLintCommands(cwd: string): string[] {
    const commands: string[] = [];
    
    if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
      commands.push('npx eslint . 2>&1 || true');
    }
    
    if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, '.ruff.toml'))) {
      commands.push('ruff check . 2>&1 || true');
    }

    return commands;
  }

  private findCodeFiles(cwd: string, extensions = ['.ts', '.js', '.py', '.java']): string[] {
    const files: string[] = [];
    
    const scan = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
          
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch {}
    };

    scan(cwd);
    return files;
  }

  async *verifyWithLLM(code: string, requirements: string): AsyncGenerator<AgentEvent> {
    const prompt = `${VERIFIER_SYSTEM_PROMPT}

CODE TO VERIFY:
\`\`\`
${code.slice(0, 5000)}
\`\`\`

REQUIREMENTS:
${requirements}

Analyze the code against requirements and return a structured result.`;

    const messages: Message[] = [
      { role: 'system', content: VERIFIER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    try {
      let text = '';
      for await (const event of this.provider.stream(messages, [])) {
        if (event.type === 'text') {
          text += event.content;
        }
      }
      yield { type: 'text', content: text };
    } catch (err) {
      yield { type: 'error', message: (err as Error).message };
    }
  }
}
