import { Plan, PlanStep } from './planner';
export interface ExecutionResult {
    success: boolean;
    step: PlanStep;
    output: string;
    error?: string;
}
export declare class Executor {
    private model;
    constructor();
    executeStep(plan: Plan, step: PlanStep): Promise<ExecutionResult>;
    private injectDependencies;
    executePlan(plan: Plan, maxIterations?: number): Promise<{
        plan: Plan;
        results: ExecutionResult[];
    }>;
    private getNextStep;
}
//# sourceMappingURL=executor.d.ts.map