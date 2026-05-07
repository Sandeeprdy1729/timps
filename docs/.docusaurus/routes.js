import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs',
    component: ComponentCreator('/docs', '92f'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', '951'),
        routes: [
          {
            path: '/docs',
            component: ComponentCreator('/docs', '534'),
            routes: [
              {
                path: '/docs/',
                component: ComponentCreator('/docs/', 'ec3'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/cli/commands',
                component: ComponentCreator('/docs/cli/commands', 'f07'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/cli/slash-commands',
                component: ComponentCreator('/docs/cli/slash-commands', '764'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/contributing',
                component: ComponentCreator('/docs/contributing', '26f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/getting-started/configuration',
                component: ComponentCreator('/docs/getting-started/configuration', '4f7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/getting-started/installation',
                component: ComponentCreator('/docs/getting-started/installation', 'f1f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/getting-started/quickstart',
                component: ComponentCreator('/docs/getting-started/quickstart', 'dd9'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/mcp/setup',
                component: ComponentCreator('/docs/mcp/setup', 'ecb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/mcp/tools',
                component: ComponentCreator('/docs/mcp/tools', '275'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/memory/architecture',
                component: ComponentCreator('/docs/memory/architecture', 'a83'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/memory/episodic',
                component: ComponentCreator('/docs/memory/episodic', 'ff7'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/memory/semantic',
                component: ComponentCreator('/docs/memory/semantic', '74a'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/memory/working',
                component: ComponentCreator('/docs/memory/working', '275'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/skills/creating',
                component: ComponentCreator('/docs/skills/creating', '59f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/skills/installing',
                component: ComponentCreator('/docs/skills/installing', '5f2'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/skills/overview',
                component: ComponentCreator('/docs/skills/overview', '8c3'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/vscode/memory-view',
                component: ComponentCreator('/docs/vscode/memory-view', '585'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/vscode/overview',
                component: ComponentCreator('/docs/vscode/overview', '859'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
