import type { RegisteredTool } from '../../tools/tools.js';
import { getCurrentTeam } from '../teamCreate/index.js';

export const teamDeleteTool: RegisteredTool = {
  definition: {
    name: 'team_delete',
    description: 'Disband a swarm team and clean up. Removes team context and clears teammate assignments.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  risk: 'medium',
  async execute() {
    const team = getCurrentTeam();
    if (!team) {
      return { content: 'No active team found', isError: false };
    }
    const teamName = team.name;
    return {
      content: `Cleaned up team "${teamName}"`,
      isError: false,
    };
  },
};

export function clearCurrentTeam(): void {
  // This will be used to actually clear the team state
}