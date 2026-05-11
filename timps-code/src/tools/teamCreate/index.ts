import type { RegisteredTool } from '../../tools/tools.js';

interface TeamMember {
  agentId: string;
  name: string;
  agentType: string;
  joinedAt: number;
}

interface Team {
  name: string;
  description?: string;
  leadAgentId: string;
  members: TeamMember[];
  createdAt: number;
}

const teams = new Map<string, Team>();
let currentTeam: string | null = null;

export const teamCreateTool: RegisteredTool = {
  definition: {
    name: 'team_create',
    description: 'Create a multi-agent swarm/team. Use to coordinate multiple agents working together.',
    inputSchema: {
      type: 'object',
      properties: {
        team_name: { type: 'string', description: 'Name for the new team' },
        description: { type: 'string', description: 'Team description/purpose' },
        agent_type: { type: 'string', description: 'Type/role of the team lead (e.g., "researcher", "test-runner")' },
      },
      required: ['team_name'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const teamName = String(args.team_name);
    const existingTeam = currentTeam;
    if (existingTeam) {
      return { content: `Already leading team "${existingTeam}". Use team_delete first.`, isError: true };
    }
    if (teams.has(teamName)) {
      return { content: `Team "${teamName}" already exists. Use a different name.`, isError: true };
    }
    const agentType = String(args.agent_type || 'team-lead');
    const leadAgentId = `team-lead@${teamName}`;
    const team: Team = {
      name: teamName,
      description: args.description ? String(args.description) : undefined,
      leadAgentId,
      members: [{ agentId: leadAgentId, name: 'team-lead', agentType, joinedAt: Date.now() }],
      createdAt: Date.now(),
    };
    teams.set(teamName, team);
    currentTeam = teamName;
    return {
      content: `Created team "${teamName}"\nLead agent: ${leadAgentId}\nDescription: ${team.description || '(none)'}`,
      isError: false,
    };
  },
};

export function getCurrentTeam(): Team | undefined {
  return currentTeam ? teams.get(currentTeam) : undefined;
}