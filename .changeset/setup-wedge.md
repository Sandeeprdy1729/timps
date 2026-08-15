---
"@timps-ai/timps-code": patch
"@timps-ai/timps-mcp": patch
---

### Wedge: single `npx timps setup` + standalone timps-mcp binary

- **`timps setup`** — register TIMPS as an MCP server for every coding agent installed on the machine (Claude Code, Codex CLI, OpenCode, Cursor, Windsurf, Gemini CLI). Options: `--list`, `--uninstall`, `--server <url>` (point agents at a shared MemoryServer), `--binary <path>` (point at a local binary), `--dry-run`. Default mode is local (FileBackend in the agent's project dir — no server, no API keys).
- **`timps-mcp` standalone packaging** — new `build:standalone` (esbuild bundle, 4MB CJS) and `scripts/build-binary.sh` (single-file executable via Bun compile, Node SEA fallback). Agents can now point MCP configs at a binary instead of `npx -y @timps-ai/timps-mcp` for stable, low-latency spawns. External lazy-loaded deps (pg, ioredis, better-sqlite3, @qdrant/js-client-rest) stay external.
