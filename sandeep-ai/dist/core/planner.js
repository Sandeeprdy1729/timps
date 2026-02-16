"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Planner = void 0;
const models_1 = require("../models");
class Planner {
    model;
    constructor() {
        this.model = (0, models_1.createModel)();
    }
    async createPlan(goal, context) {
        const planningPrompt = `You are a task planner. Break down the user's goal into clear, executable steps.

Goal: ${goal}
${context ? `Context: ${context}` : ''}

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
            const response = await this.model.generate([{ role: 'user', content: planningPrompt }], { max_tokens: 1000 });
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const steps = JSON.parse(jsonMatch[0]);
                return {
                    goal,
                    steps: steps.map((s) => ({
                        ...s,
                        status: 'pending',
                    })),
                    status: 'planning',
                };
            }
        }
        catch (error) {
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
    async refinePlan(plan, feedback) {
        const refinementPrompt = `Refine this plan based on the feedback.

Original Plan:
${JSON.stringify(plan, null, 2)}

Feedback:
${feedback}

Return the refined plan in the same JSON format.`;
        try {
            const response = await this.model.generate([{ role: 'user', content: refinementPrompt }], { max_tokens: 1500 });
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const steps = JSON.parse(jsonMatch[0]);
                return {
                    ...plan,
                    steps: steps.map((s) => ({
                        ...s,
                        status: 'pending',
                    })),
                };
            }
        }
        catch (error) {
            console.error('Plan refinement failed:', error);
        }
        return plan;
    }
    getNextStep(plan) {
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
    updateStepStatus(plan, stepId, status, result) {
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
}
exports.Planner = Planner;
//# sourceMappingURL=planner.js.map