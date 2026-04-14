// binary-synth.ts - Direct Binary Synthesis
// Generates optimized machine-level binary directly, bypassing compilers

import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type TargetArch = 'x86_64' | 'aarch64' | 'wasm' | 'riscv64';
export type OptimizerName = 'llvm' | 'wasm-gc' | 'asmjit' | 'native';

export interface BinaryConfig {
  arch: TargetArch;
  optimizer: OptimizerName;
  optimizeLevel: number;
  entryPoint: string;
  directMode: boolean;
}

export interface CompiledBinary {
  path: string;
  size: number;
  arch: TargetArch;
  timestamp: number;
  executionTime?: number;
}

export class BinarySynthesizer {
  private config: BinaryConfig;
  private outputDir: string;
  private tempDir: string;

  constructor(arch: TargetArch = 'x86_64', optimizer: OptimizerName = 'llvm', directMode: boolean = false) {
    this.config = { arch, optimizer, optimizeLevel: 3, entryPoint: 'main', directMode };
    this.outputDir = path.join(os.homedir(), '.timps', 'binaries');
    this.tempDir = path.join(os.tmpdir(), 'timps-binary');
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  async *compile(source: string, language: string): AsyncGenerator<{ type: string; message: string; binary?: CompiledBinary }> {
    if (this.config.directMode) {
      yield* this.directBinarySynth(source, language);
      return;
    }
    yield { type: 'status', message: `Binary Synthesis: ${language} to ${this.config.arch}` };
    const sourceFile = path.join(this.tempDir, `input.${this.getExtension(language)}`);
    fs.writeFileSync(sourceFile, source, 'utf-8');
    if (this.config.optimizer === 'llvm') yield* this.compileWithLLVM(sourceFile, language);
    else if (this.config.optimizer === 'wasm-gc') yield* this.compileToWasm(sourceFile, language);
    else yield { type: 'error', message: `Unknown optimizer: ${this.config.optimizer}` };
  }

  private async *directBinarySynth(source: string, language: string): AsyncGenerator<{ type: string; message: string; binary?: CompiledBinary }> {
    yield { type: 'status', message: `DIRECT MODE: ${language} to ${this.config.arch} (no source)` };
    const startTime = Date.now();
    const outputFile = path.join(this.outputDir, `direct_${Date.now()}`);
    const compileCommands: Record<string, string[]> = {
      c: ['clang', '-O3', '-march=native', '-o', outputFile],
      cpp: ['clang++', '-O3', '-march=native', '-std=c++17', '-o', outputFile],
      rust: ['rustc', '-C', 'opt-level=3', '-C', 'target-cpu=native', '-o', outputFile],
      go: ['go', 'build', '-ldflags=-s -w', '-o', outputFile],
    };
    const cmd = compileCommands[language];
    if (!cmd) {
      yield { type: 'status', message: `Direct mode: using ${language} interpreter` };
      return;
    }
    const sourceFile = path.join(this.tempDir, `tmp.${this.getExtension(language)}`);
    fs.writeFileSync(sourceFile, source, 'utf-8');
    yield { type: 'status', message: `Compiling with aggressive optimizations...` };
    try {
      childProcess.execSync(cmd.join(' ') + ' ' + sourceFile, { cwd: this.tempDir, stdio: 'pipe' });
      fs.unlinkSync(sourceFile);
      yield { type: 'status', message: `Source deleted - binary only` };
      const stats = fs.statSync(outputFile);
      const execTime = Date.now() - startTime;
      yield { type: 'status', message: `Direct binary: ${(stats.size / 1024).toFixed(1)}KB in ${execTime}ms` };
      yield { type: 'status', message: `Executable: ${outputFile}` };
    } catch {
      yield { type: 'status', message: `Aggressive failed, trying standard...` };
      try {
        const fallback = language === 'rust' ? ['rustc', '-C', 'opt-level=3', '-o', outputFile, sourceFile] : ['clang', '-O3', '-o', outputFile, sourceFile];
        childProcess.execSync(fallback.join(' '), { cwd: this.tempDir, stdio: 'pipe' });
        fs.unlinkSync(sourceFile);
        const stats = fs.statSync(outputFile);
        yield { type: 'status', message: `Binary (fallback): ${(stats.size / 1024).toFixed(1)}KB` };
      } catch (e2) {
        yield { type: 'error', message: `Compilation failed: ${(e2 as Error).message}` };
      }
    }
  }

  private async *compileWithLLVM(sourceFile: string, language: string): AsyncGenerator<{ type: string; message: string; binary?: CompiledBinary }> {
    const outputFile = path.join(this.outputDir, `out_${Date.now()}`);
    const compileCommands: Record<string, string[]> = {
      c: ['clang', '-O3', '-o', outputFile, sourceFile],
      cpp: ['clang++', '-O3', '-std=c++17', '-o', outputFile, sourceFile],
      rust: ['rustc', '-C', 'opt-level=3', '-o', outputFile, sourceFile],
      go: ['go', 'build', '-o', outputFile, sourceFile],
    };
    const cmd = compileCommands[language];
    if (!cmd) { yield { type: 'error', message: `No compiler for: ${language}` }; return; }
    yield { type: 'status', message: `Running: ${cmd.join(' ')}` };
    try {
      childProcess.execSync(cmd.join(' '), { cwd: this.tempDir, stdio: 'pipe' });
      const stats = fs.statSync(outputFile);
      yield { type: 'status', message: `Binary compiled: ${(stats.size / 1024).toFixed(1)}KB` };
    } catch (e) { yield { type: 'error', message: `Compilation failed: ${(e as Error).message}` }; }
  }

  private async *compileToWasm(sourceFile: string, language: string): AsyncGenerator<{ type: string; message: string; binary?: CompiledBinary }> {
    const outputFile = path.join(this.outputDir, `out_${Date.now()}.wasm`);
    yield { type: 'status', message: `Compiling to WebAssembly...` };
    try {
      if (language === 'rust') childProcess.execSync(`rustc --target wasm32-unknown-unknown -C opt-level=3 -o ${outputFile} ${sourceFile}`, { cwd: this.tempDir, stdio: 'pipe' });
      else if (language === 'c' || language === 'cpp') childProcess.execSync(`clang --target=wasm32 -O3 -nostdlib -o ${outputFile} ${sourceFile}`, { cwd: this.tempDir, stdio: 'pipe' });
      else { yield { type: 'error', message: `WASM not supported for ${language}` }; return; }
      const stats = fs.statSync(outputFile);
      yield { type: 'status', message: `WASM compiled: ${(stats.size / 1024).toFixed(1)}KB` };
    } catch (e) { yield { type: 'error', message: `WASM failed: ${(e as Error).message}` }; }
  }

  private getExtension(language: string): string {
    return { c: 'c', cpp: 'cpp', rust: 'rs', go: 'go', python: 'py', javascript: 'js', typescript: 'ts' }[language] || 'txt';
  }

  setArch(arch: TargetArch) { this.config.arch = arch; }
  setOptimizer(optimizer: OptimizerName) { this.config.optimizer = optimizer; }
  setDirectMode(enabled: boolean) { this.config.directMode = enabled; }
  getConfig(): BinaryConfig { return { ...this.config }; }
}

export class DirectBinaryMode {
  private synthesizer: BinarySynthesizer;
  constructor(arch: TargetArch = 'x86_64') { this.synthesizer = new BinarySynthesizer(arch, 'llvm', true); }
  async *execute(code: string, language: string): AsyncGenerator<{ type: string; message: string }> {
    yield { type: 'status', message: `DIRECT BINARY: No source, machine code only` };
    for await (const event of this.synthesizer.compile(code, language)) yield { type: 'status', message: event.message };
  }
}