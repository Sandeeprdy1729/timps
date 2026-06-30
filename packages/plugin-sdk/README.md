# @timps-ai/plugin-sdk

Formal interface for extending TIMPS agents with custom commands, tools, and lifecycle hooks.

```bash
npm install @timps-ai/plugin-sdk
```

## Usage

```typescript
import { PluginRegistry, loadPlugin } from '@timps-ai/plugin-sdk'
import type { Plugin } from '@timps-ai/plugin-sdk'

const registry = new PluginRegistry()

// Register a plugin with manifest + handler maps
const myPlugin: Plugin = {
  manifest: {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'Custom commands for my workflow',
    commands: [{ name: 'hello', description: 'Say hello', usage: '/hello <name>' }],
    tools: [{
      name: 'greet',
      description: 'Greet someone',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
    }],
    hooks: ['before:run', 'after:run'],
  },
  commands: {
    hello: async (args, ctx) => `Hello, ${args[0] || 'world'}!`
  },
  tools: {
    greet: async (params, ctx) => ({ output: `Hello, ${params.name}!` })
  },
  hooks: {
    'before:run': async (event, payload, ctx) => { console.log('Starting run...') },
    'after:run': async (event, payload, ctx) => { console.log('Run complete') }
  },
  setup: async (ctx) => { console.log('Plugin initialized') },
  teardown: async (ctx) => { console.log('Plugin cleaned up') },
}

registry.register(myPlugin)

// List registered plugins
console.log(registry.list())

// Resolve a command handler
const handlers = registry.resolveCommand('hello')
console.log(handlers[0].plugin.manifest.name)

// Get all tool specs + handlers
console.log(registry.allTools().length, 'tools registered')

// Load a plugin from a file (default export must be a Plugin object)
const filePlugin = await loadPlugin('./path/to/plugin.js')
registry.register(filePlugin)
```

## Plugin Interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `manifest` | `PluginManifest` | ✅ | Static metadata (name, version, description, commands, tools, hooks) |
| `commands` | `Record<string, CommandHandler>` | ❌ | Command name → handler mapping |
| `tools` | `Record<string, ToolHandler>` | ❌ | Tool name → handler mapping |
| `hooks` | `Partial<Record<HookName, HookHandler>>` | ❌ | Lifecycle hooks |
| `setup` | `(ctx: PluginContext) => Promise<void>` | ❌ | Called once on activation |
| `teardown` | `(ctx: PluginContext) => Promise<void>` | ❌ | Called once on deactivation |

## Handler Signatures

```typescript
type CommandHandler = (args: string[], ctx: PluginContext) => Promise<string>
type ToolHandler = (params: Record<string, unknown>, ctx: PluginContext) => Promise<{ output: string; error?: string }>
type HookHandler = (event: HookName, payload: unknown, ctx: PluginContext) => Promise<void>
```

## MemoryAPI

The `PluginContext.memory` property provides access to the host agent's memory. This is a dependency-injected interface — plugin authors must test within a host that provides `MemoryAPI`.

```typescript
interface MemoryAPI {
  loadSemantic(projectPath: string): Promise<SemanticEntry[]>
  saveSemantic(projectPath: string, entries: SemanticEntry[]): Promise<void>
  loadEpisodes(projectPath: string, count?: number): Promise<EpisodicEntry[]>
  appendEpisode(projectPath: string, entry: EpisodicEntry): Promise<void>
}
```
