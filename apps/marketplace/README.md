# TIMPS Marketplace

> **Status: 🟡 Experimental — not published yet.**
> - All integration and plugin data is **hardcoded** (12 integrations, 26 plugins in TypeScript arrays) — no live registry backend
> - API routes exist as empty directory structures — no handler implementations
> - Unused heavy dependencies (`@stripe`, `@sentry/node`, `@linear/sdk`, `@octokit/rest`, `jsforce`, `@hubspot/api-client`, `@datadog/datadog-api-client`)

Next.js app for browsing TIMPS integrations and plugins. Built with Next.js 14.

```bash
cd apps/marketplace
npm install
npm run dev
```
