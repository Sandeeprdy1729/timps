---
sidebar_position: 4
---

# Plugins

TIMPS has a plugin system built on `@timps/plugin-sdk`. Plugins add new tools, slash commands, and lifecycle hooks.

## Install a plugin

```bash
timps plugin install @timps-plugin/git
timps plugin install @timps-plugin/shell
```

## List installed plugins

```bash
timps plugin list
```

## Remove a plugin

```bash
timps plugin remove git
```

## Create a plugin

```bash
timps plugin create my-plugin
cd my-plugin
npm install
npm run build
```

This scaffolds a new plugin with:
- `src/index.ts` — plugin definition
- `package.json` — ready to publish to npm
- `tsconfig.json` — TypeScript config

## Plugin structure

```typescript
import type { Plugin } from '@timps/plugin-sdk';

const plugin: Plugin = {
  manifest: {
    name: 'my-plugin',
    version: '0.1.0',
    description: 'My TIMPS plugin',
  },

  tools: [
    {
      name: 'my_tool',
      description: 'Does something useful',
      parameters: {
        type: 'object',
        properties: { input: { type: 'string' } },
        required: ['input'],
      },
      async execute({ input }) {
        return { content: `Result: ${input}` };
      },
    },
  ],
};

export default plugin;
```

## Publish a plugin

```bash
npm login
timps plugin publish
```

Your plugin will be listed in the TIMPS Plugin Marketplace at [timps.dev/plugins](https://timps.dev/plugins).

## Official plugins

| Plugin | Package | Description |
| --- | --- | --- |
| git | `@timps-plugin/git` | Enhanced git: commit, push, branch, stash, visual log |
| shell | `@timps-plugin/shell` | Shell with timeout, pipe, env inspection |
