// TIMPS Planning Mode
// Like Claude Code: plan mode separate from execution

export type PlanningMode = 'planning' | 'executing' | 'interactive';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
  tool_calls?: string[];
  result?: string;
  error?: string;
}

export interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  mode: PlanningMode;
  createdAt: number;
}

export class PlanningEngine {
  private currentPlan: Plan | null = null;
  
  // Create new plan
  createPlan(title: string, steps: string[]): Plan {
    const plan: Plan = {
      id: `plan_${Date.now()}`,
      title,
      steps: steps.map((description, i) => ({
        id: `step_${i}`,
        description,
        status: 'pending',
      })),
      mode: 'planning',
      createdAt: Date.now(),
    };
    
    this.currentPlan = plan;
    return plan;
  }
  
  // Get current plan
  getPlan(): Plan | null {
    return this.currentPlan;
  }
  
  // Enter plan mode
  enterPlanMode(title?: string): Plan {
    if (!title) title = 'New plan';
    
    this.currentPlan = {
      id: `plan_${Date.now()}`,
      title,
      steps: [],
      mode: 'planning',
      createdAt: Date.now(),
    };
    
    return this.currentPlan;
  }
  
  // Exit plan mode
  exitPlanMode(): Plan | null {
    if (!this.currentPlan) return null;
    
    this.currentPlan.mode = 'executing';
    return this.currentPlan;
  }
  
  // Add step to plan
  addStep(description: string): PlanStep {
    if (!this.currentPlan) {
      throw new Error('No active plan');
    }
    
    const step: PlanStep = {
      id: `step_${this.currentPlan.steps.length}`,
      description,
      status: 'pending',
    };
    
    this.currentPlan.steps.push(step);
    return step;
  }
  
  // Update step status
  updateStep(stepId: string, status: PlanStep['status'], result?: string, error?: string): boolean {
    if (!this.currentPlan) return false;
    
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (!step) return false;
    
    step.status = status;
    if (result) step.result = result;
    if (error) step.error = error;
    
    return true;
  }
  
  // Get next pending step
  getNextStep(): PlanStep | null {
    if (!this.currentPlan) return null;
    
    return this.currentPlan.steps.find(s => s.status === 'pending') || null;
  }
  
  // Check if all steps complete
  isComplete(): boolean {
    if (!this.currentPlan) return false;
    
    return this.currentPlan.steps.every(s => s.status !== 'pending');
  }
  
  // Cancel plan
  cancelPlan(): void {
    if (this.currentPlan) {
      this.currentPlan.mode = 'interactive';
    }
  }
  
  // Build markdown for display
  toMarkdown(): string {
    if (!this.currentPlan) return '';
    
    let md = `# ${this.currentPlan.title}\n\n`;
    md += `Mode: ${this.currentPlan.mode}\n\n`;
    md += '## Steps:\n\n';
    
    for (let i = 0; i < this.currentPlan.steps.length; i++) {
      const step = this.currentPlan.steps[i];
      const statusIcon = {
        pending: '○',
        in_progress: '◐',
        done: '●',
        failed: '✕',
        skipped: '➜',
      }[step.status];
      
      md += `${i + 1}. ${statusIcon} ${step.description}\n`;
      if (step.result) {
        md += `   → ${step.result.slice(0, 100)}\n`;
      }
      if (step.error) {
        md += `   ✕ ${step.error}\n`;
      }
    }
    
    return md;
  }
}

// Singleton
export const planningEngine = new PlanningEngine();