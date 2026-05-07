---
sidebar_position: 99
---

# Contributing

TIMPS is open source and welcomes contributions.

## Repo structure

```
timps/
├── packages/memory-core/   # @timps/memory-core — standalone npm package
├── timps-code/             # CLI coding agent
├── timps-mcp/              # MCP server
├── timps-vscode/           # VS Code extension
├── docs/                   # This Docusaurus site
└── sandeep-ai/             # Full server + REST API
```

## Checklist before opening a PR

- `npx tsc --noEmit` passes in the affected package
- Tests pass: `npm test` (or `turbo run test`)
- New tools have accurate descriptions (the agent uses them for routing)
- Memory schema changes are backwards compatible
- Update `CHANGELOG.md` under `[Unreleased]`

## Adding a skill

The easiest contribution. Edit `timps-code/src/skills/registry.json` to add a new skill entry. See [Creating Skills](./skills/creating).

## Running the full build

```bash
# From the repo root
npm run build      # turbo run build — all packages in dependency order

# Test
npm run test       # turbo run test

# Typecheck
npm run typecheck
```

## Changesets

This repo uses [Changesets](https://github.com/changesets/changesets). To add a changeset:

```bash
npx changeset
```

Pick the affected packages, choose patch/minor/major, and write a summary.
