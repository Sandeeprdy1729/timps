// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    'quickstart',
    {
      type: 'category',
      label: 'Configuration',
      items: ['providers', 'memory', 'plugins'],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: ['recipes', 'eval', 'acp'],
    },
    {
      type: 'category',
      label: 'Packages',
      items: ['packages/timps-code', 'packages/timps-mcp', 'packages/timps-vscode', 'packages/plugin-sdk'],
    },
    'contributing',
  ],
};
module.exports = sidebars;
