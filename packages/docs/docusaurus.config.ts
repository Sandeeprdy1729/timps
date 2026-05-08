{
  "name": "@timps/docs",
  "version": "1.0.0",
  "private": true,
  "description": "TIMPS Documentation Generator",
  "main": "src/index.js",
  "scripts": {
    "dev": "docusaurus start",
    "start": "docusaurus start",
    "build": "docusaurus build",
    "serve": "docusaurus serve",
    "clear": "docusaurus clear",
    "write-translations": "docusaurus write-translations",
    "docusaurus": "docusaurus"
  },
  "dependencies": {
    "@docusaurus/core": "^3.1.0",
    "@docusaurus/plugin-client-redirects": "^3.1.0",
    "@docusaurus/plugin-ideal-image": "^3.1.0",
    "@docusaurus/preset-classic": "^3.1.0",
    "@mdx-js/react": "^3.0.0",
    "@tailwindcss/typography": "^0.5.10",
    "clsx": "^2.1.0",
    "docusaurus-plugin-tailwindcss": "^0.1.0",
    "prism-react-renderer": "^2.3.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "redocusaurus": "^2.0.0"
  },
  "devDependencies": {
    "@docusaurus/eslint-plugin": "^3.1.0",
    "@docusaurus/module-type-aliases": "^3.1.0",
    "@docusaurus/types": "^3.1.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0"
  },
  "browserslist": {
    "production": [
      ">0.5%",
      "last 2 versions",
      "Firefox ESR",
      "not dead",
      "not IE 11"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}

module.exports = {
  title: 'TIMPS',
  tagline: 'The AI Coding Agent That Remembers',
  url: 'https://timps.ai',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'anomalyco',
  projectName: 'timps',

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          sidebarCollapsible: true,
          LastUpdated: true,
          editUrl: 'https://github.com/anomalyco/timps/edit/main/',
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/anomalyco/timps/edit/main/',
        },
        theme: {
          customHook: () => null,
          customNavs: () => null,
          footerLink: '',
        },
      },
    ],
  ],

  themeConfig: {
    image: 'img/timps-social.png',
    announcementBar: {
      id: 'announcement',
      content: '🎉 TIMPS v2.0 is now available! Check out the new features.',
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      isCloseable: true,
    },
    navbar: {
      title: 'TIMPS',
      logo: {
        alt: 'TIMPS Logo',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'doc',
          docId: 'getting-started/installation',
          position: 'left',
          label: 'Getting Started',
        },
        {
          type: 'docSidebar',
          sidebar: 'integrations',
          position: 'left',
          label: 'Integrations',
        },
        {
          type: 'doc',
          docId: 'api/overview',
          position: 'left',
          label: 'API',
        },
        {
          type: 'search',
          position: 'right',
        },
        {
          to: '/blog',
          label: 'Blog',
          position: 'right',
        },
        {
          href: 'https://github.com/anomalyco/timps',
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
            {
              label: 'Getting Started',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'API Reference',
              to: '/docs/api/overview',
            },
            {
              label: 'Configuration',
              to: '/docs/getting-started/configuration',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/timps',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/timpsai',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/anomalyco/timps',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} TIMPS. Built with Docusaurus.`,
    },
    docs: {
      sidebar: {
        hideLast: true,
        collapsed: false,
      },
    },
    prism: {
      theme: prismLight,
      darkTheme: prismDark,
      additionalLanguages: ['bash', 'json', 'typescript', 'yaml'],
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: { start: 'highlight-start', end: 'highlight-end' },
        },
      ],
    },
    algolia: {
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_SEARCH_API_KEY',
      indexName: 'timps',
    },
  },

  themes: ['@docusaurus/theme-live-codeblock'],
  plugins: [
    'docusaurus-plugin-tailwindcss',
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          { from: '/old-page', to: '/new-page' },
        ],
      },
    ],
    [
      '@docusaurus/plugin-ideal-image',
      {
        quality: 70,
        max: 1030,
        min: 640,
        steps: 2,
      },
    ],
  ],
  
  customFields: {
    env: process.env.NODE_ENV,
  },

  webpack: {
    jsLoader: (isServer) => ({
      loader: 'esbuild-loader',
      options: {
        loader: 'tsx',
        target: isServer ? 'node18' : 'es2020',
      },
    }),
  },

  staticDirectories: ['static', 'img'],
};