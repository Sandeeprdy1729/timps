import type { RegisteredTool } from '../../tools/tools.js';

interface Command {
  name: string;
  description: string;
  prompt?: string;
}

const registeredCommands = new Map<string, Command>();

export function registerCommand(cmd: Command): void {
  registeredCommands.set(cmd.name, cmd);
}

export function getCommands(): Command[] {
  return Array.from(registeredCommands.values());
}

export const skillTool: RegisteredTool = {
  definition: {
    name: 'skill',
    description: 'Execute a skill or slash-command. Use to invoke specialized workflows like /commit, /review-pr, or custom prompts.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'The skill name (e.g., "commit", "review-pr", "pdf")' },
        args: { type: 'string', description: 'Optional arguments for the skill' },
      },
      required: ['skill'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const skillName = String(args.skill).replace(/^\//, '');
    const skillArgs = args.args ? String(args.args) : '';
    const command = registeredCommands.get(skillName);
    if (!command) {
      return {
        content: `Unknown skill: ${skillName}. Available: ${Array.from(registeredCommands.keys()).join(', ')}`,
        isError: true,
      };
    }
    if (command.prompt) {
      return {
        content: `Skill "${skillName}" invoked with args: ${skillArgs}\n\nPrompt:\n${command.prompt}`,
        isError: false,
      };
    }
    return {
      content: `Skill "${skillName}" executed successfully`,
      isError: false,
    };
  },
};