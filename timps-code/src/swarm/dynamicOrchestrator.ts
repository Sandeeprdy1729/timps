// ── TIMPS Dynamic Multi-Agent Orchestrator ──
// Intelligent task decomposition and dynamic agent selection.
// Instead of always launching all 10 agents, this decomposes each task
// into the minimum necessary sub-tasks and spawns only required agents.
// Uses LLM-guided planning with DAG-based execution ordering.

import type { AgentRole } from './agents.js';
import type { ContextOrchestrator, TaskType } from '../core/contextOrchestrator.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface SubTask {
  id: string;
  role: AgentRole;
  title: string;
  description: string;
  status: SubTaskStatus;
  dependsOn: string[];        // IDs of sub-tasks that must complete first
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  optional?: boolean;         // If true, failure doesn't block the plan
}

export interface ExecutionPlan {
  id: string;
  taskDescription: string;
  taskType: TaskType;
  subTasks: SubTask[];
  estimatedDuration: number;  // ms
  createdAt: number;
  completedAt?: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

export interface OrchestratorResult {
  plan: ExecutionPlan;
  outputs: Map<string, string>;
  totalDuration: number;
  successful: boolean;
  summary: string;
}

// ── Role → Task Type Mapping ───────────────────────────────────────────────

// Which agent roles are relevant for each task type
const TASK_TYPE_ROLES: Record<TaskType, AgentRole[]> = {
  'bug-fix':         ['code_generator', 'qa_tester', 'code_reviewer'],
  'feature':         ['architect', 'code_generator', 'qa_tester', 'code_reviewer', 'docs_writer'],
  'refactor':        ['architect', 'code_generator', 'code_reviewer', 'qa_tester'],
  'test-writing':    ['qa_tester', 'code_generator'],
  'documentation':   ['docs_writer', 'code_reviewer'],
  'architecture':    ['architect', 'product_manager', 'code_reviewer'],
  'security-audit':  ['security_auditor', 'code_reviewer'],
  'performance':     ['performance_optimizer', 'code_reviewer', 'qa_tester'],
  'exploration':     ['code_reviewer', 'docs_writer'],
  'deployment':      ['devops', 'qa_tester'],
  'general':         ['code_generator', 'code_reviewer'],
};

// Which roles should be parallelized vs sequential
const SEQUENTIAL_ROLES: AgentRole[] = ['architect', 'product_manager', 'orchestrator'];
const PARALLEL_ROLES: AgentRole[] = [
  'code_generator', 'qa_tester', 'docs_writer',
  'security_auditor', 'performance_optimizer',
];

// ── Dynamic Orchestrator ───────────────────────────────────────────────────

export class DynamicOrchestrator {
  private activePlans = new Map<string, ExecutionPlan>();
  private executors = new Map<string, (task: SubTask) => Promise<string>>();

  constructor() {}

  /**
   * Register an executor function for a specific role.
   * The executor receives a SubTask and returns its output.
   */
  registerExecutor(role: AgentRole, executor: (task: SubTask) => Promise<string>): void {
    this.executors.set(role, executor);
  }

  // ── Plan building ──────────────────────────────────────────────────────────

  /**
   * Build an execution plan for a task without running it.
   * Uses the task type to select and order relevant agents.
   */
  buildPlan(
    taskDescription: string,
    taskType: TaskType,
    options: {
      includeOptional?: boolean;
      maxAgents?: number;
      forceRoles?: AgentRole[];
    } = {}
  ): ExecutionPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const roles = this.selectRoles(taskType, options);
    const subTasks = this.buildDAG(roles, taskDescription, taskType);

    const plan: ExecutionPlan = {
      id: planId,
      taskDescription,
      taskType,
      subTasks,
      estimatedDuration: this.estimateDuration(subTasks),
      createdAt: Date.now(),
      status: 'planning',
    };

    this.activePlans.set(planId, plan);
    return plan;
  }

  /**
   * Execute an already-built plan.
   */
  async executePlan(
    plan: ExecutionPlan,
    onProgress?: (task: SubTask) => void
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const outputs = new Map<string, string>();
    plan.status = 'executing';

    try {
      await this.executeDAG(plan, outputs, onProgress);
      plan.status = 'completed';
      plan.completedAt = Date.now();

      const summary = this.buildSummary(plan, outputs);

      return {
        plan,
        outputs,
        totalDuration: Date.now() - startTime,
        successful: plan.subTasks.every(t => t.status === 'completed' || t.optional),
        summary,
      };
    } catch (err) {
      plan.status = 'failed';
      plan.completedAt = Date.now();

      return {
        plan,
        outputs,
        totalDuration: Date.now() - startTime,
        successful: false,
        summary: `Plan failed: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Build a plan and execute it in one step.
   */
  async orchestrate(
    taskDescription: string,
    taskType: TaskType,
    options: {
      includeOptional?: boolean;
      maxAgents?: number;
      forceRoles?: AgentRole[];
      onProgress?: (task: SubTask) => void;
    } = {}
  ): Promise<OrchestratorResult> {
    const plan = this.buildPlan(taskDescription, taskType, options);
    return this.executePlan(plan, options.onProgress);
  }

  // ── Role selection ─────────────────────────────────────────────────────────

  private selectRoles(
    taskType: TaskType,
    options: { includeOptional?: boolean; maxAgents?: number; forceRoles?: AgentRole[] }
  ): AgentRole[] {
    if (options.forceRoles && options.forceRoles.length > 0) {
      return options.forceRoles;
    }

    let roles = [...(TASK_TYPE_ROLES[taskType] ?? TASK_TYPE_ROLES.general)];

    // Always include orchestrator for complex tasks
    if (roles.length > 3 && !roles.includes('orchestrator')) {
      roles.unshift('orchestrator');
    }

    // Cap at maxAgents if specified
    if (options.maxAgents && roles.length > options.maxAgents) {
      // Prioritize: keep first N roles (ordered by importance in the map)
      roles = roles.slice(0, options.maxAgents);
    }

    return [...new Set(roles)]; // Deduplicate
  }

  // ── DAG construction ───────────────────────────────────────────────────────

  private buildDAG(roles: AgentRole[], taskDescription: string, taskType: TaskType): SubTask[] {
    const tasks: SubTask[] = [];
    const idByRole = new Map<AgentRole, string>();

    for (const role of roles) {
      const id = `subtask_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`;
      idByRole.set(role, id);
    }

    for (const role of roles) {
      const id = idByRole.get(role)!;
      const dependsOn = this.getDependencies(role, roles, idByRole);

      tasks.push({
        id,
        role,
        title: this.getRoleTitle(role, taskType),
        description: this.getRoleDescription(role, taskDescription, taskType),
        status: 'pending',
        dependsOn,
        optional: this.isOptionalRole(role, taskType),
      });
    }

    return tasks;
  }

  private getDependencies(
    role: AgentRole,
    allRoles: AgentRole[],
    idByRole: Map<AgentRole, string>
  ): string[] {
    const deps: string[] = [];

    // Orchestrator is always first
    if (role !== 'orchestrator' && allRoles.includes('orchestrator')) {
      deps.push(idByRole.get('orchestrator')!);
    }

    // Architect must run before code_generator
    if (role === 'code_generator' && allRoles.includes('architect')) {
      deps.push(idByRole.get('architect')!);
    }

    // code_reviewer depends on code_generator
    if (role === 'code_reviewer' && allRoles.includes('code_generator')) {
      deps.push(idByRole.get('code_generator')!);
    }

    // qa_tester depends on code_generator
    if (role === 'qa_tester' && allRoles.includes('code_generator')) {
      deps.push(idByRole.get('code_generator')!);
    }

    // security_auditor and performance_optimizer can run after code_generator
    if ((role === 'security_auditor' || role === 'performance_optimizer') &&
        allRoles.includes('code_generator')) {
      deps.push(idByRole.get('code_generator')!);
    }

    // docs_writer runs after code_reviewer
    if (role === 'docs_writer' && allRoles.includes('code_reviewer')) {
      deps.push(idByRole.get('code_reviewer')!);
    }

    // devops depends on qa_tester passing
    if (role === 'devops' && allRoles.includes('qa_tester')) {
      deps.push(idByRole.get('qa_tester')!);
    }

    return [...new Set(deps)].filter(Boolean);
  }

  // ── DAG execution ──────────────────────────────────────────────────────────

  private async executeDAG(
    plan: ExecutionPlan,
    outputs: Map<string, string>,
    onProgress?: (task: SubTask) => void
  ): Promise<void> {
    const maxIterations = plan.subTasks.length * 2; // Guard against infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const runnable = plan.subTasks.filter(t =>
        t.status === 'pending' && this.areDepsResolved(t, plan.subTasks)
      );

      if (runnable.length === 0) {
        // Check if we're done or deadlocked
        const pending = plan.subTasks.filter(t => t.status === 'pending');
        if (pending.length === 0) break; // All done

        // Check for failed deps causing non-optional tasks to be stuck
        const stuck = pending.filter(t =>
          t.dependsOn.some(depId => {
            const dep = plan.subTasks.find(s => s.id === depId);
            return dep?.status === 'failed' && !dep.optional;
          })
        );

        for (const task of stuck) {
          if (!task.optional) {
            task.status = 'skipped';
          }
        }

        break;
      }

      // Separate sequential and parallel tasks in this wave
      const sequentialTasks = runnable.filter(t => SEQUENTIAL_ROLES.includes(t.role));
      const parallelTasks = runnable.filter(t => PARALLEL_ROLES.includes(t.role));
      const otherTasks = runnable.filter(t =>
        !SEQUENTIAL_ROLES.includes(t.role) && !PARALLEL_ROLES.includes(t.role)
      );

      // Run sequential tasks one at a time
      for (const task of [...sequentialTasks, ...otherTasks]) {
        await this.executeSubTask(task, plan, outputs, onProgress);
      }

      // Run parallel tasks concurrently
      if (parallelTasks.length > 0) {
        await Promise.all(
          parallelTasks.map(task => this.executeSubTask(task, plan, outputs, onProgress))
        );
      }
    }
  }

  private async executeSubTask(
    task: SubTask,
    plan: ExecutionPlan,
    outputs: Map<string, string>,
    onProgress?: (task: SubTask) => void
  ): Promise<void> {
    task.status = 'running';
    task.startedAt = Date.now();
    onProgress?.(task);

    const executor = this.executors.get(task.role);

    if (!executor) {
      // No executor registered — mark as completed with placeholder
      task.result = `[${task.role}] No executor registered — skipped`;
      task.status = 'completed';
      task.completedAt = Date.now();
      outputs.set(task.id, task.result);
      onProgress?.(task);
      return;
    }

    // Inject context from completed dependencies
    const depContext = this.buildDepContext(task, plan, outputs);
    const enrichedTask = { ...task, description: `${task.description}\n\n${depContext}`.trim() };

    try {
      const result = await executor(enrichedTask);
      task.result = result;
      task.status = 'completed';
      task.completedAt = Date.now();
      outputs.set(task.id, result);
    } catch (err) {
      task.error = (err as Error).message;
      task.status = 'failed';
      task.completedAt = Date.now();

      if (!task.optional) {
        // Propagate failure to dependent tasks
        this.markDependentsFailed(task, plan);
      }
    }

    onProgress?.(task);
  }

  private areDepsResolved(task: SubTask, allTasks: SubTask[]): boolean {
    return task.dependsOn.every(depId => {
      const dep = allTasks.find(t => t.id === depId);
      if (!dep) return true; // Unknown dep — treat as resolved
      if (dep.status === 'completed') return true;
      if (dep.status === 'failed' && dep.optional) return true;
      if (dep.status === 'skipped') return true;
      return false;
    });
  }

  private markDependentsFailed(failedTask: SubTask, plan: ExecutionPlan): void {
    for (const task of plan.subTasks) {
      if (task.dependsOn.includes(failedTask.id) && task.status === 'pending') {
        task.status = 'skipped';
      }
    }
  }

  private buildDepContext(
    task: SubTask,
    plan: ExecutionPlan,
    outputs: Map<string, string>
  ): string {
    const depOutputs: string[] = [];

    for (const depId of task.dependsOn) {
      const output = outputs.get(depId);
      if (!output) continue;

      const dep = plan.subTasks.find(t => t.id === depId);
      if (dep) {
        const preview = output.length > 500 ? output.slice(0, 500) + '...' : output;
        depOutputs.push(`[${dep.role} output]:\n${preview}`);
      }
    }

    return depOutputs.length > 0
      ? `\n## Context from previous agents:\n${depOutputs.join('\n\n')}`
      : '';
  }

  // ── Plan analysis ──────────────────────────────────────────────────────────

  /**
   * Estimate total plan duration based on role complexity.
   */
  private estimateDuration(tasks: SubTask[]): number {
    const roleDurations: Partial<Record<AgentRole, number>> = {
      orchestrator: 5000,
      architect: 20000,
      product_manager: 10000,
      code_generator: 60000,
      code_reviewer: 30000,
      qa_tester: 45000,
      security_auditor: 30000,
      performance_optimizer: 25000,
      docs_writer: 20000,
      devops: 30000,
    };

    // Find critical path length
    let maxTime = 0;
    for (const task of tasks) {
      const roleTime = roleDurations[task.role] ?? 30000;
      const depTime = task.dependsOn.reduce((max, depId) => {
        const dep = tasks.find(t => t.id === depId);
        return dep ? Math.max(max, roleDurations[dep.role] ?? 30000) : max;
      }, 0);
      maxTime = Math.max(maxTime, depTime + roleTime);
    }

    return maxTime;
  }

  /**
   * Generate a concise summary of what was accomplished.
   */
  private buildSummary(plan: ExecutionPlan, outputs: Map<string, string>): string {
    const completed = plan.subTasks.filter(t => t.status === 'completed');
    const failed = plan.subTasks.filter(t => t.status === 'failed');
    const skipped = plan.subTasks.filter(t => t.status === 'skipped');

    const lines = [
      `Plan ${plan.id}: ${plan.taskType} task`,
      `Completed: ${completed.length}/${plan.subTasks.length} agents`,
    ];

    if (failed.length > 0) {
      lines.push(`Failed: ${failed.map(t => t.role).join(', ')}`);
    }
    if (skipped.length > 0) {
      lines.push(`Skipped: ${skipped.map(t => t.role).join(', ')}`);
    }

    // Add a brief summary from each completed task
    for (const task of completed) {
      const output = outputs.get(task.id) ?? '';
      const preview = output.split('\n')[0]?.slice(0, 80) ?? '';
      if (preview) lines.push(`  [${task.role}] ${preview}`);
    }

    return lines.join('\n');
  }

  /**
   * Get the current state of all active plans.
   */
  getActivePlans(): ExecutionPlan[] {
    return Array.from(this.activePlans.values()).filter(p => p.status === 'executing');
  }

  getPlan(planId: string): ExecutionPlan | undefined {
    return this.activePlans.get(planId);
  }

  // ── Role helpers ───────────────────────────────────────────────────────────

  private getRoleTitle(role: AgentRole, taskType: TaskType): string {
    const titles: Record<AgentRole, string> = {
      orchestrator: 'Plan & Coordinate',
      product_manager: 'Define Requirements',
      architect: 'Design Architecture',
      code_generator: 'Implement Code',
      code_reviewer: 'Review Code',
      qa_tester: 'Test & Validate',
      security_auditor: 'Security Audit',
      performance_optimizer: 'Optimize Performance',
      docs_writer: 'Write Documentation',
      devops: 'Deploy & Monitor',
    };
    return titles[role];
  }

  private getRoleDescription(role: AgentRole, taskDescription: string, taskType: TaskType): string {
    const prefixes: Record<AgentRole, string> = {
      orchestrator: `Decompose and coordinate the following task:\n`,
      product_manager: `Define clear requirements for:\n`,
      architect: `Design the architecture and approach for:\n`,
      code_generator: `Implement the following change:\n`,
      code_reviewer: `Review the implementation for:\n`,
      qa_tester: `Write and run tests for:\n`,
      security_auditor: `Perform security audit on:\n`,
      performance_optimizer: `Identify and fix performance issues in:\n`,
      docs_writer: `Write documentation for:\n`,
      devops: `Set up deployment for:\n`,
    };
    return `${prefixes[role] ?? ''}${taskDescription}`;
  }

  private isOptionalRole(role: AgentRole, taskType: TaskType): boolean {
    const alwaysRequired: AgentRole[] = ['code_generator', 'architect'];
    if (alwaysRequired.includes(role)) return false;

    const optionalByType: Partial<Record<TaskType, AgentRole[]>> = {
      'bug-fix': ['docs_writer', 'product_manager'],
      'test-writing': ['docs_writer', 'product_manager', 'architect'],
      'documentation': ['qa_tester', 'security_auditor', 'performance_optimizer'],
      'exploration': ['code_generator', 'qa_tester', 'security_auditor'],
    };

    return optionalByType[taskType]?.includes(role) ?? false;
  }
}

// ── Convenience factory ────────────────────────────────────────────────────

/**
 * Create a DynamicOrchestrator with a simple string-output executor per role.
 * Useful for testing and when you want to inject custom logic per role.
 */
export function createDynamicOrchestrator(
  executors: Partial<Record<AgentRole, (task: SubTask) => Promise<string>>>
): DynamicOrchestrator {
  const orchestrator = new DynamicOrchestrator();
  for (const [role, executor] of Object.entries(executors)) {
    orchestrator.registerExecutor(role as AgentRole, executor as (task: SubTask) => Promise<string>);
  }
  return orchestrator;
}
