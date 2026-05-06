# AGENTS.md — TIMPS Codebase Guide for AI Agents

This file provides context for AI coding agents (GitHub Copilot, Claude, Cursor, etc.) working in this repository.

## Repo Structure

```
timps/
├── timps-code/     # CLI coding agent  (npm install -g timps-code)
│   └── src/
│       ├── agent/          # Coder, Planner, Verifier agents
│       ├── core/           # App loop, session manager, task scheduler
│       ├── tools/          # 25+ tools (file, git, shell, web, etc.)
│       ├── memory/         # 3-layer memory system
│       ├── models/         # Provider adapters (Claude, GPT, Gemini, Ollama)
│       ├── swarm/          # Multi-agent orchestration
│       ├── commands/       # Slash command handlers
│       └── ui/             # Ink/React TUI components
│
├── timps-mcp/      # MCP server — 20 persistent-memory tools
│   └── src/
│       ├── tools/          # MCP tool definitions
│       └── memory/         # Shared memory layer
│
├── timps-vscode/   # VS Code extension
│   └── src/
│       ├── extension.ts    # Entry point
│       ├── chatPanel.ts    # Webview chat UI
│       ├── memory.ts       # Memory sidebar
│       └── features/       # Individual extension features
│
└── sandeep-ai/     # Full server — REST API + web dashboard + 17 intelligence tools
    └── src/
        ├── core/           # Agent loop, planner, executor
        ├── memory/         # Long-term + embedding memory
        ├── tools/          # Extended tool set
        └── api/            # Express REST routes
```

## Key Conventions

### TypeScript
- All packages use **TypeScript** with `"module": "ESNext"` and strict mode
- Use `tsx` for development, `tsc` for production builds
- Output goes to `dist/` — never commit compiled output
- Imports use `.js` extensions (ESM requirement): `import { foo } from './bar.js'`

### Tools architecture (timps-code)
- All tools extend the `Tool` interface in `src/tools/tools.ts`
- Tools export a `schema` (JSON Schema for parameters) and an `execute` function
- The agent picks tools by matching the task intent to tool descriptions — keep descriptions accurate

### Memory architecture
- **Working memory** — `src/memory/snapshot.ts` — in-memory, reset on process exit
- **Episodic memory** — `src/memory/memory.ts` — persisted to `~/.timps/memory/<hash>/episodes.jsonl`
- **Semantic memory** — `src/memory/memory.ts` — persisted to `~/.timps/memory/<hash>/semantic.json`
- Memory keys are scoped per project using a hash of the absolute project path

### Agent loop (timps-code)
1. User input → `src/core/app.ts` → `AgentLoop.run()`
2. Agent calls `src/core/agent.ts` with tools + system prompt
3. Tools execute via `src/tools/tools.ts` router
4. Results stream back to the TUI via `src/ui/App.tsx`

### Error handling
- Tool errors are caught and fed back to the agent as observations, not thrown
- The agent retries up to 3 times with a revised approach on tool failure
- Fatal errors surface to the user via the TUI error panel

## Testing

```bash
# timps-code
cd timps-code && npm test

# All packages
npm run test --workspaces
```

Tests live in `src/**/*.test.ts` and use Jest.

## Build & Release

```bash
# Build all packages
cd timps-code && npm run build
cd timps-mcp && npm run build
cd timps-vscode && npm run compile

# Publish (maintainers only)
cd timps-code && npm publish
cd timps-mcp && npm publish
```

The `prepublishOnly` script runs `tsc` automatically.

## What NOT to change without discussion

- The 3-layer memory schema (`semantic.json`, `episodes.jsonl`, `working.json`) — backwards compat matters
- The MCP tool names in `timps-mcp` — downstream users depend on these
- The VS Code extension activation events — affects startup performance

## Contributing Checklist

Before opening a PR:
- [ ] `npx tsc --noEmit` passes in the affected package
- [ ] New tools have accurate descriptions (the agent uses them for routing)
- [ ] Memory schema changes are backwards compatible
- [ ] Update `CHANGELOG.md` under `[Unreleased]`
