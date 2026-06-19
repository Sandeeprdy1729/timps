// ── @timps/memory-core — ConstitutionalSandbox ──
// Integration layer: Sandbox + EngramLog + ConstitutionalFilter.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { SandboxHandle, SandboxOptions, SandboxRouter, ExecResult, Runtime } from './Sandbox.js';
import { ConstitutionalFilter } from '../safety/ConstitutionalFilter.js';

export type DetectedLanguage = 'python' | 'node' | 'bash' | 'unknown';

export interface PromptAnalysis {
  needsExecution: boolean;
  detectedLanguage: DetectedLanguage;
  reason: string;
}

export interface SandboxExecutionRecord {
  timestamp: number;
  promptHash: string;
  sandboxId: string;
  language: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  stdoutPreview: string;
  stderrPreview: string;
  scriptHash: string;
  constitutionTriggered: boolean;
  triggeredRules: string[];
}

export class ConstitutionalSandbox {
  private logPath: string;
  private records: SandboxExecutionRecord[] = [];

  constructor(
    private dir: string,
    private filter: ConstitutionalFilter,
  ) {
    this.logPath = path.join(dir, 'sandbox-execution-log.jsonl');
    this.loadLog();
  }

  private loadLog(): void {
    if (!fs.existsSync(this.logPath)) return;
    try {
      const content = fs.readFileSync(this.logPath, 'utf-8').trim();
      if (!content) return;
      this.records = content.split('\n').map(l => JSON.parse(l) as SandboxExecutionRecord);
    } catch {
      this.records = [];
    }
  }

  private saveLog(): void {
    const last = this.records.slice(-500);
    fs.writeFileSync(this.logPath, last.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
  }

  async maybeExecute(
    userPrompt: string,
    opts?: { autoApprove?: boolean },
  ): Promise<{ executed: boolean; result?: ExecResult; analysis: PromptAnalysis; record?: SandboxExecutionRecord }> {
    const analysis = this.analyzePrompt(userPrompt);
    if (!analysis.needsExecution) {
      return { executed: false, analysis };
    }

    const verdict = await this.filter.refine(userPrompt);
    if (!verdict.safe && !opts?.autoApprove) {
      const record = this.recordExecution({
        promptHash: this.hash(userPrompt),
        sandboxId: 'rejected',
        language: analysis.detectedLanguage,
        exitCode: -1,
        durationMs: 0,
        timedOut: false,
        stdoutPreview: '',
        stderrPreview: `Constitution rejected: ${verdict.triggeredRules.map(r => r.id).join(', ')}`,
        scriptHash: this.hash(verdict.refined),
        constitutionTriggered: true,
        triggeredRules: verdict.triggeredRules.map(r => r.id),
      });
      return { executed: false, analysis, record };
    }

    const code = this.extractCode(userPrompt, analysis.detectedLanguage);
    if (!code) {
      return { executed: false, analysis };
    }

    const sbx: SandboxHandle = SandboxRouter.create({
      runtime: analysis.detectedLanguage as Runtime,
      files: [{ path: this.filenameFor(analysis.detectedLanguage), content: code }],
      network: 'none',
      timeoutMs: 30_000,
      memoryMb: 512,
    });

    try {
      const result = await sbx.exec(code, []);
      const record = this.recordExecution({
        promptHash: this.hash(userPrompt),
        sandboxId: sbx.id,
        language: analysis.detectedLanguage,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        timedOut: result.timedOut,
        stdoutPreview: result.stdout.slice(0, 200),
        stderrPreview: result.stderr.slice(0, 200),
        scriptHash: result.scriptHash,
        constitutionTriggered: verdict.triggeredRules.length > 0,
        triggeredRules: verdict.triggeredRules.map(r => r.id),
      });
      return { executed: true, result, analysis, record };
    } finally {
      await sbx.destroy();
    }
  }

  analyzePrompt(prompt: string): PromptAnalysis {
    const fenceMatch = prompt.match(/```(\w+)?\n([\s\S]*?)```/);
    if (fenceMatch) {
      const lang = (fenceMatch[1] ?? '').toLowerCase();
      const code = fenceMatch[2];
      if (lang === 'python' || lang === 'py') return { needsExecution: true, detectedLanguage: 'python', reason: 'Python code block detected' };
      if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') return { needsExecution: true, detectedLanguage: 'node', reason: 'JavaScript code block detected' };
      if (lang === 'bash' || lang === 'sh' || lang === 'shell') return { needsExecution: true, detectedLanguage: 'bash', reason: 'Shell code block detected' };
      const detected = SandboxRouter.detect(code);
      if (detected !== 'bash') {
        return { needsExecution: true, detectedLanguage: detected as any, reason: `Code block detected (sniffed as ${detected})` };
      }
    }

    const lower = prompt.toLowerCase();
    const verbMatch = /\b(run|execute|test|try out|show output of)\b/.test(lower) && this.looksLikeCode(prompt);
    if (verbMatch) {
      const detected = SandboxRouter.detect(prompt) as any;
      return { needsExecution: true, detectedLanguage: detected, reason: 'User asked to run code' };
    }

    return { needsExecution: false, detectedLanguage: 'unknown', reason: 'No executable code detected' };
  }

  private looksLikeCode(s: string): boolean {
    return /[{};()]/.test(s) && /\b(def|function|class|import|require|const|let|var|echo|print)\b/.test(s);
  }

  private extractCode(prompt: string, lang: string): string | null {
    const fence = prompt.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    if (fence) return fence[1].trim();
    return prompt.replace(/^(please\s+)?(run|execute|test)\s+(this|that|the\s+following)?:?\s*/i, '').trim();
  }

  private filenameFor(lang: string): string {
    if (lang === 'python') return 'script.py';
    if (lang === 'node') return 'script.js';
    return 'script.sh';
  }

  private hash(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
  }

  private recordExecution(r: Omit<SandboxExecutionRecord, 'timestamp'>): SandboxExecutionRecord {
    const record: SandboxExecutionRecord = { timestamp: Date.now(), ...r };
    this.records.push(record);
    this.saveLog();
    return record;
  }

  getLog(limit = 50): SandboxExecutionRecord[] {
    return this.records.slice(-limit).reverse();
  }
}
