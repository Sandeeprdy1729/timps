// @ts-check
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'TIMPS',
  tagline: 'The AI Coding Agent That Remembers',
  favicon: 'img/favicon.ico',
  url: 'https://timps.dev',
  baseUrl: '/',
  organizationName: 'Sandeeprdy1729',
  projectName: 'timps',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/Sandeeprdy1729/timps/tree/main/packages/docs/',
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: { defaultMode: 'dark', respectPrefersColorScheme: true },
      image: 'img/social-card.png',
      navbar: {
        title: 'TIMPS',
        logo: { alt: 'TIMPS Logo', src: 'img/logo.svg' },
        items: [
          { type: 'docSidebar', sidebarId: 'tutorialSidebar', position: 'left', label: 'Docs' },
          { href: 'https://github.com/Sandeeprdy1729/timps', label: 'GitHub', position: 'right' },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/docs/intro' },
              { label: 'Providers', to: '/docs/providers' },
              { label: 'Plugins', to: '/docs/plugins' },
              { label: 'Recipes', to: '/docs/recipes' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub', href: 'https://github.com/Sandeeprdy1729/timps' },
              { label: 'npm', href: 'https://www.npmjs.com/package/timps-code' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} TIMPS. MIT License.`,
      },
      prism: { theme: { plain: {}, styles: [] }, darkTheme: { plain: {}, styles: [] } },
    }),
};

module.exports = config;
