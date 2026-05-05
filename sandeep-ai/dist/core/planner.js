"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Planner = void 0;
const models_1 = require("../models");
const provenForge_1 = require("./provenForge");
const chronosVeil_1 = require("./chronosVeil");
const weaveForge_1 = require("./weaveForge");
const skillWeave_1 = require("./skillWeave");
const atomChain_1 = require("./atomChain");
const policyMetabol_1 = require("./policyMetabol");
const layerForge_1 = require("./layerForge");
const echoForge_1 = require("./echoForge");
const nexusForge_1 = require("./nexusForge");
class Planner {
    model;
    constructor() {
        this.model = (0, models_1.createModel)();
    }
    async createPlan(goal, context, versionContext) {
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
    async createVersionAwarePlan(goal, context, versionSelection) {
        let versionContext = '';
        if (versionSelection) {
            if (versionSelection.intent === 'lineage') {
                if (versionSelection.branch) {
                    const latest = await provenForge_1.provenForge.getLatestForBranch(versionSelection.branch, versionSelection.tier);
                    if (latest) {
                        const lineage = await provenForge_1.provenForge.getLineage(latest.version_id, 5);
                        versionContext = `Lineage history: ${lineage.map(v => v.slice(0, 8)).join(' → ')}`;
                    }
                }
            }
            else if (versionSelection.intent === 'specific' && versionSelection.versionId) {
                const lineage = await provenForge_1.provenForge.getLineage(versionSelection.versionId, 5);
                versionContext = `Viewing version ${versionSelection.versionId.slice(0, 8)} with lineage: ${lineage.map(v => v.slice(0, 8)).join(' → ')}`;
            }
            else if (versionSelection.intent === 'latest') {
                versionContext = await provenForge_1.provenForge.buildVersionContext(versionSelection.branch, versionSelection.tier);
            }
            else if (versionSelection.intent === 'merge') {
                versionContext = `[ProvenForge] Merge intent for branch: ${versionSelection.branch}`;
            }
        }
        return this.createPlan(goal, context, versionContext);
    }
    async createEvolutionAwarePlan(goal, userId, projectId = 'default', context, intent = 'general') {
        const evolutionContext = [
            await chronosVeil_1.chronosVeil.buildVeilContext(goal, userId, projectId, 5),
            await weaveForge_1.weaveForge.buildWeaveContext(goal, intent, userId, projectId, 5),
            await skillWeave_1.skillWeave.policyContext(goal, userId, projectId, 5),
            await atomChain_1.atomChain.buildAtomicContext(goal, userId, projectId, 5),
            await policyMetabol_1.policyMetabol.buildPolicyContext(goal, userId, projectId, 5),
            await layerForge_1.layerForge.buildLayerContext(goal, userId, projectId, 5),
            await echoForge_1.echoForge.buildEchoContext(goal, userId, projectId, 5),
            await nexusForge_1.nexusForge.buildVeilContext(goal, userId, projectId, 5),
        ].join('');
        return this.createPlan(goal, `${context || ''}${evolutionContext}`);
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
    async injectVersionContext(plan, versionSelection) {
        const versionContext = await provenForge_1.provenForge.buildVersionContext(versionSelection.branch, versionSelection.tier);
        return {
            ...plan,
            steps: plan.steps.map(step => ({
                ...step,
                versionContext: versionContext || undefined,
            })),
        };
    }
}
exports.Planner = Planner;
//# sourceMappingURL=planner.js.map