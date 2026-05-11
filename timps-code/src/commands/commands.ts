// ── TIMPS Code — Enhanced Slash Commands (100+ commands)
// Comprehensive command registry inspired by Claude Code

import type { CommandDef, CommandCategory } from '../types/command.js';

export const COMMAND_REGISTRY: CommandDef[] = [
  // ═══════════════════════════════════════════════════════════
  // GIT OPERATIONS
  // ═══════════════════════════════════════════════════════════
  {
    name: 'commit',
    description: 'Create a git commit with proper attribution',
    category: 'Git',
    aliases: ['cm'],
    argsHint: '<message>',
  },
  {
    name: 'commit-push-pr',
    description: 'Commit changes, push to remote, and create a PR',
    category: 'Git',
    aliases: ['cpp'],
    argsHint: '<message>',
  },
  {
    name: 'branch',
    description: 'Fork/branch the current conversation to try a different approach',
    category: 'Git',
    aliases: ['br'],
  },
  {
    name: 'diff',
    description: 'Show a diff dialog of current changes',
    category: 'Git',
    aliases: ['d'],
  },
  {
    name: 'tag',
    description: 'Add/remove searchable tags to sessions',
    category: 'Git',
    aliases: ['t'],
    argsHint: '<add|remove> <tag>',
  },
  {
    name: 'stash',
    description: 'Git stash operations',
    category: 'Git',
    aliases: ['stsh'],
    subcommands: ['push', 'pop', 'list', 'apply', 'drop', 'show'],
  },

  // ═══════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  {
    name: 'session',
    description: 'Display remote session info with sharing options',
    category: 'Session',
    aliases: ['sess'],
  },
  {
    name: 'resume',
    description: 'Resume a previous conversation with smart project detection',
    category: 'Session',
    aliases: ['r'],
    argsHint: '[session-id]',
  },
  {
    name: 'rewind',
    description: 'Rewind conversation to a specific point',
    category: 'Session',
    aliases: ['rw'],
  },
  {
    name: 'share',
    description: 'Share current session via URL or QR code',
    category: 'Session',
    aliases: ['sh'],
  },
  {
    name: 'compact',
    description: 'Manually compact conversation context',
    category: 'Session',
    aliases: ['cp'],
  },
  {
    name: 'clear',
    description: 'Clear conversation or caches',
    category: 'Session',
    aliases: ['cl'],
    subcommands: ['conversation', 'caches', 'all'],
  },

  // ═══════════════════════════════════════════════════════════
  // TASK MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  {
    name: 'tasks',
    description: 'Show background tasks and task list',
    category: 'Tasks',
    aliases: ['t'],
  },
  {
    name: 'plan',
    description: 'Enable plan mode to describe work without execution',
    category: 'Tasks',
    aliases: ['p'],
    argsHint: '<task description>',
  },
  {
    name: 'passes',
    description: 'Manage guest passes / Extra Usage',
    category: 'Tasks',
    aliases: ['pa'],
  },
  {
    name: 'todo',
    description: 'Persistent todo tracker',
    category: 'Tasks',
    aliases: ['t'],
    subcommands: ['add', 'done', 'remove', 'clear', 'all'],
  },

  // ═══════════════════════════════════════════════════════════
  // CODE REVIEWS
  // ═══════════════════════════════════════════════════════════
  {
    name: 'review',
    description: 'Local PR review using git diff',
    category: 'Review',
    aliases: ['rv'],
    argsHint: '[pr-number]',
  },
  {
    name: 'ultrareview',
    description: 'Remote deep bug-finding review',
    category: 'Review',
    aliases: ['urv'],
  },
  {
    name: 'security-review',
    description: 'Security-focused review of changes',
    category: 'Review',
    aliases: ['sec'],
  },
  {
    name: 'bughunter',
    description: 'Automated bug pattern detection',
    category: 'Review',
    aliases: ['bh'],
    isHidden: true,
  },

  // ═══════════════════════════════════════════════════════════
  // MCP COMMANDS
  // ═══════════════════════════════════════════════════════════
  {
    name: 'mcp',
    description: 'Manage MCP servers',
    category: 'MCP',
    aliases: [],
    subcommands: ['add', 'remove', 'enable', 'disable', 'list', 'reconnect'],
  },
  {
    name: 'mcp-add',
    description: 'Add a new MCP server',
    category: 'MCP',
    aliases: ['mcpa'],
    argsHint: '<server-name> <command> [args...]',
  },

  // ═══════════════════════════════════════════════════════════
  // REMOTE / TELEPORT
  // ═══════════════════════════════════════════════════════════
  {
    name: 'remote-setup',
    description: 'Setup remote development environment',
    category: 'Remote',
    aliases: ['rs'],
  },
  {
    name: 'remote-env',
    description: 'Configure remote environment variables',
    category: 'Remote',
    aliases: ['re'],
    argsHint: '<key> <value>',
  },
  {
    name: 'teleport',
    description: 'Teleport to a remote session',
    category: 'Remote',
    aliases: ['tp'],
    isHidden: true,
  },
  {
    name: 'ssh',
    description: 'Connect via SSH to remote host',
    category: 'Remote',
    aliases: [],
    argsHint: '<host> [command]',
  },

  // ═══════════════════════════════════════════════════════════
  // ENTERPRISE FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    name: 'context',
    description: 'Visualize context usage and token distribution',
    category: 'Enterprise',
    aliases: ['ctx'],
  },
  {
    name: 'feedback',
    description: 'Send feedback to the team',
    category: 'Enterprise',
    aliases: ['fb'],
    argsHint: '<feedback text>',
  },
  {
    name: 'release-notes',
    description: 'Show changelog and release notes',
    category: 'Enterprise',
    aliases: ['rn'],
  },
  {
    name: 'pr_comments',
    description: 'Manage PR comments',
    category: 'Enterprise',
    aliases: ['prc'],
    subcommands: ['list', 'add', 'resolve'],
  },
  {
    name: 'policy',
    description: 'Manage governance policies',
    category: 'Enterprise',
    aliases: ['pol'],
    subcommands: ['list', 'add', 'remove', 'enable', 'disable'],
  },

  // ═══════════════════════════════════════════════════════════
  // ADVISOR / AGENTS
  // ═══════════════════════════════════════════════════════════
  {
    name: 'advisor',
    description: 'Configure secondary advisor model for review',
    category: 'Team',
    aliases: ['adv'],
  },
  {
    name: 'agents',
    description: 'Show agents menu for specialized tasks',
    category: 'Team',
    aliases: ['ag'],
  },
  {
    name: 'swarm',
    description: 'Run multi-agent swarm orchestration',
    category: 'Team',
    aliases: ['sw'],
    subcommands: ['feature', 'bugfix', 'refactor', 'docs', 'status'],
  },
  {
    name: 'team',
    description: 'Team collaboration and shared memory',
    category: 'Team',
    aliases: ['tm'],
    subcommands: ['join', 'leave', 'status', 'progress', 'share', 'add-progress', 'done'],
  },
  {
    name: 'fork',
    description: 'Fork a subagent with custom configuration',
    category: 'Team',
    aliases: ['fk'],
    isHidden: true,
  },

  // ═══════════════════════════════════════════════════════════
  // SPECIAL UTILITIES
  // ═══════════════════════════════════════════════════════════
  {
    name: 'btw',
    description: 'Ask a side question without losing context',
    category: 'Session',
    aliases: [],
    argsHint: '<question>',
  },
  {
    name: 'thinkback',
    description: 'Conversation replay and memory exploration',
    category: 'Session',
    aliases: ['tb'],
  },
  {
    name: 'insights',
    description: 'Detailed usage analytics and patterns',
    category: 'Info',
    aliases: ['ins'],
  },
  {
    name: 'brief',
    description: 'Toggle brief-only mode for concise output',
    category: 'Configuration',
    aliases: ['brf'],
    isHidden: true,
  },
  {
    name: 'think',
    description: 'Force step-by-step thinking',
    category: 'Session',
    aliases: ['th'],
    argsHint: '<question>',
  },

  // ═══════════════════════════════════════════════════════════
  // PLUGIN SYSTEM
  // ═══════════════════════════════════════════════════════════
  {
    name: 'plugin',
    description: 'Plugin management hub',
    category: 'Tools',
    aliases: ['plg'],
    subcommands: ['list', 'load', 'unload', 'browse', 'install', 'discover', 'settings'],
  },
  {
    name: 'reload-plugins',
    description: 'Reload all plugins',
    category: 'Tools',
    aliases: ['rpl'],
  },
  {
    name: 'skill',
    description: 'Skills marketplace',
    category: 'Tools',
    aliases: ['sk'],
    subcommands: ['search', 'install', 'remove', 'list'],
  },
  {
    name: 'hooks',
    description: 'Manage custom hooks',
    category: 'Tools',
    aliases: ['hk'],
    subcommands: ['list', 'add', 'remove', 'enable', 'disable'],
  },

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════
  {
    name: 'config',
    description: 'Open settings panel',
    category: 'Configuration',
    aliases: ['cfg'],
  },
  {
    name: 'model',
    description: 'Model selection and configuration',
    category: 'Configuration',
    aliases: ['m'],
    argsHint: '<provider> [model]',
  },
  {
    name: 'provider',
    description: 'Provider selection and status',
    category: 'Configuration',
    aliases: ['prov'],
  },
  {
    name: 'provider-select',
    description: 'Interactive provider picker',
    category: 'Configuration',
    aliases: ['ps'],
  },
  {
    name: 'tech',
    description: 'Technology stack management',
    category: 'Configuration',
    aliases: [],
    subcommands: ['set', 'add', 'clear'],
  },
  {
    name: 'effort',
    description: 'Effort tracking level',
    category: 'Configuration',
    aliases: ['eff'],
    argsHint: '<low|medium|high>',
  },
  {
    name: 'output-style',
    description: 'Output style configuration',
    category: 'Configuration',
    aliases: ['os'],
    argsHint: '<style>',
  },
  {
    name: 'theme',
    description: 'Theme management',
    category: 'Configuration',
    aliases: ['th'],
  },
  {
    name: 'fast',
    description: 'Toggle fast mode for quicker responses',
    category: 'Configuration',
    aliases: ['f'],
  },

  // ═══════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════
  {
    name: 'login',
    description: 'Login to TIMPS cloud services',
    category: 'Configuration',
    aliases: ['li'],
  },
  {
    name: 'logout',
    description: 'Logout from TIMPS cloud',
    category: 'Configuration',
    aliases: ['lo'],
  },
  {
    name: 'api-key',
    description: 'Manage API keys',
    category: 'Configuration',
    aliases: ['key'],
    subcommands: ['set', 'get', 'remove'],
  },

  // ═══════════════════════════════════════════════════════════
  // IDE INTEGRATION
  // ═══════════════════════════════════════════════════════════
  {
    name: 'ide',
    description: 'IDE integration settings',
    category: 'Tools',
    aliases: [],
    subcommands: ['connect', 'disconnect', 'status'],
  },
  {
    name: 'chrome',
    description: 'Chrome integration',
    category: 'Tools',
    aliases: ['cr'],
    isHidden: true,
  },
  {
    name: 'desktop',
    description: 'Desktop app integration',
    category: 'Tools',
    aliases: ['dk'],
  },

  // ═══════════════════════════════════════════════════════════
  // INFO & UTILITIES
  // ═══════════════════════════════════════════════════════════
  {
    name: 'status',
    description: 'Show current session status',
    category: 'Info',
    aliases: ['st'],
  },
  {
    name: 'version',
    description: 'Show version information',
    category: 'Info',
    aliases: ['v'],
  },
  {
    name: 'env',
    description: 'Show environment variables',
    category: 'Info',
    aliases: ['e'],
  },
  {
    name: 'keybindings',
    description: 'View keyboard shortcuts',
    category: 'Info',
    aliases: ['kb'],
  },
  {
    name: 'doctor',
    description: 'System health check',
    category: 'Info',
    aliases: ['doc'],
  },
  {
    name: 'cost',
    description: 'Show token usage and cost',
    category: 'Info',
    aliases: ['cst'],
  },
  {
    name: 'usage',
    description: 'Detailed usage statistics',
    category: 'Info',
    aliases: ['u'],
  },
  {
    name: 'stats',
    description: 'Session statistics',
    category: 'Info',
    aliases: ['stat'],
  },
  {
    name: 'models',
    description: 'List available models',
    category: 'Info',
    aliases: ['mod'],
  },
  {
    name: 'help',
    description: 'Show help and command list',
    category: 'Info',
    aliases: ['h', '?'],
  },

  // ═══════════════════════════════════════════════════════════
  // MEMORY & KNOWLEDGE
  // ═══════════════════════════════════════════════════════════
  {
    name: 'memory',
    description: 'Memory management',
    category: 'Tools',
    aliases: ['mem'],
    subcommands: ['query', 'forget', 'export', 'import', 'consolidate', 'stats'],
  },
  {
    name: 'forget',
    description: 'Clear all memories for this project',
    category: 'Tools',
    aliases: ['fgt'],
  },
  {
    name: 'trust',
    description: 'Trust level configuration',
    category: 'Configuration',
    aliases: ['tr'],
    argsHint: '<cautious|normal|trust|yolo>',
  },
  {
    name: 'undo',
    description: 'Undo last changes from snapshots',
    category: 'Tools',
    aliases: [],
    argsHint: '[count]',
  },
  {
    name: 'snapshots',
    description: 'List file snapshots',
    category: 'Tools',
    aliases: ['snap'],
  },
  {
    name: 'forge',
    description: 'ProvenForge version control',
    category: 'Tools',
    aliases: ['fg'],
    subcommands: ['branch', 'log', 'tier', 'stats', 'lineage'],
  },
  {
    name: 'govern',
    description: 'GovernTier policy governance',
    category: 'Enterprise',
    aliases: ['gv'],
    subcommands: ['stats', 'policies', 'evolve'],
  },

  // ═══════════════════════════════════════════════════════════
  // GIT (EXTENDED)
  // ═══════════════════════════════════════════════════════════
  {
    name: 'git',
    description: 'Git operations',
    category: 'Git',
    aliases: ['g'],
    subcommands: ['status', 'log', 'diff', 'branch', 'stash', 'fetch', 'pull', 'push'],
  },

  // ═══════════════════════════════════════════════════════════
  // FILES
  // ═══════════════════════════════════════════════════════════
  {
    name: 'files',
    description: 'Files management',
    category: 'Tools',
    aliases: ['f'],
  },
  {
    name: 'rename',
    description: 'Rename files or sessions',
    category: 'Tools',
    aliases: ['rn'],
    argsHint: '<old-name> <new-name>',
  },
  {
    name: 'export',
    description: 'Export data',
    category: 'Tools',
    aliases: ['exp'],
    subcommands: ['memory', 'session', 'chat'],
  },
  {
    name: 'add-dir',
    description: 'Add working directory',
    category: 'Tools',
    aliases: ['ad'],
    argsHint: '<path>',
  },

  // ═══════════════════════════════════════════════════════════
  // VOICE & MULTIMODAL
  // ═══════════════════════════════════════════════════════════
  {
    name: 'voice',
    description: 'Voice input mode',
    category: 'Tools',
    aliases: ['vo'],
  },
  {
    name: 'vision',
    description: 'Vision and image analysis',
    category: 'Tools',
    aliases: ['vis'],
    argsHint: '<image-path-or-url>',
  },
  {
    name: 'upload',
    description: 'Upload files for context',
    category: 'Tools',
    aliases: ['upl'],
    argsHint: '<file-path>',
  },
  {
    name: 'doc',
    description: 'Parse document for Q&A',
    category: 'Tools',
    aliases: ['d'],
    argsHint: '<document-path>',
  },

  // ═══════════════════════════════════════════════════════════
  // OPTIMUS & HARDCORE
  // ═══════════════════════════════════════════════════════════
  {
    name: 'optimus',
    description: 'Digital Optimus - sentence-to-product pipeline',
    category: 'Tools',
    aliases: ['opt'],
    argsHint: '<product description>',
  },
  {
    name: 'autonomous',
    description: 'Autonomous GitHub integration',
    category: 'Tools',
    aliases: ['auto'],
    isHidden: true,
  },
  {
    name: 'macrohard',
    description: 'Macrohard mode - full corporate employee',
    category: 'Tools',
    aliases: ['mh'],
    isHidden: true,
  },

  // ═══════════════════════════════════════════════════════════
  // PRIVACY & SECURITY
  // ═══════════════════════════════════════════════════════════
  {
    name: 'permissions',
    description: 'Permissions management',
    category: 'Configuration',
    aliases: ['perm'],
    subcommands: ['auto', 'ask', 'yes', 'no'],
  },
  {
    name: 'privacy-settings',
    description: 'Privacy settings',
    category: 'Configuration',
    aliases: ['priv'],
  },
  {
    name: 'sandbox-toggle',
    description: 'Toggle sandbox mode',
    category: 'Configuration',
    aliases: ['sandbox'],
  },

  // ═══════════════════════════════════════════════════════════
  // SYSTEM
  // ═══════════════════════════════════════════════════════════
  {
    name: 'exit',
    description: 'Exit the session',
    category: 'Exit',
    aliases: ['quit', 'q'],
  },
  {
    name: 'cancel',
    description: 'Cancel current operation',
    category: 'Exit',
    aliases: ['canc'],
  },
  {
    name: 'upgrade',
    description: 'Check for upgrades',
    category: 'Info',
    aliases: ['up'],
  },
  {
    name: 'heapdump',
    description: 'Generate heap dump for debugging',
    category: 'Info',
    aliases: ['hd'],
    isHidden: true,
  },
  {
    name: 'install',
    description: 'Install app or extensions',
    category: 'Configuration',
    aliases: ['inst'],
    subcommands: ['github-app', 'slack-app'],
  },
  {
    name: 'onboarding',
    description: 'Show onboarding flow',
    category: 'Info',
    aliases: ['onb'],
  },
  {
    name: 'summary',
    description: 'Generate conversation summary',
    category: 'Session',
    aliases: ['sum'],
  },
  {
    name: 'rate-limit-options',
    description: 'Configure rate limits',
    category: 'Configuration',
    aliases: ['rlo'],
  },
  {
    name: 'reset-limits',
    description: 'Reset rate limits',
    category: 'Configuration',
    aliases: ['rl'],
  },
  {
    name: 'extra-usage',
    description: 'Extra usage settings',
    category: 'Configuration',
    aliases: ['eu'],
  },
  {
    name: 'perf-issue',
    description: 'Performance issue reporting',
    category: 'Info',
    aliases: ['pi'],
  },
  {
    name: 'ant-trace',
    description: 'Debug trace',
    category: 'Info',
    aliases: ['at'],
    isHidden: true,
  },
  {
    name: 'good-claude',
    description: 'Good Claude detection feedback',
    category: 'Info',
    aliases: ['gc'],
    isHidden: true,
  },
  {
    name: 'autofix-pr',
    description: 'Auto-fix PR issues',
    category: 'Tools',
    aliases: ['afp'],
    isHidden: true,
  },
  {
    name: 'subscribe-pr',
    description: 'Subscribe to PR notifications',
    category: 'Enterprise',
    aliases: ['spr'],
    isHidden: true,
  },
  {
    name: 'proactive',
    description: 'Proactive mode',
    category: 'Tools',
    aliases: ['pro'],
    isHidden: true,
  },
  {
    name: 'workflows',
    description: 'Workflow scripts',
    category: 'Tools',
    aliases: ['wf'],
    isHidden: true,
  },
  {
    name: 'peers',
    description: 'Discover peer sessions',
    category: 'Team',
    aliases: [],
    isHidden: true,
  },
  {
    name: 'stickers',
    description: 'Stickers',
    category: 'Info',
    aliases: [],
    isHidden: true,
  },
  {
    name: 'terminalSetup',
    description: 'Terminal setup wizard',
    category: 'Configuration',
    aliases: ['tsetup'],
  },
  {
    name: 'issue',
    description: 'Issue integration',
    category: 'Tools',
    aliases: [],
  },
  {
    name: 'vim',
    description: 'Vim mode',
    category: 'Configuration',
    aliases: [],
  },
  {
    name: 'mobile',
    description: 'Mobile integration',
    category: 'Tools',
    aliases: [],
  },
  {
    name: 'break-cache',
    description: 'Break cache',
    category: 'Tools',
    aliases: ['bc'],
  },
  {
    name: 'extra-usage',
    description: 'Extra usage management',
    category: 'Configuration',
    aliases: ['eu'],
  },
  {
    name: 'auth',
    description: 'OAuth authentication with cloud services',
    category: 'Configuration',
    aliases: [],
    subcommands: ['login', 'logout', 'status', 'refresh'],
  },

  // ═══════════════════════════════════════════════════════════
  // OAUTH & AUTHENTICATION
  // ═══════════════════════════════════════════════════════════
  {
    name: 'insights',
    description: 'Usage insights',
    category: 'Info',
    aliases: ['ins'],
  },
];

export function getCommandsByCategory(category: CommandCategory): CommandDef[] {
  return COMMAND_REGISTRY.filter(cmd => cmd.category === category);
}

export function getCommand(name: string): CommandDef | undefined {
  return COMMAND_REGISTRY.find(cmd =>
    cmd.name === name || cmd.aliases?.includes(name)
  );
}

export function searchCommands(query: string): CommandDef[] {
  const q = query.toLowerCase();
  return COMMAND_REGISTRY.filter(cmd =>
    cmd.name.includes(q) ||
    cmd.description.toLowerCase().includes(q) ||
    cmd.aliases?.some(a => a.includes(q))
  );
}

export function getCommandCategories(): CommandCategory[] {
  return [
    'Git', 'Session', 'Tasks', 'Review', 'MCP',
    'Remote', 'Enterprise', 'Team', 'Tools',
    'Configuration', 'Info', 'Exit',
  ];
}
