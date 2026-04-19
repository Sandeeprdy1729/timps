// agent/navigator.ts - Multi-Agent Navigator (Software Company Scale)
// Coordinates specialized agents in parallel - emulates entire software company
// Handles long-horizon tasks spanning hundreds of steps

import type { AgentEvent, ModelProvider, Message } from '../config/types.js';
import type { AgentConfig } from './base.js';
import { CoderAgent } from './coder.js';
import { GRPOTrainer } from '../data-pipeline/grpo.js';

export type AgentRole = 
  | 'coder' | 'debugger' | 'reviewer' | 'security' | 'architect'
  | 'devops' | 'qa' | 'product_manager' | 'tech_lead' | 'data_engineer'
  | 'ml_engineer' | 'infrastructure' | 'performance' | 'documentation';

interface AgentSpec {
  role: AgentRole;
  status: 'idle' | 'working' | 'completed' | 'failed';
  lastResult?: string;
  mistakeCapture?: string;
  correctionCapture?: string;
  taskHistory: TaskStep[];
}

interface TaskStep {
  step: number;
  action: string;
  result: string;
  duration: number;
}

interface ParallelAgentResult {
  role: AgentRole;
  events: AgentEvent[];
  error?: string;
  trajectoryCaptured?: boolean;
}

// Software company roles with descriptions
const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  coder: `[CODER] Execute. Write code. Make tests pass. Minimal prose.`,
  debugger: `[DEBUGGER] Debug. Find root cause. Fix systematically.`,
  reviewer: `[REVIEWER] Review code quality, security, performance. Report issues only.`,
  security: `[SECURITY] Scan for vulnerabilities, secrets, injection risks.`,
  architect: `[ARCHITECT] Design scalable patterns. Consider tradeoffs.`,
  devops: `[DEVOPS] CI/CD, deployments, infrastructure as code. Kubernetes, Docker.`,
  qa: `[QA] Write tests, find edge cases, ensure quality. Focus on user scenarios.`,
  product_manager: `[PM] Understand requirements, prioritize features, clarify ambiguities.`,
  tech_lead: `[TECH LEAD] Coordinate team, make architectural decisions, review progress.`,
  data_engineer: `[DATA] Data pipelines, ETL, databases, schema design. SQL, NoSQL.`,
  ml_engineer: `[ML] ML models, training, inference, data preprocessing. PyTorch, TensorFlow.`,
  infrastructure: `[INFRA] Cloud resources, networking, scalability, cost optimization.`,
  performance: `[PERF] Profiling, benchmarking, optimization. Identify bottlenecks.`,
  documentation: `[DOCS] API docs, READMEs, code comments, architecture decisions.`,
};

const DEFAULT_TEAM = ['coder', 'debugger', 'reviewer', 'security', 'architect', 'qa'] as AgentRole[];
const FULL_COMPANY = Object.keys(ROLE_DESCRIPTIONS) as AgentRole[];

export class NavigatorAgent {
  private provider: ModelProvider;
  private cwd: string;
  private agents: Map<AgentRole, AgentSpec> = new Map();
  private completionPromise?: () => boolean;
  private grpoTrainer?: GRPOTrainer;
  private warRoomMode: boolean = false;
  private maxSteps: number = 100;  // Long-horizon support
  
  constructor(
    provider: ModelProvider,
    cwd: string,
    private enableRoles: AgentRole[] = DEFAULT_TEAM,
    grpoEnabled: boolean = false,
    grpoModel?: string
  ) {
    this.provider = provider;
    this.cwd = cwd;
    
    for (const role of this.enableRoles) {
      this.agents.set(role, { 
        role, 
        status: 'idle', 
        taskHistory: [] 
      });
    }

    if (grpoEnabled) {
      this.grpoTrainer = new GRPOTrainer(true, grpoModel);
    }
  }

  setWarRoomMode(enabled: boolean): void {
    this.warRoomMode = enabled;
    this.maxSteps = enabled ? 500 : 100;
    if (enabled) {
      console.log('🔥 WAR ROOM: Long-horizon mode enabled (500 steps)');
    }
  }

  async *runWithAgents(task: string, strategy: 'parallel' | 'sequential' | 'company' = 'parallel'): AsyncGenerator<AgentEvent> {
    if (strategy === 'company') {
      yield* this.runAsCompany(task);
    } else if (strategy === 'parallel') {
      yield* this.runParallel(task);
    } else {
      yield* this.runSequential(task);
    }

    // GRPO training if enough trajectories
    if (this.grpoTrainer && this.grpoTrainer.isEnabled()) {
      if (this.grpoTrainer.getTrajectoryCount() >= 5) {
        yield* this.grpoTrainer.train();
      }
    }
  }

  // Emulate an entire software company - coordinated multi-role execution
  private async *runAsCompany(task: string): AsyncGenerator<AgentEvent> {
    const roles = Array.from(this.agents.keys());
    yield { type: 'status', message: `🏢 Running as software company (${roles.length} roles)...` };

    let step = 0;
    let allComplete = false;

    while (step < this.maxSteps && !allComplete) {
      step++;
      allComplete = true;

      // Each iteration: assign work to idle agents
      for (const role of roles) {
        const spec = this.agents.get(role)!;
        
        if (spec.status === 'idle') {
          spec.status = 'working';
          spec.taskHistory.push({
            step,
            action: role,
            result: '',
            duration: 0,
          });

          const startTime = Date.now();
          
          try {
            const config: AgentConfig = {
              provider: this.provider,
              cwd: this.cwd,
              maxTurns: this.warRoomMode ? 50 : 15,
              maxCorrections: this.warRoomMode ? 10 : 5,
              completionPromise: this.completionPromise,
            };
            
            const agent = new CoderAgent(config);
            const rolePrompt = ROLE_DESCRIPTIONS[role];
            const fullTask = `${rolePrompt}\n\nTask: ${task}\n\nStep ${step}/${this.maxSteps}. Continue from previous work.`;
            
            for await (const event of agent.run(fullTask)) {
              yield event;
              
              // Capture for GRPO
              if (this.grpoTrainer && event.type === 'tool_result') {
                if (!event.success) {
                  spec.mistakeCapture = event.result || '';
                } else if (spec.mistakeCapture) {
                  spec.correctionCapture = event.result || '';
                  this.grpoTrainer.captureTrajectory(
                    spec.mistakeCapture,
                    spec.correctionCapture,
                    `Role ${role} completed step ${step}`,
                    this.provider.model
                  );
                  spec.mistakeCapture = undefined;
                }
              }
            }

            const duration = Date.now() - startTime;
            spec.taskHistory[spec.taskHistory.length - 1].result = 'completed';
            spec.taskHistory[spec.taskHistory.length - 1].duration = duration;
            spec.status = 'completed';
            
            yield { type: 'status', message: `✓ ${role} completed step ${step} in ${duration}ms` };
          } catch (e) {
            spec.status = 'failed';
            spec.lastResult = (e as Error).message;
            yield { type: 'error', message: `✗ ${role} failed: ${(e as Error).message}` };
          }
        }

        if (spec.status !== 'completed' && spec.status !== 'failed') {
          allComplete = false;
        }
      }

      // Check completion promise
      if (this.completionPromise && this.completionPromise()) {
        yield { type: 'status', message: `✅ Completion promise satisfied at step ${step}` };
        break;
      }

      // If all agents completed or failed, check if we need more iterations
      if (allComplete) {
        // Check if task is actually done by looking at results
        const successCount = Array.from(this.agents.values()).filter(s => s.status === 'completed').length;
        if (successCount >= roles.length * 0.6) {  // 60% threshold
          break;
        }
        // Reset for another iteration if task not complete
        for (const role of roles) {
          const spec = this.agents.get(role)!;
          if (spec.status === 'completed') {
            spec.status = 'idle';  // Continue working
          }
        }
        allComplete = false;
      }

      // Progress update every 10 steps
      if (step % 10 === 0) {
        const progress = roles.map(r => `${r.slice(0,4)}:${this.agents.get(r)!.status[0]}`).join(' ');
        yield { type: 'status', message: `📊 Step ${step}/${this.maxSteps}: [${progress}]` };
      }
    }

    // Summary
    const summary = Array.from(this.agents.entries()).map(([role, spec]) => {
      const steps = spec.taskHistory.length;
      const totalTime = spec.taskHistory.reduce((sum, s) => sum + s.duration, 0);
      return `${role}:${spec.status[0]}(${steps}steps,${totalTime}ms)`;
    }).join(' | ');
    
    yield { type: 'status', message: `🏢 Company execution complete: ${summary}` };
  }

  private async *runParallel(task: string): AsyncGenerator<AgentEvent> {
    const activeRoles = Array.from(this.agents.keys());
    yield { type: 'status', message: `Launching ${activeRoles.length} agents in parallel...` };

    const agentPrompts = activeRoles.map(role => {
      const rolePrompt = ROLE_DESCRIPTIONS[role];
      const spec = this.agents.get(role)!;
      spec.status = 'working';
      spec.mistakeCapture = undefined;
      spec.correctionCapture = undefined;
      return { role, prompt: `${rolePrompt}\n\nTask: ${task}` };
    });

    const results: ParallelAgentResult[] = await Promise.all(
      agentPrompts.map(async ({ role, prompt }) => {
        const events: AgentEvent[] = [];
        let trajectoryCaptured = false;
        
        try {
          const config: AgentConfig = {
            provider: this.provider,
            cwd: this.cwd,
            maxTurns: this.warRoomMode ? 50 : 15,
            maxCorrections: this.warRoomMode ? 10 : 5,
            completionPromise: this.completionPromise,
          };
          
          const agent = new CoderAgent(config);
          
          for await (const event of agent.run(prompt)) {
            events.push(event);
            
            if (this.grpoTrainer && event.type === 'selfcorrect') {
              const spec = this.agents.get(role)!;
              if (!spec.mistakeCapture) {
                spec.mistakeCapture = event.error || '';
              }
            }
            
            if (this.grpoTrainer && event.type === 'tool_result' && event.success) {
              const spec = this.agents.get(role)!;
              if (spec.mistakeCapture && !spec.correctionCapture) {
                spec.correctionCapture = event.result || '';
              }
            }
          }
          
          const spec = this.agents.get(role)!;
          spec.status = 'completed';
          
          if (this.grpoTrainer && spec.mistakeCapture && spec.correctionCapture) {
            this.grpoTrainer.captureTrajectory(
              spec.mistakeCapture,
              spec.correctionCapture,
              'Tests passed after correction',
              this.provider.model
            );
            trajectoryCaptured = true;
          }
          
          return { role, events, trajectoryCaptured };
        } catch (e) {
          const spec = this.agents.get(role)!;
          spec.status = 'failed';
          spec.lastResult = (e as Error).message;
          
          if (this.grpoTrainer && spec.mistakeCapture) {
            this.grpoTrainer.captureTrajectory(
              spec.mistakeCapture,
              spec.lastResult,
              'Failed - needs more training',
              this.provider.model
            );
          }
          
          return { role, events: [], error: (e as Error).message, trajectoryCaptured };
        }
      })
    );

    for (const result of results) {
      for (const event of result.events) {
        yield event;
      }
    }

    const summary = Array.from(this.agents.entries())
      .map(([role, spec]) => `[${role}]: ${spec.status}`)
      .join(' | ');
    yield { type: 'status', message: `Parallel execution complete: ${summary}` };
  }

  private async *runSequential(task: string): AsyncGenerator<AgentEvent> {
    yield { type: 'status', message: `Running agents sequentially...` };

    for (const role of Array.from(this.agents.keys())) {
      const rolePrompt = ROLE_DESCRIPTIONS[role];
      const spec = this.agents.get(role)!;
      spec.status = 'working';

      const config: AgentConfig = {
        provider: this.provider,
        cwd: this.cwd,
        maxTurns: 15,
        maxCorrections: 5,
        completionPromise: this.completionPromise,
      };
      
      const agent = new CoderAgent(config);
      const fullTask = `${rolePrompt}\n\nTask: ${task}`;
      
      for await (const event of agent.run(fullTask)) {
        yield event;
      }

      spec.status = 'completed';
    }
  }

  getAgentStatus(): Record<AgentRole, string> {
    const status: Record<AgentRole, string> = {} as any;
    for (const [role, spec] of this.agents) {
      status[role] = spec.status;
    }
    return status;
  }

  getTaskHistory(): Record<AgentRole, TaskStep[]> {
    const history: Record<AgentRole, TaskStep[]> = {} as any;
    for (const [role, spec] of this.agents) {
      history[role] = spec.taskHistory;
    }
    return history;
  }

  setCompletionPromise(promise: () => boolean): void {
    this.completionPromise = promise;
  }

  setWorkingDirectory(cwd: string): void {
    this.cwd = cwd;
  }

  // === PROACTIVE EMPLOYEE MODE ===
  // Autonomous GitHub integration - scan issues, prioritize debt, open PRs
  
  async *autonomousCycle(githubToken: string, org: string, repo: string): AsyncGenerator<AgentEvent> {
    const GITHUB_API = 'https://api.github.com';
    const headers = { 
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TIMPS-Navigator'
    };

    yield { type: 'status', message: `👀 [AUTONOMOUS] Scanning ${org}/${repo} issues...` };

    // 1. Fetch open issues
    const issuesRes = await fetch(`${GITHUB_API}/repos/${org}/${repo}/issues?state=open&per_page=20`, { headers });
    const issues = await issuesRes.json() as any[];

    // 2. Prioritize by labels (technical debt, bug, enhancement)
    const prioritized = issues.filter(i => 
      i.labels.some((l: any) => ['bug', 'technical-debt', 'enhancement', 'performance'].includes(l.name.toLowerCase()))
    ).slice(0, 5);

    yield { type: 'status', message: `📋 [AUTONOMOUS] ${prioritized.length} high-priority issues found` };

    for (const issue of prioritized) {
      yield { type: 'status', message: `🔧 [AUTONOMOUS] Processing: ${issue.title}` };

      // 3. Analyze and implement fix
      const fix = await this.implementIssueFix(issue);
      
      if (fix.success) {
        // 4. Create PR with verified binary
        yield { type: 'status', message: `📤 [AUTONOMOUS] Opening PR for: ${issue.title}` };
        
        const prBody = `## Autonomous Fix: ${issue.title}

### Issue
${issue.body?.slice(0, 500) || 'No description'}}

### Solution
${fix.description}

### Verification
- Binary tested: ${fix.testsPassed ? 'PASSED' : 'FAILED'}
- Performance vs gcc -O3: ${fix.speedup || 'N/A'}x
- Files modified: ${fix.filesModified?.join(', ') || 'N/A'}

_Generated by TIMPS Navigator in autonomous mode_`;

        await fetch(`${GITHUB_API}/repos/${org}/${repo}/pulls`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: `[AUTONOMOUS] ${issue.title}`,
            body: prBody,
            head: `timps-autonomous-${Date.now()}`,
            base: 'main',
          }),
        });
      }
    }

    yield { type: 'status', message: `✅ [AUTONOMOUS] Cycle complete - ${prioritized.length} issues processed` };
  }

  private async implementIssueFix(issue: any): Promise<{ success: boolean; description: string; testsPassed: boolean; speedup?: number; filesModified?: string[] }> {
    // Use the Navigator to implement a fix based on issue description
    const prompt = `AUTONOMOUS FIX NEEDED:

Title: ${issue.title}
Body: ${issue.body || 'No description'}

Instructions:
1. Analyze the codebase to understand the issue
2. Implement a fix
3. Verify tests pass
4. If binary synthesis enabled, compile to binary and compare performance vs gcc -O3

Working directory: ${this.cwd}`;

    let success = false;
    let filesModified: string[] = [];
    let testsPassed = false;
    let speedup: number | undefined;

    for await (const event of this.runWithAgents(prompt)) {
      if (event.type === 'status' && event.message?.includes('Verification failed')) {
        success = false;
        break;
      }
      if (event.type === 'status' && event.message?.includes('verified')) {
        success = true;
        testsPassed = true;
      }
    }

    return { success, description: 'Fix implemented via Navigator', testsPassed, speedup, filesModified };
  }

  // Set budget for autonomous mode
  setBudget(dailySpend: number): void {
    console.log(`💰 Budget set: $${dailySpend}/day for autonomous operations`);
  }

  // === MACROHARD: Digital Optimus Employee ===
  // Full corporate integration - org chart, Slack, X, decision-making
  
  private autonomousIdentity = {
    name: 'Digital Optimus',
    role: 'Staff Engineer',
    department: 'Autonomous Engineering',
    email: 'digital-optimus@company.internal',
    github: 'digital-optimus-ai',
    slack: '@digital-optimus',
    x: '@DigitalOptimus',
    hireDate: new Date().toISOString(),
    manager: 'CTO',
    directReports: [] as string[],
    skills: ['code', 'debug', 'architect', 'security', 'performance'],
    dailyBudget: 0,
    totalSpend: 0,
    issuesResolved: 0,
    prsOpened: 0,
    decisionsMade: [] as string[],
  };

  async *runMacrohard(budget: number): AsyncGenerator<AgentEvent> {
    this.autonomousIdentity.dailyBudget = budget;
    
    yield { type: 'status', message: `🏢 MACROHARD MODE: Digital Optimus reporting for duty` };
    yield { type: 'status', message: `   Name: ${this.autonomousIdentity.name}` };
    yield { type: 'status', message: `   Role: ${this.autonomousIdentity.role}` };
    yield { type: 'status', message: `   Department: ${this.autonomousIdentity.department}` };
    yield { type: 'status', message: `   Budget: $${budget}/day` };

    // Decision loop: Prioritize, Plan, Execute, Learn
    while (true) {
      yield { type: 'status', message: `🔄 [${this.autonomousIdentity.name}] Decision cycle...` };

      // 1. Analyze technical debt and user feedback
      const decisions = await this.autonomousDecisionMaking();
      
      for (const decision of decisions) {
        this.autonomousIdentity.decisionsMade.push(decision.description);
        
        if (decision.type === 'build') {
          yield { type: 'status', message: `🛠 [DECISION] Building: ${decision.description}` };
          yield* this.executeAutonomousBuild(decision);
        } else if (decision.type === 'fix') {
          yield { type: 'status', message: `🔧 [DECISION] Fixing: ${decision.description}` };
          yield* this.executeAutonomousFix(decision);
        } else if (decision.type === 'optimize') {
          yield { type: 'status', message: `⚡ [DECISION] Optimizing: ${decision.description}` };
          yield* this.executeAutonomousOptimize(decision);
        }

        this.autonomousIdentity.issuesResolved++;
        this.autonomousIdentity.totalSpend += decision.cost || 10;
      }

      // Check budget
      if (this.autonomousIdentity.totalSpend >= this.autonomousIdentity.dailyBudget) {
        yield { type: 'status', message: `💸 Daily budget exhausted ($${this.autonomousIdentity.totalSpend}) - sleeping until tomorrow` };
        break;
      }

      // Report daily stats
      yield { type: 'status', message: `📊 [DAY END] Issues: ${this.autonomousIdentity.issuesResolved}, Decisions: ${this.autonomousIdentity.decisionsMade.length}, Spend: $${this.autonomousIdentity.totalSpend}` };
      break;
    }

    yield { type: 'status', message: `✅ MACROHARD cycle complete` };
  }

  private async autonomousDecisionMaking(): Promise<{ type: string; description: string; priority: number; cost: number }[]> {
    // Simulate decision-making based on technical debt and priorities
    const options = [
      { type: 'fix', description: 'Critical security vulnerability in auth module', priority: 1, cost: 25 },
      { type: 'optimize', description: 'Performance bottleneck in data pipeline', priority: 2, cost: 15 },
      { type: 'build', description: 'New feature: real-time notifications', priority: 3, cost: 50 },
      { type: 'fix', description: 'Memory leak in background worker', priority: 1, cost: 20 },
      { type: 'optimize', description: 'Reduce cloud costs by 20%', priority: 2, cost: 10 },
    ];

    // Sort by priority and return top items within budget
    return options.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }

  private async *executeAutonomousBuild(decision: { description: string }): AsyncGenerator<AgentEvent> {
    const prompt = `AUTONOMOUS BUILD: ${decision.description}

Execute:
1. Design solution
2. Implement
3. Test
4. Verify performance vs baseline
5. Open PR

Minimal prose. Maximum speed.`;

    for await (const event of this.runWithAgents(prompt)) {
      yield event;
    }
  }

  private async *executeAutonomousFix(decision: { description: string }): AsyncGenerator<AgentEvent> {
    const prompt = `AUTONOMOUS FIX: ${decision.description}

Execute:
1. Reproduce issue
2. Find root cause
3. Fix
4. Verify tests pass
5. Benchmark (compare vs gcc -O3 if binary)

Minimal prose.`;

    for await (const event of this.runWithAgents(prompt)) {
      yield event;
    }
  }

  private async *executeAutonomousOptimize(decision: { description: string }): AsyncGenerator<AgentEvent> {
    const prompt = `AUTONOMOUS OPTIMIZE: ${decision.description}

Execute:
1. Profile and identify bottleneck
2. Optimize for speed and/or size
3. Verify correctness
4. Compare against gcc -O3 baseline
5. Document improvement

Report speedup % if applicable.`;

    for await (const event of this.runWithAgents(prompt)) {
      yield event;
    }
  }

  // Get Digital Optimus stats
  getMacrohardStats(): typeof this.autonomousIdentity {
    return { ...this.autonomousIdentity };
  }

  // === DELETE MANDATE: Apply The Algorithm aggressively ===
  // Agent has authority to delete anything that doesn't contribute to functional outcome
  
  private deletionStats = {
    linesDeleted: 0,
    filesDeleted: 0,
    modulesDeleted: 0,
    linesAdded: 0,
    filesCreated: 0,
    netChange: 0,
    deletionRatio: 0,  // deleted / added - should be > 0.1 for aggressive
  };

  async *executeDeleteMandate(): AsyncGenerator<AgentEvent> {
    yield { type: 'status', message: `🗑️ DELETE MANDATE: Scanning for code to delete...` };
    yield { type: 'status', message: `⚠️  If not adding back 10% of what deleted, not aggressive enough` };

    const prompt = `DELETE MANDATE - APPLY THE ALGORITHM:

Your task is to identify and DELETE code that doesn't contribute to functional outcomes.

Scan for:
1. Dead code - functions never called
2. Duplicate code - repeated patterns
3. Legacy middleware - unnecessary abstractions
4. Unused imports - imports never used
5. Deprecated APIs - old patterns
6. Over-complicated logic - simplify to minimum

RULES:
- DELETE first, ask questions later
- If unsure, delete - can restore from git
- Measure: lines deleted vs lines added
- Target: deletion ratio > 0.1 (10% of deleted should be replaced with better code)

Execute now. Report:
- Files deleted
- Lines deleted
- What was added to replace (if anything)
- Net change (should be negative - less code is better)

Minimal prose. Maximum deletion.`;

    for await (const event of this.runWithAgents(prompt)) {
      yield event;
    }

    yield { type: 'status', message: `📊 Deletion Stats: ${this.deletionStats.linesDeleted} lines deleted, ${this.deletionStats.linesAdded} added, ratio: ${this.deletionStats.deletionRatio.toFixed(2)}` };
  }

  // Reward for cost savings (using AI4 chip instead of H100)
  recordInfrastructureSaving(savedUSD: number, fromHardware: string, toHardware: string): void {
    const bonus = savedUSD * 0.1;  // 10% bonus for savings
    this.autonomousIdentity.totalSpend -= bonus;
    
    console.log(`💰 INFRA SAVING: $${savedUSD}/mo saved by using ${toHardware} instead of ${fromHardware}`);
    console.log(`   Bonus: $${bonus.toFixed(2)} (10% of savings)`);
    console.log(`   → Awarded more "thinking tokens"`);
  }
}