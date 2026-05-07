import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/quickstart',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Memory System',
      items: [
        'memory/architecture',
        'memory/working',
        'memory/episodic',
        'memory/semantic',
      ],
    },
    {
      type: 'category',
      label: 'Skills Marketplace',
      items: [
        'skills/overview',
        'skills/installing',
        'skills/creating',
      ],
    },
    {
      type: 'category',
      label: 'MCP Server',
      items: [
        'mcp/tools',
        'mcp/setup',
      ],
    },
    {
      type: 'category',
      label: 'VS Code Extension',
      items: [
        'vscode/overview',
        'vscode/memory-view',
      ],
    },
    {
      type: 'category',
      label: 'CLI Reference',
      items: [
        'cli/commands',
        'cli/slash-commands',
      ],
    },
    {
      type: 'doc',
      id: 'contributing',
      label: 'Contributing',
    },
  ],
};

export default sidebars;
