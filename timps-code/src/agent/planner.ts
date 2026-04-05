// agent/planner.ts - Planning Agent
// Multi-step planning with verification checkpoints and plan persistence

import type { Message } from '../types.js';

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  currentStep: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependsOn?: string[];
  verification?: string;
  result?: string;
  attempts: number;
}

export class Planner {
  private currentPlan: Plan | null = null;
  private planMode: boolean = false;

  async createPlan(goal: string): Promise<Plan | null> {
    this.currentPlan = {
      id: `plan_${Date.now()}`,
      goal,
      steps: [],
      currentStep: 0,
      status: 'planning',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.planMode = true;
    return this.currentPlan;
  }

  async addStep(description: string, dependsOn?: string[]): Promise<PlanStep> {
    if (!this.currentPlan) throw new Error('No active plan');

    const step: PlanStep = {
      id: `step_${this.currentPlan.steps.length + 1}`,
      description,
      status: 'pending',
      dependsOn,
      attempts: 0,
    };

    this.currentPlan.steps.push(step);
    return step;
  }

  getCurrentPlan(): Plan | null {
    return this.currentPlan;
  }

  getNextExecutableStep(): PlanStep | null {
    if (!this.currentPlan) return null;

    const pending = this.currentPlan.steps.filter(s => s.status === 'pending');
    
    for (const step of pending) {
      const deps = step.dependsOn || [];
      const depsCompleted = deps.every(depId => {
        const dep = this.currentPlan!.steps.find(s => s.id === depId);
        return dep?.status === 'completed';
      });

      if (depsCompleted) return step;
    }

    return null;
  }

  markStepComplete(stepId: string, result?: string): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'completed';
      step.result = result;
      this.currentPlan.updatedAt = Date.now();
    }
  }

  markStepFailed(stepId: string): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'failed';
      step.attempts++;
      this.currentPlan.updatedAt = Date.now();
    }
  }

  isPlanComplete(): boolean {
    if (!this.currentPlan) return false;
    return this.currentPlan.steps.every(s => s.status === 'completed' || s.status === 'failed');
  }

  getProgress(): { total: number; completed: number; failed: number } {
    if (!this.currentPlan) return { total: 0, completed: 0, failed: 0 };
    
    return {
      total: this.currentPlan.steps.length,
      completed: this.currentPlan.steps.filter(s => s.status === 'completed').length,
      failed: this.currentPlan.steps.filter(s => s.status === 'failed').length,
    };
  }

  exitPlanMode(): void {
    this.planMode = false;
  }

  isInPlanMode(): boolean {
    return this.planMode;
  }
}

export const planner = new Planner();
