// ── TIMPS Durable Job Engine — Persistent job execution ──
// Solves Context Window limitation: jobs survive process crashes,
// long-running tasks checkpoint progress, and resume from where they left off.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface JobStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
}

export interface DurableJob {
  id: string;
  title: string;
  originalRequest: string;
  projectHash: string;
  status: JobStatus;
  priority: number;         // 1-10, higher = more urgent
  steps: JobStep[];
  currentStepIdx: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedSteps?: number;
  context: Record<string, unknown>;    // Arbitrary state for resumption
  parentJobId?: string;               // For sub-jobs
  tags: string[];
  metadata: {
    filesChanged: string[];
    toolsUsed: string[];
    totalTurns: number;
    estimatedCost?: number;
  };
}

export interface JobCheckpoint {
  jobId: string;
  stepIdx: number;
  timestamp: number;
  messages: unknown[];     // Agent message history at this point
  memorySnapshot?: string; // Serialized relevant memory entries
}

const JOBS_DIR = path.join(os.homedir(), '.timps', 'jobs');

export class DurableJobEngine {
  private projectHash: string;
  private jobsPath: string;
  private checkpointsPath: string;
  private activeJobs = new Map<string, DurableJob>();

  constructor(projectHash: string) {
    this.projectHash = projectHash;
    this.jobsPath = path.join(JOBS_DIR, projectHash);
    this.checkpointsPath = path.join(this.jobsPath, 'checkpoints');
    fs.mkdirSync(this.checkpointsPath, { recursive: true });
    this.loadActiveJobs();
  }

  // ── Job lifecycle ──────────────────────────────────────────────────────────

  /** Create a new durable job */
  createJob(options: {
    title: string;
    originalRequest: string;
    steps?: Omit<JobStep, 'id' | 'status' | 'retryCount'>[];
    priority?: number;
    tags?: string[];
    estimatedSteps?: number;
    context?: Record<string, unknown>;
  }): DurableJob {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const steps: JobStep[] = (options.steps ?? []).map((s, i) => ({
      ...s,
      id: `step_${i}_${Math.random().toString(36).slice(2, 5)}`,
      status: 'pending',
      retryCount: 0,
      maxRetries: s.maxRetries ?? 3,
    }));

    const job: DurableJob = {
      id: jobId,
      title: options.title,
      originalRequest: options.originalRequest,
      projectHash: this.projectHash,
      status: 'queued',
      priority: options.priority ?? 5,
      steps,
      currentStepIdx: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      estimatedSteps: options.estimatedSteps,
      context: options.context ?? {},
      tags: options.tags ?? [],
      metadata: {
        filesChanged: [],
        toolsUsed: [],
        totalTurns: 0,
      },
    };

    this.activeJobs.set(jobId, job);
    this.persistJob(job);
    return job;
  }

  /** Start or resume a job */
  startJob(jobId: string): DurableJob | null {
    const job = this.activeJobs.get(jobId) ?? this.loadJob(jobId);
    if (!job) return null;

    if (job.status === 'completed' || job.status === 'cancelled') return job;

    job.status = 'running';
    job.startedAt = job.startedAt ?? Date.now();
    job.updatedAt = Date.now();
    this.persistJob(job);
    return job;
  }

  /** Record a step starting */
  beginStep(jobId: string, stepIdx: number): void {
    const job = this.activeJobs.get(jobId);
    if (!job || !job.steps[stepIdx]) return;

    job.steps[stepIdx].status = 'running';
    job.steps[stepIdx].startedAt = Date.now();
    job.currentStepIdx = stepIdx;
    job.updatedAt = Date.now();
    this.persistJob(job);
  }

  /** Record a step completing */
  completeStep(jobId: string, stepIdx: number, output: string, toolsUsed?: string[]): void {
    const job = this.activeJobs.get(jobId);
    if (!job || !job.steps[stepIdx]) return;

    const step = job.steps[stepIdx];
    step.status = 'completed';
    step.completedAt = Date.now();
    step.output = output.slice(0, 2000); // Cap output size

    if (toolsUsed) {
      for (const tool of toolsUsed) {
        if (!job.metadata.toolsUsed.includes(tool)) {
          job.metadata.toolsUsed.push(tool);
        }
      }
    }

    job.currentStepIdx = stepIdx + 1;
    job.updatedAt = Date.now();

    // Check if all steps done
    const allDone = job.steps.every(s => s.status === 'completed' || s.status === 'skipped');
    if (allDone) {
      job.status = 'completed';
      job.completedAt = Date.now();
    }

    this.persistJob(job);
  }

  /** Record a step failing */
  failStep(jobId: string, stepIdx: number, error: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || !job.steps[stepIdx]) return false;

    const step = job.steps[stepIdx];
    step.retryCount++;

    if (step.retryCount <= step.maxRetries) {
      // Can retry
      step.status = 'pending';
      step.error = error;
      job.status = 'paused';
      job.updatedAt = Date.now();
      this.persistJob(job);
      return true; // Indicates retry is possible
    }

    // Max retries exceeded
    step.status = 'failed';
    step.error = error;
    job.status = 'failed';
    job.updatedAt = Date.now();
    this.persistJob(job);
    return false;
  }

  /** Add a step dynamically (for tasks that discover more work) */
  addStep(jobId: string, step: Omit<JobStep, 'id' | 'status' | 'retryCount'>): string {
    const job = this.activeJobs.get(jobId);
    if (!job) return '';

    const stepId = `step_${job.steps.length}_${Math.random().toString(36).slice(2, 5)}`;
    const newStep: JobStep = {
      ...step,
      id: stepId,
      status: 'pending',
      retryCount: 0,
      maxRetries: step.maxRetries ?? 3,
    };

    job.steps.push(newStep);
    job.updatedAt = Date.now();
    this.persistJob(job);
    return stepId;
  }

  /** Record a file change */
  recordFileChange(jobId: string, filePath: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    if (!job.metadata.filesChanged.includes(filePath)) {
      job.metadata.filesChanged.push(filePath);
    }
    job.updatedAt = Date.now();
    this.persistJob(job);
  }

  /** Update job context (arbitrary state) */
  updateContext(jobId: string, context: Record<string, unknown>): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    Object.assign(job.context, context);
    job.updatedAt = Date.now();
    this.persistJob(job);
  }

  // ── Checkpointing ──────────────────────────────────────────────────────────

  /** Save a checkpoint at the current step */
  checkpoint(jobId: string, messages: unknown[], memorySnapshot?: string): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const checkpoint: JobCheckpoint = {
      jobId,
      stepIdx: job.currentStepIdx,
      timestamp: Date.now(),
      messages: messages.slice(-50), // Keep last 50 messages only
      memorySnapshot,
    };

    const cpPath = path.join(this.checkpointsPath, `${jobId}_${job.currentStepIdx}.json`);
    try {
      fs.writeFileSync(cpPath, JSON.stringify(checkpoint));
    } catch { /* ignore */ }
  }

  /** Load latest checkpoint for a job */
  loadCheckpoint(jobId: string): JobCheckpoint | null {
    const job = this.activeJobs.get(jobId) ?? this.loadJob(jobId);
    if (!job) return null;

    // Try current step, then previous steps
    for (let i = job.currentStepIdx; i >= 0; i--) {
      const cpPath = path.join(this.checkpointsPath, `${jobId}_${i}.json`);
      if (fs.existsSync(cpPath)) {
        try {
          return JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
        } catch { /* try previous */ }
      }
    }
    return null;
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  getJob(jobId: string): DurableJob | null {
    return this.activeJobs.get(jobId) ?? this.loadJob(jobId);
  }

  /** List incomplete jobs for this project */
  getIncompleteJobs(): DurableJob[] {
    const jobs: DurableJob[] = [];
    try {
      const files = fs.readdirSync(this.jobsPath).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const job = JSON.parse(
            fs.readFileSync(path.join(this.jobsPath, file), 'utf-8')
          ) as DurableJob;
          if (job.status !== 'completed' && job.status !== 'cancelled') {
            jobs.push(job);
          }
        } catch { /* skip corrupt */ }
      }
    } catch { /* no jobs dir */ }

    return jobs.sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt);
  }

  /** Get progress as percentage */
  getProgress(jobId: string): number {
    const job = this.getJob(jobId);
    if (!job || job.steps.length === 0) return 0;
    const done = job.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
    return Math.round((done / job.steps.length) * 100);
  }

  /** Format a progress summary for TUI */
  formatProgress(jobId: string): string {
    const job = this.getJob(jobId);
    if (!job) return '';

    const pct = this.getProgress(jobId);
    const done = job.steps.filter(s => s.status === 'completed').length;
    const failed = job.steps.filter(s => s.status === 'failed').length;
    const total = job.steps.length;

    let statusIcon = '🔄';
    if (job.status === 'completed') statusIcon = '✅';
    if (job.status === 'failed') statusIcon = '❌';
    if (job.status === 'paused') statusIcon = '⏸️';

    return `${statusIcon} ${job.title} [${pct}%] — ${done}/${total} steps${failed > 0 ? `, ${failed} failed` : ''}`;
  }

  /** Build a resumption prompt for the agent when resuming a paused job */
  buildResumptionPrompt(jobId: string): string {
    const job = this.getJob(jobId);
    if (!job) return '';

    const completedSteps = job.steps
      .filter(s => s.status === 'completed')
      .map(s => `- [x] ${s.description}`)
      .join('\n');

    const pendingSteps = job.steps
      .filter(s => s.status === 'pending' || s.status === 'running')
      .map(s => `- [ ] ${s.description}`)
      .join('\n');

    const failedSteps = job.steps
      .filter(s => s.status === 'failed')
      .map(s => `- [!] ${s.description}: ${s.error}`)
      .join('\n');

    return [
      `## Resuming Job: ${job.title}`,
      `Original request: "${job.originalRequest}"`,
      '',
      completedSteps ? `### Completed:\n${completedSteps}` : '',
      failedSteps ? `### Failed (needs retry):\n${failedSteps}` : '',
      pendingSteps ? `### Still to do:\n${pendingSteps}` : '',
      '',
      `Files already changed: ${job.metadata.filesChanged.join(', ') || 'none'}`,
      `Continue from where we left off.`,
    ].filter(Boolean).join('\n');
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private persistJob(job: DurableJob): void {
    try {
      fs.mkdirSync(this.jobsPath, { recursive: true });
      const filePath = path.join(this.jobsPath, `${job.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
      this.activeJobs.set(job.id, job);
    } catch { /* ignore */ }
  }

  private loadJob(jobId: string): DurableJob | null {
    try {
      const filePath = path.join(this.jobsPath, `${jobId}.json`);
      if (fs.existsSync(filePath)) {
        const job = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DurableJob;
        this.activeJobs.set(jobId, job);
        return job;
      }
    } catch { /* ignore */ }
    return null;
  }

  private loadActiveJobs(): void {
    try {
      if (!fs.existsSync(this.jobsPath)) return;
      const files = fs.readdirSync(this.jobsPath)
        .filter(f => f.endsWith('.json') && !f.startsWith('checkpoint'));

      for (const file of files) {
        try {
          const job = JSON.parse(
            fs.readFileSync(path.join(this.jobsPath, file), 'utf-8')
          ) as DurableJob;
          if (job.status === 'running' || job.status === 'queued') {
            // Mark running jobs as paused (they were interrupted)
            if (job.status === 'running') {
              job.status = 'paused';
              this.persistJob(job);
            }
            this.activeJobs.set(job.id, job);
          }
        } catch { /* skip */ }
      }
    } catch { /* no jobs yet */ }
  }
}
