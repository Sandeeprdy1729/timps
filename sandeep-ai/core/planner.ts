import { createModel, BaseModel } from '../models';
import { Message } from '../models/baseModel';
import { provenForge } from './provenForge';
import { VersionSelection } from './toolRouter';
import { chronosVeil } from './chronosVeil';
import { weaveForge } from './weaveForge';
import { skillWeave } from './skillWeave';
import { atomChain } from './atomChain';
import { policyMetabol } from './policyMetabol';
import { layerForge } from './layerForge';
import { echoForge } from './echoForge';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  dependsOn?: string[];
  versionContext?: string;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

export class Planner {
  private model: BaseModel;
  
  constructor() {
    this.model = createModel();
  }
  
  async createPlan(goal: string, context?: string, versionContext?: string): Promise<Plan> {
    const planningPrompt = `You are a task planner. Break down the user's goal into clear, executable steps.

Goal: ${goal}
${context ? `Context: ${context}` : ''}
${versionContext ? `Version/Provenance: ${versionContext}` : ''}

Return a JSON array of steps, where each step has:
- id: unique identifier (e.g., "step_1", "step_2")
- description: what this step does
- dependsOn: array of step IDs this depends on (empty if no dependencies)

Example format:
[
  {"id": "step_1", "description": "Search for relevant information", "dependsOn": []},
  {"id": "step_2", "description": "Analyze the information", "dependsOn": ["step_1"]}
]

Create a practical plan with 2-8 steps maximum.`;

    try {
      const response = await this.model.generate(
        [{ role: 'user', content: planningPrompt }],
        { max_tokens: 1000 }
      );
      
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const steps = JSON.parse(jsonMatch[0]);
        return {
          goal,
          steps: steps.map((s: any) => ({
            ...s,
            status: 'pending' as const,
          })),
          status: 'planning',
        };
      }
    } catch (error) {
      console.error('Planning failed:', error);
    }
    
    return {
      goal,
      steps: [{
        id: 'step_1',
        description: goal,
        status: 'pending',
      }],
      status: 'planning',
    };
  }
  
  async createVersionAwarePlan(
    goal: string,
    context?: string,
    versionSelection?: VersionSelection
  ): Promise<Plan> {
    let versionContext = '';
    
    if (versionSelection) {
      if (versionSelection.intent === 'lineage') {
        if (versionSelection.branch) {
          const latest = await provenForge.getLatestForBranch(versionSelection.branch, versionSelection.tier);
          if (latest) {
            const lineage = await provenForge.getLineage(latest.version_id, 5);
            versionContext = `Lineage history: ${lineage.map(v => v.slice(0, 8)).join(' → ')}`;
          }
        }
      } else if (versionSelection.intent === 'specific' && versionSelection.versionId) {
        const lineage = await provenForge.getLineage(versionSelection.versionId, 5);
        versionContext = `Viewing version ${versionSelection.versionId.slice(0, 8)} with lineage: ${lineage.map(v => v.slice(0, 8)).join(' → ')}`;
      } else if (versionSelection.intent === 'latest') {
        versionContext = await provenForge.buildVersionContext(versionSelection.branch, versionSelection.tier);
      } else if (versionSelection.intent === 'merge') {
        versionContext = `[ProvenForge] Merge intent for branch: ${versionSelection.branch}`;
      }
    }
    
    return this.createPlan(goal, context, versionContext);
  }

  async createEvolutionAwarePlan(
    goal: string,
    userId: number,
    projectId: string = 'default',
    context?: string,
    intent: string = 'general'
  ): Promise<Plan> {
    const evolutionContext = [
      await chronosVeil.buildVeilContext(goal, userId, projectId, 5),
      await weaveForge.buildWeaveContext(goal, intent, userId, projectId, 5),
      await skillWeave.policyContext(goal, userId, projectId, 5),
      await atomChain.buildAtomicContext(goal, userId, projectId, 5),
      await policyMetabol.buildPolicyContext(goal, userId, projectId, 5),
      await layerForge.buildLayerContext(goal, userId, projectId, 5),
      await echoForge.buildEchoContext(goal, userId, projectId, 5),
    ].join('');

    return this.createPlan(goal, `${context || ''}${evolutionContext}`);
  }
  
  async refinePlan(plan: Plan, feedback: string): Promise<Plan> {
    const refinementPrompt = `Refine this plan based on the feedback.

Original Plan:
${JSON.stringify(plan, null, 2)}

Feedback:
${feedback}

Return the refined plan in the same JSON format.`;

    try {
      const response = await this.model.generate(
        [{ role: 'user', content: refinementPrompt }],
        { max_tokens: 1500 }
      );
      
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const steps = JSON.parse(jsonMatch[0]);
        return {
          ...plan,
          steps: steps.map((s: any) => ({
            ...s,
            status: 'pending' as const,
          })),
        };
      }
    } catch (error) {
      console.error('Plan refinement failed:', error);
    }
    
    return plan;
  }
  
  getNextStep(plan: Plan): PlanStep | null {
    const pendingSteps = plan.steps.filter(s => s.status === 'pending');
    
    for (const step of pendingSteps) {
      const deps = step.dependsOn || [];
      const depsCompleted = deps.every(depId => {
        const depStep = plan.steps.find(s => s.id === depId);
        return depStep?.status === 'completed';
      });
      
      if (depsCompleted) {
        return step;
      }
    }
    
    return null;
  }
  
  updateStepStatus(plan: Plan, stepId: string, status: PlanStep['status'], result?: string): Plan {
    return {
      ...plan,
      steps: plan.steps.map(s => {
        if (s.id === stepId) {
          return { ...s, status, result };
        }
        return s;
      }),
      status: status === 'completed' && plan.steps.every(s => s.status === 'completed')
        ? 'completed'
        : 'executing',
    };
  }
  
  async injectVersionContext(plan: Plan, versionSelection: VersionSelection): Promise<Plan> {
    const versionContext = await provenForge.buildVersionContext(versionSelection.branch, versionSelection.tier);
    
    return {
      ...plan,
      steps: plan.steps.map(step => ({
        ...step,
        versionContext: versionContext || undefined,
      })),
    };
  }
}
