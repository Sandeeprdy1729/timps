export interface PlanStep {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: string;
    dependsOn?: string[];
}
export interface Plan {
    goal: string;
    steps: PlanStep[];
    status: 'planning' | 'executing' | 'completed' | 'failed';
}
export declare class Planner {
    private model;
    constructor();
    createPlan(goal: string, context?: string): Promise<Plan>;
    refinePlan(plan: Plan, feedback: string): Promise<Plan>;
    getNextStep(plan: Plan): PlanStep | null;
    updateStepStatus(plan: Plan, stepId: string, status: PlanStep['status'], result?: string): Plan;
}
//# sourceMappingURL=planner.d.ts.map