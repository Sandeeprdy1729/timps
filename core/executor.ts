import { getToolByName, executeTool } from '../tools';
import { Plan, PlanStep } from './planner';
import { Message } from '../models/baseModel';
import { createModel, BaseModel } from '../models';

export interface ExecutionResult {
  success: boolean;
  step: PlanStep;
  output: string;
  error?: string;
}

export class Executor {
  private model: BaseModel;
  
  constructor() {
    this.model = createModel();
  }
  
  async executeStep(plan: Plan, step: PlanStep): Promise<ExecutionResult> {
    const stepWithDeps = this.injectDependencies(plan, step);
    
    const executionPrompt = `Execute the following step:

${step.description}

Previous step results:
${stepWithDeps}

Provide the result of executing this step. If you need to use a tool, respond with a JSON object in this format:
{"tool": "tool_name", "params": {"param1": "value1"}}

Otherwise, provide your direct response.`;

    try {
      const response = await this.model.generate(
        [{ role: 'user', content: executionPrompt }],
        { max_tokens: 2000 }
      );
      
      const content = response.content.trim();
      
      if (content.startsWith('{') && content.includes('"tool"')) {
        try {
          const toolCall = JSON.parse(content);
          const result = await executeTool(toolCall.tool, {
            ...toolCall.params,
            tool_call_id: step.id,
          });
          
          return {
            success: !result.error,
            step,
            output: result.error || result.result,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            step,
            output: '',
            error: error.message,
          };
        }
      }
      
      return {
        success: true,
        step,
        output: content,
      };
    } catch (error: any) {
      return {
        success: false,
        step,
        output: '',
        error: error.message,
      };
    }
  }
  
  private injectDependencies(plan: Plan, currentStep: PlanStep): string {
    const deps = currentStep.dependsOn || [];
    const results: string[] = [];
    
    for (const depId of deps) {
      const depStep = plan.steps.find(s => s.id === depId);
      if (depStep && depStep.result) {
        results.push(`${depStep.description}: ${depStep.result}`);
      }
    }
    
    return results.join('\n\n') || 'No previous results.';
  }
  
  async executePlan(plan: Plan, maxIterations: number = 10): Promise<{
    plan: Plan;
    results: ExecutionResult[];
  }> {
    let currentPlan = plan;
    const results: ExecutionResult[] = [];
    let iterations = 0;
    
    while (currentPlan.status !== 'completed' && iterations < maxIterations) {
      const nextStep = this.getNextStep(currentPlan);
      
      if (!nextStep) {
        break;
      }
      
      const stepWithStatus = {
        ...nextStep,
        status: 'in_progress' as const,
      };
      
      currentPlan = {
        ...currentPlan,
        steps: currentPlan.steps.map(s => 
          s.id === nextStep.id ? stepWithStatus : s
        ),
      };
      
      const result = await this.executeStep(currentPlan, stepWithStatus);
      results.push(result);
      
      currentPlan = {
        ...currentPlan,
        steps: currentPlan.steps.map(s =>
          s.id === nextStep.id
            ? { ...s, status: result.success ? 'completed' : 'failed', result: result.output }
            : s
        ),
        status: result.success && currentPlan.steps.every(st => st.status === 'completed')
          ? 'completed'
          : 'executing',
      };
      
      iterations++;
    }
    
    return { plan: currentPlan, results };
  }
  
  private getNextStep(plan: Plan): PlanStep | null {
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
}
