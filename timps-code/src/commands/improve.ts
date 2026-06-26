// ── timps-code — Self-Improving Agent Loop Commands ──
// Phase 6c: Self-Improving Agent Loop

import { SelfImprovingAgent } from '../agent/selfImprovingAgent.js';
import { GRPOTrainer } from '../data-pipeline/grpo.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface ImproveOptions {
  report?: boolean;
  train?: boolean;
  minOccurrences?: number;
  outputDir?: string;
}

export async function runImproveCommand(projectHash: string, options: ImproveOptions): Promise<string> {
  const agent = new SelfImprovingAgent(projectHash);
  const lines: string[] = [];

  const report = agent.buildLearningReport();
  lines.push(`Self-Improvement Report`);
  lines.push(`  Total mistakes tracked: ${report.totalMistakes}`);
  lines.push(`  Improvement score: ${report.improvementScore}/100`);
  lines.push(`  Session mistakes: ${agent['sessionMistakes'].length}`);
  lines.push('');

  if (report.topCategories.length > 0) {
    lines.push('Top Mistake Categories:');
    for (const cat of report.topCategories) {
      lines.push(`  ${cat.category}: ${cat.count} occurrences`);
    }
    lines.push('');
  }

  if (report.recentMistakes.length > 0) {
    lines.push('Recent Mistakes:');
    for (const m of report.recentMistakes.slice(0, 3)) {
      lines.push(`  [${m.category}] ${m.description.slice(0, 60)}`);
    }
    lines.push('');
  }

  const improvements = agent.buildPromptImprovements();
  if (improvements.length > 0) {
    lines.push('Prompt Improvements:');
    for (const imp of improvements) {
      lines.push(`  • ${imp}`);
    }
    lines.push('');
  }

  if (options.report) {
    lines.push('System Prompt Additions:');
    const systemPrompt = agent.formatForSystemPrompt();
    lines.push(systemPrompt || '  (no learned behaviors yet)');
    lines.push('');
  }

  if (options.train) {
    const count = agent.generateTrainingData({
      minOccurrences: options.minOccurrences ?? 1,
      outputDir: options.outputDir,
    });
    lines.push(`Training Data: ${count} trajectories generated`);

    if (count > 0) {
      const trainer = new GRPOTrainer(true, 'unsloth/llama-3-8b-grpo', true);
      for (const mistake of agent['mistakes'].values()) {
        trainer.recordVerifyResult(
          mistake.description,
          mistake.correction || mistake.preventionHint,
          false,
          mistake.errorMessage,
          'self-improving-agent'
        );
      }
      lines.push(`GRPO Trainer: ${trainer.getTrajectoryCount()} trajectories loaded`);
      lines.push(`  Pass rate: ${(trainer.getPassRate() * 100).toFixed(1)}%`);
      lines.push(`  Error distribution: ${JSON.stringify(trainer.getErrorDistribution())}`);
      lines.push('');
      lines.push('To train: unsloth train --model <model> --data ~/.timps/grpo/multi_objective_rlvr.json');
    }
  }

  return lines.join('\n');
}

export async function runImproveTrainCommand(projectHash: string, outputDir?: string): Promise<string> {
  const agent = new SelfImprovingAgent(projectHash);
  const trainer = new GRPOTrainer(true, 'unsloth/llama-3-8b-grpo', true);
  const lines: string[] = [];

  let count = 0;
  for (const mistake of agent['mistakes'].values()) {
    trainer.recordVerifyResult(
      mistake.description,
      mistake.correction || mistake.preventionHint,
      false,
      mistake.errorMessage,
      'self-improving-agent'
    );
    count++;
  }

  const trajCount = trainer.getTrajectoryCount();
  lines.push(`GRPO Training Data Generation`);
  lines.push(`  Trajectories: ${trajCount}`);
  lines.push(`  Pass rate: ${(trainer.getPassRate() * 100).toFixed(1)}%`);
  lines.push(`  Error distribution: ${JSON.stringify(trainer.getErrorDistribution())}`);

  const outDir = outputDir ?? path.join(os.homedir(), '.timps', 'grpo');
  fs.mkdirSync(outDir, { recursive: true });
  const trainFile = path.join(outDir, 'self-improving_training_data.json');
  fs.writeFileSync(trainFile, JSON.stringify({
    generatedAt: Date.now(),
    projectHash,
    trajectories: trainer['config'].trajectories,
  }, null, 2));

  lines.push(`  Training data saved: ${trainFile}`);

  return lines.join('\n');
}

export async function runImprovePromptCommand(projectHash: string): Promise<string> {
  const agent = new SelfImprovingAgent(projectHash);
  const promptStr = agent.formatForSystemPrompt();
  if (!promptStr) {
    return 'No learned behaviors yet. Make some mistakes first.';
  }
  return promptStr;
}
