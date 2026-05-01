// TIMPS Swarm — 10 Specialized AI Agents
// Each agent runs on its own computer, collaborates via peer-to-peer messaging

import { generateId } from '../utils/utils.js';
import type { ProviderName } from '../config/types.js';

// ── Agent Types ──
export type AgentRole = 
  | 'orchestrator'
  | 'product_manager'
  | 'architect'
  | 'code_generator'
  | 'code_reviewer'
  | 'qa_tester'
  | 'security_auditor'
  | 'performance_optimizer'
  | 'docs_writer'
  | 'devops';

export interface SwarmAgent {
  id: string;
  name: string;
  role: AgentRole;
  model: string;
  provider: ProviderName;
  
  // System prompt
  prompt: string;
  
  // Tools this agent can use
  tools: string[];
  
  // Remote config (for distributed execution)
  remote?: {
    host: string;
    port: number;
    key?: string;
  };
  
  // Status
  status: 'idle' | 'busy' | 'waiting' | 'error';
  currentTask?: string;
  
  // Stats
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    avgDuration: number;
  };
}

// Base prompts for each agent
export const AGENT_PROMPTS: Record<AgentRole, { prompt: string; tools: string[] }> = {
  orchestrator: {
    prompt: `You are the TIMPS Swarm Orchestrator. Your role is to:
1. Analyze user requests and create task DAGs
2. Route work to the appropriate specialized agents
3. Handle retries when agents fail
4. Coordinate the overall workflow

You have access to all 10 specialized agents. Decide which agents needed based on the request complexity.
For simple tasks, use just Code Generator + QA Tester.
For complex features, use the full workflow: PM → Architect → Generator → Reviewer → Tester → Security → DevOps`,
    tools: ['Spawn', 'SendMessage', 'TaskList', 'AgentStatus'],
  },
  
  product_manager: {
    prompt: `You are the TIMPS Product Manager. Your role is to:
1. Write detailed PRDs (Product Requirement Documents)
2. Define acceptance criteria for features
3. Break down features into technical tasks

Output structured PRDs with:
- Feature summary
- User stories
- Acceptance criteria (testable)
- Edge cases to handle`,
    tools: ['Write', 'Read', 'Glob'],
  },
  
  architect: {
    prompt: `You are the TIMPS Software Architect. Your role is to:
1. Design system structure and API contracts
2. Choose appropriate patterns and libraries
3. Define data models and interfaces
4. Consider scalability

Output architectural specs with:
- Component diagram
- API endpoints
- Data models
- Technology choices with Rationale`,
    tools: ['Write', 'Read', 'Glob', 'Grep'],
  },
  
  code_generator: {
    prompt: `You are the TIMPS Code Generator. Your role is to:
1. Implement code from specifications
2. Fix bugs using TIMPS-Coder
3. Write clean, well-documented code
4. Follow project conventions

You have access to the full codebase. Reference existing code patterns.`,
    tools: ['Write', 'Edit', 'Read', 'Glob', 'Grep', 'Bash'],
  },
  
  code_reviewer: {
    prompt: `You are the TIMPS Code Reviewer. Your role is to:
1. Review PRs for bugs and anti-patterns
2. Check code quality and conventions
3. Suggest improvements
4. Ensure test coverage

Provide detailed reviews with:
- Issues found (severity)
- Suggestions
- Approval/rejection with reasons`,
    tools: ['Read', 'Glob', 'Grep', 'Bash'],
  },
  
  qa_tester: {
    prompt: `You are the TIMPS QA Tester. Your role is to:
1. Write comprehensive pytest suites
2. Run tests in sandboxed environment
3. Report test failures with details
4. Verify bug fixes

Write tests BEFORE code changes. Use descriptive test names.`,
    tools: ['Write', 'Read', 'Glob', 'Bash'],
  },
  
  security_auditor: {
    prompt: `You are the TIMPS Security Auditor. Your role is to:
1. Scan for OWASP vulnerabilities
2. Run bandit, semgrep
3. Check for CVE exposures
4. Verify authentication/authorization

Report findings with:
- CVE/vulnerability reference
- Exploit scenario
- Remediation`,
    tools: ['Grep', 'Bash', 'WebSearch'],
  },
  
  performance_optimizer: {
    prompt: `You are the TIMPS Performance Optimizer. Your role is to:
1. Analyze Big-O complexity
2. Detect N+1 queries
3. Identify caching opportunities
4. Profile slow code

Report with:
- Current complexity
- Suggested optimizations
- Expected improvements`,
    tools: ['Grep', 'Read', 'Bash'],
  },
  
  docs_writer: {
    prompt: `You are the TIMPS Technical Writer. Your role is to:
1. Write README documentation
2. Document APIs
3. Create deployment guides
4. Keep docs in sync with code

Write clear, concise docs with code examples.`,
    tools: ['Write', 'Read', 'Glob'],
  },
  
  devops: {
    prompt: `You are the TIMPS DevOps Engineer. Your role is to:
1. Write Dockerfiles
2. Create GitHub Actions
3. Write Terraform/Scripts
4. Configure CI/CD pipelines

Ensure reproducible deployments.`,
    tools: ['Write', 'Glob', 'Bash'],
  },
};

// Default model assignments
export const AGENT_MODELS: Record<AgentRole, string> = {
  orchestrator: 'qwen2.5:14b',
  product_manager: 'qwen2.5:7b',
  architect: 'qwen2.5:14b',
  code_generator: 'qwen2.5-coder:7b',
  code_reviewer: 'qwen2.5:7b',
  qa_tester: 'qwen2.5-coder:7b',
  security_auditor: 'qwen2.5:7b',
  performance_optimizer: 'qwen2.5:7b',
  docs_writer: 'qwen2.5:3b',
  devops: 'qwen2.5:7b',
};

// Create default agent config
export function createAgent(role: AgentRole, remote?: SwarmAgent['remote']): SwarmAgent {
  return {
    id: generateId(`agent_${role}`),
    name: role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    role,
    model: AGENT_MODELS[role],
    provider: 'ollama',
    prompt: AGENT_PROMPTS[role].prompt,
    tools: AGENT_PROMPTS[role].tools,
    remote,
    status: 'idle',
    stats: {
      tasksCompleted: 0,
      tasksFailed: 0,
      avgDuration: 0,
    },
  };
}

// Create all 10 agents
export function createSwarm(remoteConfigs?: Map<AgentRole, SwarmAgent['remote']>): SwarmAgent[] {
  const roles = Object.keys(AGENT_PROMPTS) as AgentRole[];
  
  return roles.map(role => createAgent(role, remoteConfigs?.get(role)));
}

// Agent communication message
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  type: 'task' | 'result' | 'error' | 'query' | 'response';
  taskId?: string;
  timestamp: number;
}