import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'TIMPS',
  tagline: 'A persistent cognitive partner that remembers, evolves, and builds with you',
  favicon: 'img/favicon.ico',
  url: 'https://timps.dev',
  baseUrl: '/',
  organizationName: 'Sandeeprdy1729',
  projectName: 'timps',
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/Sandeeprdy1729/timps/edit/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      title: 'TIMPS',
      logo: {
        alt: 'TIMPS Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/Sandeeprdy1729/timps',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/docs/intro' },
            { label: 'Memory Architecture', to: '/docs/memory/architecture' },
            { label: 'MCP Tools', to: '/docs/mcp/tools' },
          ],
        },
        {
          title: 'Packages',
          items: [
            { label: 'timps-code (CLI)', href: 'https://www.npmjs.com/package/timps-code' },
            { label: 'timps-mcp (MCP Server)', href: 'https://www.npmjs.com/package/timps-mcp' },
            { label: '@timps/memory-core', href: 'https://www.npmjs.com/package/@timps/memory-core' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/Sandeeprdy1729/timps' },
            { label: 'Contributing', href: 'https://github.com/Sandeeprdy1729/timps/blob/main/contributing.md' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} TIMPS. Built with Docusaurus.`,
    },
    prism: {
      theme: { plain: { color: '#393A34', backgroundColor: '#f6f8fa' }, styles: [] },
      darkTheme: { plain: { color: '#F8F8F2', backgroundColor: '#282A36' }, styles: [] },
      additionalLanguages: ['bash', 'typescript', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
