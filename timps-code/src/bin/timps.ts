#!/usr/bin/env node
// ── TIMPS Code — CLI Entry Point ──
// Dataset Pipeline: Mining + Synthetic + GRPO Training

import { Command } from 'commander';
import { startApp, runDataPipeline } from '../app.js';
import { LOGO, t } from '../theme.js';
import type { ProviderName } from '../types.js';

const program = new Command();

program
  .name('timps')
  .description('TIMPS Code — AI coding agent with persistent memory + dataset pipeline')
  .version('1.0.0')
  .option('-p, --provider <name>', 'Model provider: claude, openai, gemini, ollama, openrouter')
  .option('-m, --model <model>', 'Model name (e.g., gpt-4o, claude-sonnet-4-20250514)')
  .option('-d, --dir <path>', 'Working directory')
  .option('-c, --config', 'Run setup wizard')
  .option('-b, --branch <name>', 'Branch current memory state into a proven context')
  .option('--merge <target>', 'Merge a branch into the current semantic context')
  
  // GRPO Training Loop
  .option('--grpo', 'Enable GRPO training loop (capture trajectories for fine-tuning)', false)
  .option('--grpo-model <model>', 'GRPO reward model (default: unsloth/llama-3-8b-grpo)')
  
  // Data Mining
  .option('--mine-bugs', 'Run human mistake mining pipeline (GitBug-Actions)', false)
  .option('--bug-source <source>', 'Bug source: stackoverflow, github-pr, local, ci-fail-to-pass, the-stack-v1, so-edits')
  .option('--mine-count <number>', 'Number of bugs to mine (default: 100)')
  .option('--mine-output <path>', 'Output directory for mined trajectories')
  
  // Pre-AI Gold Era (Jan 2015 - Mar 2022)
  .option('--mine-archive', 'Mine Pre-AI Gold Era data (2015-2022)', false)
  .option('--before <date>', 'Cutoff date for pre-AI data (default: 2022-11-30)')
  .option('--after <date>', 'Start date for pre-AI data (default: 2015-01-01)')
  .option('--source <source>', 'Archive source: the-stack-v1, so-edits, github-archive')
  .option('--target <count>', 'Target trajectory count (default: 1000000)')
  .option('--min-stars <number>', 'Minimum stars for GitHub repos (default: 10)')
  .option('--exclude-bot', 'Exclude bot commits (Dependabot, Jenkins)', true)
  .option('--verify-docker', 'Verify each fix in Docker sandbox', false)
  
  // Stack Overflow Edit Mining
  .option('--mine-so-edits', 'Mine Stack Overflow edit history for reasoning traces', false)
  .option('--min-score <number>', 'Minimum SO answer score (default: 5)')
  .option('--link-comments', 'Link SO comments to subsequent edits', false)
  
  // Synthetic Generation
  .option('--synthesize', 'Run synthetic trajectory generation (self-play)', false)
  .option('--synth-count <number>', 'Number of synthetic trajectories to generate (default: 1000)')
  .option('--synth-iterations <number>', 'Self-play iterations per trajectory (default: 5)')
  .option('--synth-docker', 'Run in Docker sandbox for verification', false)
  
  // Data Pipeline (full loop)
  .option('--build-dataset', 'Run full pipeline: mine + synthesize + verify + format', false)
  .option('--dataset-target <number>', 'Target trajectory count (default: 10000)')
  .option('--dataset-output <path>', 'Output path for final dataset (default: ./dataset)')
  
  // Evaluation
  .option('--eval-swebench', 'Run SWE-bench evaluation (lite/verified/pro)')
  .option('--eval-suite <suite>', 'SWE-bench suite: lite, verified, pro (default: pro)')
  .option('--eval-livecode', 'Run LiveCodeBench evaluation', false)
  
  // Hardcore Modes
  .option('--war-room', 'Enable war room mode (19h sessions, radical talent density)', false)
  .option('--binary-synth', 'Enable Direct Binary Synthesis (bypass compilers)', false)
  .option('--arch <arch>', 'Target architecture for binary synth (x86_64, aarch64, wasm)')
  .option('--optimizer <name>', 'Optimizer for binary: llvm, wasm-gc, custom')
  
  // Proactive Employee Mode
  .option('--autonomous', 'Enable autonomous GitHub integration (scan issues, open PRs)', false)
  .option('--github-token <token>', 'GitHub token for autonomous mode')
  .option('--org <org>', 'GitHub organization for autonomous mode')
  .option('--repo <repo>', 'GitHub repository for autonomous mode')
  .option('--budget <amount>', 'Daily budget for autonomous operations (USD)')
  
  // Macrohard: Digital Optimus Employee
  .option('--macrohard', 'Enable Macrohard mode (full corporate employee)', false)
  .option('--macrohard-budget <amount>', 'Daily budget for Digital Optimus (USD, default: 100)')
  
  .argument('[message...]', 'One-shot message (non-interactive)')
  .action(async (messageParts: string[], opts: Record<string, unknown>) => {
    // Data pipeline mode (headless CLI)
    if (opts.buildDataset || opts.mineBugs || opts.mineArchive || opts.synthesize || opts.evalSwebench || opts.evalLivecode) {
      console.log(LOGO);
      console.log(`\n${t.accent('🗄️')} DATASET PIPELINE MODE (HEADLESS)\n`);
      
      await runDataPipeline({
        mineBugs: opts.mineBugs as boolean,
        bugSource: (opts.bugSource as any) || 'github-pr',
        mineCount: Number(opts.mineCount) || 100,
        mineOutput: opts.mineOutput as string,
        
        // Pre-AI Gold Era
        mineArchive: opts.mineArchive as boolean,
        beforeDate: opts.before as string || '2022-11-30',
        afterDate: opts.after as string || '2015-01-01',
        archiveSource: opts.source as any,
        targetCount: Number(opts.target) || 1000000,
        minStars: Number(opts.minStars) || 10,
        excludeBot: opts.excludeBot !== false,
        verifyDocker: opts.verifyDocker as boolean,
        
        // Stack Overflow
        mineSOEdits: opts.mineSoEdits as boolean,
        minScore: Number(opts.minScore) || 5,
        linkComments: opts.linkComments as boolean,
        
        synthesize: opts.synthesize as boolean,
        synthCount: Number(opts.synthCount) || 1000,
        synthIterations: Number(opts.synthIterations) || 5,
        synthDocker: opts.synthDocker as boolean,
        buildDataset: opts.buildDataset as boolean,
        datasetTarget: Number(opts.datasetTarget) || 10000,
        datasetOutput: (opts.datasetOutput as string) || './dataset',
        evalSwebench: opts.evalSwebench as boolean,
        evalSwebenchSuite: (opts.evalSuite as any) || 'pro',
        evalLivecode: opts.evalLivecode as boolean,
        provider: (opts.provider as string) as ProviderName || 'ollama',
        model: opts.model as string,
      });
      return;
    }

    // Normal app mode
    if (opts.config) {
      const { runSetupWizard } = await import('../config.js');
      console.log(LOGO);
      await runSetupWizard();
      return;
    }

    // Hardcore mode validation
    if (opts.grpo && !opts.grpoModel) {
      console.log(`${t.warning('⚠️')} GRPO enabled without --grpo-model. Using default.`);
    }
    if (opts.warRoom) {
      console.log(`${t.warning('🔥')} WAR ROOM MODE ACTIVATED — 19h sessions, full commitment`);
    }
    if (opts.binarySynth) {
      console.log(`${t.warning('⚡')} DIRECT BINARY SYNTHESIS enabled — bypassing compilers`);
    }

    const oneLine = messageParts.length > 0 ? messageParts.join(' ') : undefined;

    await startApp({
      provider: (opts.provider as string) as ProviderName | undefined,
      model: opts.model as string | undefined,
      cwd: (opts.dir as string) || process.cwd(),
      oneLine,
      branch: opts.branch as string | undefined,
      merge: opts.merge as string | undefined,
      grpo: opts.grpo as boolean | undefined,
      grpoModel: opts.grpoModel as string | undefined,
      mineBugs: opts.mineBugs as boolean | undefined,
      bugSource: opts.bugSource as string | undefined,
      warRoom: opts.warRoom as boolean | undefined,
      binarySynth: opts.binarySynth as boolean | undefined,
      binaryArch: opts.arch as string | undefined,
      binaryOptimizer: opts.optimizer as string | undefined,
    });
  });

program.parse();
