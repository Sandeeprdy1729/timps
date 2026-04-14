// optimus.ts - Digital Optimus Pipeline
// Direct intent-to-implementation: No SPEC.md, just RSSG (Repository Structural Semantic Graph)
// Physics of bugs: train on failure → success transitions

import { NavigatorAgent } from './agent/navigator.js';
import { GRPOTrainer } from './grpo.js';
import { BinarySynthesizer } from './binary-synth.js';
import { RepoGraph } from './repo-graph.js';
import type { AgentEvent } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ProductSpec {
  name: string;
  description: string;
  stack: string[];
  features: string[];
  entryPoints?: string[];
  rssg?: RSSGNode;
  isBinarySynth?: boolean;
  targetArch?: string;
}

export interface RSSGNode {
  files: Map<string, any>;
  dependencies: Map<string, string[]>;
  entryPoints: string[];
}

export interface FileNode {
  path: string;
  functions: string[];
  classes: string[];
  imports: string[];
  exports: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'code' | 'config' | 'docs' | 'infrastructure';
}

interface PipelineState {
  spec: ProductSpec | null;
  files: GeneratedFile[];
  errors: string[];
  verified: boolean;
  trajectories: TrajectoryCapture[];
  rssg: RSSGNode | null;
}

interface TrajectoryCapture {
  step: string;
  error?: string;
  correction?: string;
  passed: boolean;
  errorType?: string;
}

export interface OptimusConfig {
  warRoom?: boolean;
  binarySynth?: boolean;
  targetArch?: string;
  grpoEnabled?: boolean;
  maxIterations?: number;
  useRSSG?: boolean;
}

export class DigitalOptimus {
  private navigator: NavigatorAgent | null = null;
  private state: PipelineState = { 
    spec: null, 
    files: [], 
    errors: [], 
    verified: false, 
    trajectories: [],
    rssg: null,
  };
  private cwd: string;
  private config: OptimusConfig;
  private binarySynth: BinarySynthesizer | null = null;
  private grpoTrainer: GRPOTrainer | null = null;
  private repoGraph: RepoGraph | null = null;

  constructor(cwd: string, config: OptimusConfig = {}) {
    this.cwd = cwd;
    this.config = {
      warRoom: config.warRoom ?? false,
      binarySynth: config.binarySynth ?? false,
      targetArch: config.targetArch || 'x86_64',
      grpoEnabled: config.grpoEnabled ?? false,
      maxIterations: config.warRoom ? 50 : 15,
      useRSSG: config.useRSSG ?? true,  // Default: use RSSG
    };

    if (config.binarySynth) {
      this.binarySynth = new BinarySynthesizer(config.targetArch as any || 'x86_64', 'llvm');
    }

    // Initialize RepoGraph for multi-file context
    this.repoGraph = new RepoGraph(cwd);
  }

  setNavigator(nav: NavigatorAgent): void {
    this.navigator = nav;
  }

  setGRPOTrainer(trainer: GRPOTrainer): void {
    this.grpoTrainer = trainer;
  }

  async *execute(input: string): AsyncGenerator<AgentEvent> {
    const warRoomMsg = this.config.warRoom ? ' [WAR ROOM MODE]' : '';
    const rssgMsg = this.config.useRSSG ? ' [RSSG]' : '';
    yield { type: 'status', message: `🚀 Digital Optimus: "${input.slice(0, 60)}..."${warRoomMsg}${rssgMsg}` };
    this.state = { spec: null, files: [], errors: [], verified: false, trajectories: [], rssg: null };

    // NO SPEC.md - direct intent to RSSG to implementation
    yield* this.parseIntentToRSSG(input);
    yield* this.implement();
    yield* this.verify();

    // GRPO: capture failed trajectories with error classification
    if (this.state.errors.length > 0 && this.grpoTrainer) {
      yield { type: 'status', message: '🧠 Capturing failures for GRPO training...' };
      for (const traj of this.state.trajectories) {
        if (!traj.passed && traj.error && traj.correction) {
          this.grpoTrainer.recordVerifyResult(
            traj.error,
            traj.correction,
            false,
            traj.error || '',
            'optimus'
          );
        }
      }
    }

    if (this.state.errors.length > 0) {
      yield { type: 'error', message: `Pipeline completed with ${this.state.errors.length} issues` };
    } else {
      yield { type: 'status', message: `✅ Product ready: ${this.state.spec?.name}` };
    }
  }

  // NO SPEC.MD - Direct intent parsing to RSSG construction
  private async *parseIntentToRSSG(input: string): AsyncGenerator<AgentEvent> {
    yield { type: 'status', message: '🔄 Parsing intent → building RSSG (no SPEC.md)' };
    
    if (!this.navigator) return;

    // Step 1: Parse intent into structured spec (internal only, not saved to disk)
    const parsePrompt = `Parse this product request into a MINIMAL internal spec (JSON only, no markdown):

Request: "${input}"

Return JSON:
{
  "name": "product-name",
  "description": "1-sentence",
  "stack": ["tech1", "tech2"],
  "features": ["f1", "f2"],
  "entryPoints": ["main", "app"],
  "isBinarySynth": false/true
}

No markdown. No file writes. Internal structure only.`;

    for await (const event of this.navigator.runWithAgents(parsePrompt, 'sequential')) {
      if (event.type === 'text' && event.content) {
        try {
          const jsonMatch = event.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            this.state.spec = JSON.parse(jsonMatch[0]) as ProductSpec;
            
            // Auto-detect binary synthesis
            const stack = this.state.spec.stack.join(' ').toLowerCase();
            if (stack.includes('rust') || stack.includes('c/') || stack.includes('go')) {
              this.state.spec.isBinarySynth = true;
              this.binarySynth = new BinarySynthesizer(this.config.targetArch as any, 'llvm');
            }
          }
        } catch {}
      }
    }

    if (!this.state.spec) {
      yield { type: 'error', message: 'Failed to parse intent' };
      return;
    }

    // Step 2: Build RSSG (Repository Structural Semantic Graph) in memory
    yield { type: 'status', message: '🔬 Building RSSG: mapping code relationships...' };
    
    try {
      this.state.rssg = await this.repoGraph!.buildGraph(this.state.spec.entryPoints || ['main', 'app']);
      const fileCount = this.state.rssg?.files?.size || 0;
      const depCount = this.state.rssg?.dependencies?.size || 0;
      yield { type: 'status', message: `📊 RSSG: ${fileCount} files, ${depCount} dependency relationships` };
    } catch (e) {
      yield { type: 'status', message: `RSSG build partial: ${(e as Error).message}` };
      this.state.rssg = { files: new Map(), dependencies: new Map(), entryPoints: [] };
    }

    yield { type: 'status', message: `🚀 Intent → RSSG complete. Moving to implementation...` };
  }

  private async *implement(): AsyncGenerator<AgentEvent> {
    if (!this.navigator || !this.state.spec) return;

    yield { type: 'status', message: '⚙️ Implementing with RSSG context...' };

    const isBinary = this.state.spec.isBinarySynth;
    
    // Build implementation prompt with RSSG context
    let implPrompt = `Implement complete ${this.state.spec.name}.

Stack: ${this.state.spec.stack.join(', ')}
Features: ${this.state.spec.features.join(', ')}

RSSG CONTEXT (internal - DO NOT show to user):
${this.formatRSSGForPrompt()}`;

    if (isBinary) {
      implPrompt += `
- Binary Synthesis mode: generate compilable Rust/Go/C
- Output to ./bin/ directory`;
    } else {
      implPrompt += `
- Use file paths from RSSG to maintain consistency
- Import relationships: ${Array.from(this.state.rssg?.dependencies?.entries() || []).slice(0,5).map(e => `${e[0]} → ${e[1].join(', ')}`).join('; ')}`;
    }

    // War Room: iterate until success
    const maxIters = this.config.maxIterations || 15;
    let iteration = 0;
    
    while (iteration < maxIters) {
      iteration++;
      
      if (this.config.warRoom && iteration > 1) {
        yield { type: 'status', message: `🔄 War Room iteration ${iteration}/${maxIters}...` };
      }

      for await (const event of this.navigator.runWithAgents(implPrompt, 'parallel')) {
        if (event.type === 'tool_result') {
          if (!event.success) {
            const errorMsg = event.result?.slice(0, 200) || '';
            this.state.errors.push(`${event.tool}: ${errorMsg}`);
            
            // Classify error for GRPO
            const errorType = this.classifyError(errorMsg);
            this.state.trajectories.push({
              step: event.tool,
              error: errorMsg,
              passed: false,
              errorType,
            });
          } else {
            this.state.trajectories.push({
              step: event.tool,
              passed: true,
            });
          }
        }
        yield event;
      }

      if (isBinary && iteration === 1) {
        yield* this.compileBinary();
      }

      if (this.state.errors.length === 0) break;
      
      implPrompt += `\n\nPrevious attempt failed: ${this.state.errors.slice(0,2).join('; ')}. Fix these.`;
    }

    if (iteration >= maxIters) {
      yield { type: 'status', message: `⚠️ Max iterations (${maxIters}). Continuing.` };
    }
  }

  private formatRSSGForPrompt(): string {
    if (!this.state.rssg) return 'No graph data';
    
    const lines: string[] = [];
    for (const [file, node] of this.state.rssg.files) {
      lines.push(`  ${file}:`);
      lines.push(`    functions: ${node.functions.slice(0,3).join(', ')}`);
      lines.push(`    classes: ${node.classes.slice(0,3).join(', ')}`);
      lines.push(`    imports: ${node.imports.slice(0,3).join(', ')}`);
    }
    return lines.slice(0, 20).join('\n');  // Limit context
  }

  private classifyError(errorMsg: string): string {
    const lower = errorMsg.toLowerCase();
    if (lower.includes('borrow') || lower.includes('lifetime')) return 'borrow';
    if (lower.includes('type') || lower.includes('typeerror')) return 'type';
    if (lower.includes('syntax') || lower.includes('parse')) return 'syntax';
    if (lower.includes('import') || lower.includes('module')) return 'import';
    if (lower.includes('undefined') || lower.includes('null')) return 'runtime';
    if (lower.includes('test') || lower.includes('assert')) return 'test';
    return 'other';
  }

  private async *compileBinary(): AsyncGenerator<AgentEvent> {
    if (!this.binarySynth) return;
    yield { type: 'status', message: '⚡ Compiling binary...' };
    const srcDir = path.join(this.cwd, 'src');
    if (!fs.existsSync(srcDir)) return;
    const srcFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.rs') || f.endsWith('.go') || f.endsWith('.c'));
    for (const srcFile of srcFiles) {
      const srcPath = path.join(srcDir, srcFile);
      const content = fs.readFileSync(srcPath, 'utf-8');
      const lang = srcFile.endsWith('.rs') ? 'rust' : srcFile.endsWith('.go') ? 'go' : 'c';
      for await (const event of this.binarySynth!.compile(content, lang)) {
        yield { type: 'status', message: event.message };
      }
    }
  }

  private async *verify(): AsyncGenerator<AgentEvent> {
    if (!this.navigator) return;
    yield { type: 'status', message: '🔍 Verifying...' };

    const maxIters = this.config.warRoom ? 10 : 3;
    let iteration = 0;
    let verifyPrompt = `Verify:
1. All files created
2. Type checking passes
3. Tests pass
4. Binary runs (if applicable)

Report ONLY failures in format: "ERROR: <issue>"`;
    
    while (iteration < maxIters) {
      iteration++;
      let hasErrors = false;

      for await (const event of this.navigator.runWithAgents(verifyPrompt, 'sequential')) {
        if (event.type === 'error' || (event.type === 'tool_result' && !event.success)) {
          hasErrors = true;
          const errMsg = event.type === 'error' ? event.message : (event as any).result;
          this.state.errors.push(errMsg);
          
          this.state.trajectories.push({
            step: 'verify',
            error: errMsg,
            passed: false,
            errorType: this.classifyError(errMsg),
          });
        }
        yield event;
      }

      if (!hasErrors) {
        this.state.verified = true;
        break;
      }

      if (iteration < maxIters) {
        verifyPrompt += `\nErrors: ${this.state.errors.slice(0,1)}. Re-verify (${iteration + 1}/${maxIters}).`;
      }
    }

    if (!this.state.verified) {
      yield { type: 'status', message: `🛠 Verification failed - ${this.state.errors.length} issues` };
    }
  }

  getResult(): { spec: ProductSpec | null; errors: string[]; verified: boolean; rssg: RSSGNode | null } {
    return { 
      spec: this.state.spec, 
      errors: this.state.errors, 
      verified: this.state.verified,
      rssg: this.state.rssg,
    };
  }
}