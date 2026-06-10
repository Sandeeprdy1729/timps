import { MemoryStats } from '../api';
import { PROVIDERS } from '../constants/index';
import './CommandCenter.css';

interface CommandCenterProps {
  projectPath: string;
  stats: MemoryStats | null;
  onRunPrompt: (prompt: string) => void;
}

const agentFlow = [
  {
    phase: 'Read',
    signal: 'AGENTS.md, package files, changed files, memory, active editor context',
    result: 'The agent starts with the project rules and the work already in motion.',
  },
  {
    phase: 'Plan',
    signal: 'Goal, risks, permissions, model lane, tools, verification route',
    result: 'The user sees what TIMPS intends to do before costly actions happen.',
  },
  {
    phase: 'Act',
    signal: 'Files, shell, git, MCP, browser, desktop control, generated assets',
    result: 'TIMPS does the work in scoped steps and keeps progress inspectable.',
  },
  {
    phase: 'Verify',
    signal: 'Tests, typecheck, build, UI screenshots, review pass, summaries',
    result: 'Output is judged by evidence, not vibes.',
  },
  {
    phase: 'Remember',
    signal: 'Semantic facts, episodes, recurring workflows, project pain points',
    result: 'Useful context survives the current session.',
  },
];

const capabilityGroups = [
  {
    title: 'Interface',
    items: ['Threads', 'plans', 'diffs', 'terminal', 'memory views', 'project switcher', 'quick capture', 'Lens'],
  },
  {
    title: 'Plugins',
    items: ['GitHub', 'Linear', 'Canva', 'Chrome', 'Browser', 'Computer Use', 'custom TIMPS plugins', 'MCP bundles'],
  },
  {
    title: 'Skills',
    items: ['skill creator', 'plugin creator', 'image generation', 'PR triage', 'CI repair', 'docs lookup', 'project playbooks'],
  },
  {
    title: 'Automations',
    items: ['daily repo health', 'PR follow-up', 'dependency checks', 'memory drift checks', 'release notes', 'long-running task watch'],
  },
  {
    title: 'Permissions',
    items: ['read-only', 'workspace write', 'network rules', 'app-control prompts', 'command allowlists', 'audit trail'],
  },
  {
    title: 'Memory',
    items: ['working state', 'episodes', 'semantic facts', 'knowledge graph', 'team memory', 'background summarizer'],
  },
];

const automationIdeas = [
  {
    name: 'Morning project sweep',
    cadence: 'Weekdays 9:00',
    output: 'Changed files, failing checks, stale TODOs, risky dependencies, recommended next action.',
  },
  {
    name: 'PR babysitter',
    cadence: 'Every 20 minutes',
    output: 'CI status, review comments, suggested fixes, and a clear stop condition.',
  },
  {
    name: 'Memory gardener',
    cadence: 'Daily',
    output: 'Repeated mistakes, missing AGENTS.md rules, stale decisions, and new reusable skills.',
  },
  {
    name: 'Release prep',
    cadence: 'On demand',
    output: 'Changelog draft, version checks, smoke-test commands, publish readiness.',
  },
];

const differentiators = [
  'One cockpit across CLI, desktop, IDE, mobile, MCP, and team memory.',
  'Model choice becomes routing: fast local models for scans, frontier models for ambiguous work, routers for cost and uptime.',
  'Memory is not a gimmick: TIMPS should learn repeated pain, decisions, failures, and preferred workflows.',
  'Automations should save attention, not create noise: every run needs a finding, a diff, or a quiet archive.',
  'Trust comes from visible permissions, evidence-backed verification, and reversible worktrees.',
];

const promptActions = [
  {
    label: 'Plan This Project',
    prompt:
      'Create a TIMPS execution plan for this project. Read AGENTS.md, map the packages, identify the highest-impact improvements, suggest skills/plugins/automations, and include verification commands.',
  },
  {
    label: 'Design A Skill',
    prompt:
      'Design one repo-specific TIMPS skill for this project. Include the skill name, trigger description, workflow steps, needed tools, references, and how to test it.',
  },
  {
    label: 'Draft Automations',
    prompt:
      'Draft practical TIMPS automations for this project. Include cadence, scope, sandbox/permission needs, expected findings, stop conditions, and how the user reviews results.',
  },
  {
    label: 'Plugin Map',
    prompt:
      'Audit this project for plugin and MCP opportunities. Prioritize integrations that save developer time: GitHub, Linear, docs, browser testing, telemetry, cloud deploys, and design tools.',
  },
];

function countByCategory(category: string) {
  return PROVIDERS.filter((provider) => provider.category === category).length;
}

export function CommandCenter({ projectPath, stats, onRunPrompt }: CommandCenterProps) {
  const projectLabel = projectPath.trim() || 'No project selected';
  const frontierCount = countByCategory('frontier');
  const openCount = countByCategory('local-open');
  const routerCount = countByCategory('router') + countByCategory('enterprise');

  return (
    <div className="command-center">
      <section className="command-hero">
        <div>
          <p className="eyebrow">TIMPS Command Center</p>
          <h1>Make the agent visible, useful, and trustworthy.</h1>
          <p className="command-lede">
            A desktop home for what the agent can do next: plan, act, verify, remember,
            install capabilities, and run background work without making the user babysit it.
          </p>
        </div>

        <div className="project-snapshot" aria-label="Project snapshot">
          <span className="snapshot-label">Active project</span>
          <strong>{projectLabel}</strong>
          <div className="snapshot-grid">
            <span>{stats?.semantic_count ?? 0}<small>memories</small></span>
            <span>{stats?.episode_count ?? 0}<small>sessions</small></span>
            <span>{stats?.working_goals ?? 0}<small>goals</small></span>
          </div>
        </div>
      </section>

      <section className="model-strip" aria-label="Model mesh">
        <div>
          <strong>{frontierCount}</strong>
          <span>frontier lanes</span>
        </div>
        <div>
          <strong>{openCount}</strong>
          <span>local/open lanes</span>
        </div>
        <div>
          <strong>{routerCount}</strong>
          <span>router/enterprise lanes</span>
        </div>
        <div>
          <strong>{PROVIDERS.length}</strong>
          <span>provider options</span>
        </div>
      </section>

      <section className="command-actions" aria-label="Agent starters">
        {promptActions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="command-action"
            onClick={() => onRunPrompt(action.prompt)}
          >
            {action.label}
          </button>
        ))}
      </section>

      <section className="agent-flow" aria-label="Agent workflow">
        {agentFlow.map((step, index) => (
          <article key={step.phase} className="flow-card">
            <span className="flow-index">{String(index + 1).padStart(2, '0')}</span>
            <h2>{step.phase}</h2>
            <p className="flow-signal">{step.signal}</p>
            <p>{step.result}</p>
          </article>
        ))}
      </section>

      <section className="capability-grid" aria-label="Capability map">
        {capabilityGroups.map((group) => (
          <article key={group.title} className="capability-card">
            <h2>{group.title}</h2>
            <div className="chip-list">
              {group.items.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="automation-panel" aria-label="Automation ideas">
        <div className="panel-heading">
          <p className="eyebrow">Automation queue</p>
          <h2>Background work that saves attention</h2>
        </div>
        <div className="automation-list">
          {automationIdeas.map((item) => (
            <article key={item.name} className="automation-row">
              <div>
                <h3>{item.name}</h3>
                <span>{item.cadence}</span>
              </div>
              <p>{item.output}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="impact-panel" aria-label="Product differentiation">
        <div className="panel-heading">
          <p className="eyebrow">Differentiation</p>
          <h2>Where TIMPS can feel genuinely helpful</h2>
        </div>
        <ol>
          {differentiators.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
