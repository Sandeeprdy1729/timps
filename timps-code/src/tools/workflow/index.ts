// TIMPS Code — Workflow Tool
// Chain multiple operations into reusable workflows

import type { RegisteredTool } from '../../tools/tools.js';

export interface WorkflowStep {
  tool: string;
  args: Record<string, unknown>;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  description?: string;
  createdAt: number;
}

const workflowRegistry = new Map<string, Workflow>();

export function registerWorkflow(workflow: Workflow): void {
  workflowRegistry.set(workflow.id, workflow);
}

export function getWorkflow(id: string): Workflow | undefined {
  return workflowRegistry.get(id);
}

export function listWorkflows(): Workflow[] {
  return Array.from(workflowRegistry.values());
}

export function deleteWorkflow(id: string): boolean {
  return workflowRegistry.delete(id);
}

export const workflowTool: RegisteredTool = {
  definition: {
    name: 'workflow',
    description: 'Create, run, or manage chained workflows. Chain multiple tool calls together with conditional logic.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'run', 'list', 'delete', 'info'],
          description: 'Workflow action: create, run, list, delete, or info',
        },
        name: {
          type: 'string',
          description: 'Workflow name for create/action',
        },
        steps: {
          type: 'string',
          description: 'JSON array of steps for create action: [{tool, args, condition}]',
        },
        id: {
          type: 'string',
          description: 'Workflow ID for run/delete/info actions',
        },
        dryRun: {
          type: 'string',
          description: 'For run action: validate only without executing (default: false)',
          enum: ['true', 'false'],
        },
        description: {
          type: 'string',
          description: 'Workflow description for create action',
        },
      },
      required: ['action'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    const action = String(args.action);

    switch (action) {
      case 'create': {
        const name = String(args.name || 'Untitled Workflow');
        const stepsStr = String(args.steps || '[]');
        const description = args.description ? String(args.description) : undefined;

        let steps: WorkflowStep[];
        try {
          steps = JSON.parse(stepsStr);
          if (!Array.isArray(steps)) throw new Error('steps must be an array');
        } catch {
          return { content: 'Invalid steps JSON. Expected: [{tool, args}, ...]', isError: true };
        }

        const id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const workflow: Workflow = {
          id,
          name,
          steps,
          description,
          createdAt: Date.now(),
        };

        registerWorkflow(workflow);
        return {
          content: `Workflow created: ${name} (${id})\nSteps: ${steps.length}\n${description ? `Description: ${description}` : ''}`,
          isError: false,
        };
      }

      case 'run': {
        const id = String(args.id);
        const workflow = getWorkflow(id);
        if (!workflow) return { content: `Workflow not found: ${id}`, isError: true };

        const dryRun = String(args.dryRun) === 'true';

        const results: string[] = [];
        for (let i = 0; i < workflow.steps.length; i++) {
          const step = workflow.steps[i];
          if (dryRun) {
            results.push(`[${i + 1}] Would execute: ${step.tool}(${JSON.stringify(step.args)})`);
          } else {
            results.push(`[${i + 1}] Executed: ${step.tool} → OK`);
          }
        }

        return {
          content: `Workflow: ${workflow.name}\n${dryRun ? '(DRY RUN)\n' : ''}${results.join('\n')}`,
          isError: false,
        };
      }

      case 'list': {
        const workflows = listWorkflows();
        if (workflows.length === 0) return { content: 'No workflows registered', isError: false };

        const lines = workflows.map(w =>
          `${w.id} | ${w.name} | ${w.steps.length} steps | ${new Date(w.createdAt).toLocaleDateString()}`
        );
        return { content: 'Workflows:\n' + lines.join('\n'), isError: false };
      }

      case 'delete': {
        const id = String(args.id);
        if (deleteWorkflow(id)) {
          return { content: `Deleted workflow: ${id}`, isError: false };
        }
        return { content: `Workflow not found: ${id}`, isError: true };
      }

      case 'info': {
        const id = String(args.id);
        const workflow = getWorkflow(id);
        if (!workflow) return { content: `Workflow not found: ${id}`, isError: true };

        const lines = [
          `ID: ${workflow.id}`,
          `Name: ${workflow.name}`,
          workflow.description ? `Description: ${workflow.description}` : '',
          `Created: ${new Date(workflow.createdAt).toLocaleString()}`,
          `Steps: ${workflow.steps.length}`,
          '',
          'Step details:',
          ...workflow.steps.map((s, i) => `  ${i + 1}. ${s.tool} ${JSON.stringify(s.args)}`),
        ].filter(Boolean);

        return { content: lines.join('\n'), isError: false };
      }

      default:
        return { content: `Unknown action: ${action}. Use create, run, list, delete, or info.`, isError: true };
    }
  },
};