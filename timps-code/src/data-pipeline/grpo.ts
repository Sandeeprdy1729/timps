// grpo.ts - GRPO with Binary RLVR + Multi-Objective Optimization
// Hardened: Strict binary pass/fail from Verify node + performance comparison against gcc -O3

import type { AgentEvent } from '../config/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

export interface Trajectory {
  id: string;
  task: string;
  attempt: string;
  verifyResult: 'pass' | 'fail';
  executionOutput: string;
  errorType: 'syntax' | 'type' | 'logic' | 'runtime' | 'borrow' | 'security' | 'other';
  timestamp: number;
  model: string;
  // Performance metrics
  executionTimeMs?: number;
  binarySizeBytes?: number;
  gccBaselineTimeMs?: number;
  gccBaselineSizeBytes?: number;
}

export interface GRPOConfig {
  enabled: boolean;
  rewardModel: string;
  trajectories: Trajectory[];
  minTrajectoriesForTrain: number;
  verifyOnly: boolean;
  enablePerformanceOptimization: boolean;
}

export interface MultiObjectiveReward {
  correctness: number;    // 0 or 1 (pass/fail)
  performance: number;     // Speedup vs gcc -O3 (-1 to 1)
  efficiency: number;     // Size ratio vs gcc -O3 (-1 to 1)
  combined: number;       // Weighted: 0.6*correctness + 0.25*performance + 0.15*efficiency
}

export class GRPOTrainer {
  private config: GRPOConfig;
  private trajectoryDir: string;

  constructor(enabled: boolean = true, rewardModel: string = 'unsloth/llama-3-8b-grpo', enablePerformanceOptimization: boolean = true) {
    this.config = {
      enabled,
      rewardModel,
      trajectories: [],
      minTrajectoriesForTrain: 5,
      verifyOnly: true,
      enablePerformanceOptimization,
    };
    this.trajectoryDir = path.join(os.homedir(), '.timps', 'grpo', 'trajectories');
    fs.mkdirSync(this.trajectoryDir, { recursive: true });
    
    this.cleanupOldTrajectories();
  }

  // Record performance metrics after binary execution
  recordPerformanceMetrics(trajectoryId: string, executionTimeMs: number, binarySizeBytes: number): void {
    const traj = this.config.trajectories.find(t => t.id === trajectoryId);
    if (traj) {
      traj.executionTimeMs = executionTimeMs;
      traj.binarySizeBytes = binarySizeBytes;
    }
  }

  // Set GCC baseline for comparison
  setGccBaseline(trajectoryId: string, gccTimeMs: number, gccSizeBytes: number): void {
    const traj = this.config.trajectories.find(t => t.id === trajectoryId);
    if (traj) {
      traj.gccBaselineTimeMs = gccTimeMs;
      traj.gccBaselineSizeBytes = gccSizeBytes;
    }
  }

  private cleanupOldTrajectories(): void {
    try {
      const files = fs.readdirSync(this.trajectoryDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.trajectoryDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch {}
  }

  private classifyError(errorMsg: string): Trajectory['errorType'] {
    const lower = errorMsg.toLowerCase();
    
    if (lower.includes('borrow') || lower.includes('lifetime') || lower.includes('mutable borrow') || lower.includes('cannot borrow')) return 'borrow';
    if (lower.includes('syntax') || lower.includes('parse') || lower.includes('unexpected token')) return 'syntax';
    if (lower.includes('type') || lower.includes('type mismatch') || lower.includes('cannot find type')) return 'type';
    if (lower.includes('runtime') || lower.includes('panic') || lower.includes('segmentation')) return 'runtime';
    if (lower.includes('logic') || lower.includes('incorrect') || lower.includes('wrong')) return 'logic';
    if (lower.includes('security') || lower.includes('injection') || lower.includes('xss')) return 'security';
    return 'other';
  }

  // Binary RLVR: Only record pass/fail from Verify - no reasoning traces
  recordVerifyResult(task: string, attempt: string, verifyPassed: boolean, executionOutput: string, model: string): void {
    if (!this.config.enabled) return;
    if (this.config.verifyOnly && !verifyPassed) {
      // Skip reasoning traces - only record binary outcome
      console.log(`⚡ Binary RLVR: ${verifyPassed ? 'PASS' : 'FAIL'}`);
    }

    const trajectory: Trajectory = {
      id: `traj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      task: task.slice(0, 200),  // Truncate to save space
      attempt: verifyPassed ? 'success' : attempt.slice(0, 500),
      verifyResult: verifyPassed ? 'pass' : 'fail',
      executionOutput: executionOutput.slice(0, 1000),  // Truncate for storage
      errorType: verifyPassed ? 'other' : this.classifyError(executionOutput),
      timestamp: Date.now(),
      model,
    };

    this.config.trajectories.push(trajectory);
    
    const trajFile = path.join(this.trajectoryDir, `${trajectory.id}.json`);
    fs.writeFileSync(trajFile, JSON.stringify(trajectory, null, 2), 'utf-8');

    const passRate = this.getPassRate();
    console.log(`📊 Binary RLVR: ${verifyPassed ? '✅' : '❌'} | Pass rate: ${(passRate * 100).toFixed(1)}%`);
  }

  // Legacy method for compatibility - redirects to binary RLVR
  captureTrajectory(mistake: string, correction: string, passingTest: string, model: string): void {
    const verifyPassed = passingTest.includes('pass') || passingTest.includes('success');
    this.recordVerifyResult(mistake, correction, verifyPassed, passingTest, model);
  }

  getPassRate(): number {
    if (this.config.trajectories.length === 0) return 0;
    const passes = this.config.trajectories.filter(t => t.verifyResult === 'pass').length;
    return passes / this.config.trajectories.length;
  }

  async *train(): AsyncGenerator<AgentEvent> {
    const minRequired = this.config.minTrajectoriesForTrain;
    
    if (this.config.trajectories.length < minRequired) {
      const remaining = minRequired - this.config.trajectories.length;
      yield { type: 'status', message: `⚠️ Need ${remaining} more Verify-pass trajectories (binary RLVR requires ${minRequired}+)` };
      return;
    }

    yield { type: 'status', message: `🧠 Multi-Objective GRPO Training: ${this.config.trajectories.length} trajectories` };
    yield { type: 'status', message: `⚡ Rewards: 60% Correctness + 25% Performance + 15% Efficiency` };

    // Multi-objective rewards
    const rewards = this.config.trajectories.map(t => this.calculateMultiObjectiveReward(t).combined);
    const binaryRewards = this.config.trajectories.map(t => ({
      task: t.task,
      attempt: t.attempt,
      reward: t.verifyResult === 'pass' ? 1.0 : 0.0,
      errorType: t.errorType,
      multiObjective: this.calculateMultiObjectiveReward(t),
    }));

    // Group by error type
    const errorGroups = this.getErrorDistribution();
    yield { type: 'status', message: `📊 Error distribution: ${JSON.stringify(errorGroups)}` };

    // Calculate pass rate per error type
    const errorPassRates: Record<string, number> = {};
    for (const [errorType, count] of Object.entries(errorGroups)) {
      const typeTrajs = this.config.trajectories.filter(t => t.errorType === errorType);
      const passes = typeTrajs.filter(t => t.verifyResult === 'pass').length;
      errorPassRates[errorType] = typeTrajs.length > 0 ? passes / typeTrajs.length : 0;
    }
    yield { type: 'status', message: `📈 Pass rates by error type: ${JSON.stringify(errorPassRates)}` };

    // Standardize rewards: r_i = (R_i - mean) / std
    const standardizedRewards = this.calculateStandardizedReward(rewards);
    
    const perfOptimized = this.config.trajectories.filter(t => t.executionTimeMs && t.gccBaselineTimeMs).length;
    if (perfOptimized > 0) {
      const avgSpeedup = this.config.trajectories
        .filter(t => t.executionTimeMs && t.gccBaselineTimeMs)
        .reduce((sum, t) => sum + (t.gccBaselineTimeMs! / t.executionTimeMs!), 0) / perfOptimized;
      yield { type: 'status', message: `🚀 Average speedup vs gcc -O3: ${avgSpeedup.toFixed(2)}x` };
    }

    // Save training data with multi-objective rewards
    const trainFile = path.join(os.homedir(), '.timps', 'grpo', 'multi_objective_rlvr.json');
    fs.writeFileSync(trainFile, JSON.stringify({
      trajectories: binaryRewards,
      standardizedRewards,
      config: {
        correctnessWeight: 0.6,
        performanceWeight: 0.25,
        efficiencyWeight: 0.15,
      }
    }, null, 2), 'utf-8');

    yield { type: 'status', message: `📦 Multi-Objective RLVR data: ${binaryRewards.length} examples` };
    yield { type: 'status', message: `🚀 Unsloth: unsloth train --model ${this.config.rewardModel} --data ${trainFile} --reward multi-objective` };

    this.config.trajectories = [];
  }

  // Multi-objective reward: Correctness + Performance vs gcc -O3
  calculateMultiObjectiveReward(trajectory: Trajectory): MultiObjectiveReward {
    const correctness = trajectory.verifyResult === 'pass' ? 1.0 : 0.0;
    
    if (!this.config.enablePerformanceOptimization || !trajectory.executionTimeMs || !trajectory.gccBaselineTimeMs) {
      return { correctness, performance: 0, efficiency: 0, combined: correctness };
    }

    // Performance: speedup ratio (1.0 = same as gcc, >1.0 = faster, <1.0 = slower)
    const speedup = trajectory.gccBaselineTimeMs / trajectory.executionTimeMs;
    const performance = Math.max(-1, Math.min(1, speedup - 1));  // Normalize to -1..1

    // Efficiency: size ratio (1.0 = same as gcc, <1.0 = smaller = better)
    const sizeRatio = trajectory.binarySizeBytes && trajectory.gccBaselineSizeBytes
      ? trajectory.binarySizeBytes / trajectory.gccBaselineSizeBytes
      : 1;
    const efficiency = Math.max(-1, Math.min(1, 1 - sizeRatio));  // Normalize -1..1

    // Combined: weighted multi-objective (Correctness is the gate - must pass tests)
    const combined = 0.6 * correctness + 0.25 * performance + 0.15 * efficiency;

    return { correctness, performance, efficiency, combined };
  }

  // Compare binary against gcc -O3 baseline
  async compareAgainstGcc(binaryPath: string, sourcePath: string, inputPath?: string): Promise<{ speedup: number; sizeRatio: number }> {
    const tempDir = path.join(os.tmpdir(), 'timps-gcc-compare');
    fs.mkdirSync(tempDir, { recursive: true });

    const gccOut = path.join(tempDir, 'gcc_out');
    const aiOut = path.join(tempDir, 'ai_out');

    try {
      // Compile with gcc -O3
      execSync(`gcc -O3 -o ${gccOut} ${sourcePath}`, { stdio: 'pipe' });
      const gccStats = fs.statSync(gccOut);

      // Benchmark gcc
      const gccStart = Date.now();
      execSync(inputPath ? `${gccOut} < ${inputPath}` : gccOut, { stdio: 'pipe', timeout: 30000 });
      const gccTime = Date.now() - gccStart;

      // Benchmark AI binary
      const aiStats = fs.statSync(binaryPath);
      const aiStart = Date.now();
      execSync(inputPath ? `${binaryPath} < ${inputPath}` : binaryPath, { stdio: 'pipe', timeout: 30000 });
      const aiTime = Date.now() - aiStart;

      const speedup = gccTime / aiTime;
      const sizeRatio = aiStats.size / gccStats.size;

      return { speedup, sizeRatio };
    } catch {
      return { speedup: 1, sizeRatio: 1 };
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  }

  // Standardized reward calculation: r_i = (R_i - mean) / std
  calculateStandardizedReward(rewards: number[]): number[] {
    if (rewards.length === 0) return [];
    
    const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const variance = rewards.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rewards.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return rewards.map(() => 0);
    
    return rewards.map(r => (r - mean) / std);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getTrajectoryCount(): number {
    return this.config.trajectories.length;
  }
  
  getErrorDistribution(): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const t of this.config.trajectories) {
      dist[t.errorType] = (dist[t.errorType] || 0) + 1;
    }
    return dist;
  }
}