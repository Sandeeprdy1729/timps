---
"@timps-ai/timps-mcp": patch
"timps-code": minor
---

### `timps setup` now installs memory-usage instructions — auto-capture is on by default

- **What changed:** `timps setup` appends a marker-fenced block (`<!-- timps:memory:start/end -->`) to each detected agent's global rule file telling it to pull TIMPS context at session start and store user data as it happens. Memory capture no longer depends on model whims.
- **Files written:** `~/.claude/CLAUDE.md`, `~/.config/opencode/AGENTS.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, and a Cursor rule `~/.cursor/rules/timps.mdc` (`alwaysApply: true` frontmatter). Windsurf gets MCP registration only (no user-level instruction file).
- **Idempotent + reversible:** re-running `timps setup` is a no-op when the block is present; `timps setup --uninstall` removes it. `--no-instructions` skips it; `--dry-run` previews without writing.
- **Gemini detection** now also fires when `~/.gemini/GEMINI.md` exists.
- **Fixed misleading message:** "no change (timps not registered)" → "already registered (no config change)".

### New CLI commands — context anywhere

- `timps recall "<query>" [--limit N] [--project <path>]` — search TIMPS memory from any terminal (defaults to the current project).
- `timps context [--project <path>]` — print the full memory context string, same one agents get.

### Path canonicalization for shared stores

- `projectHash()` now resolves symlinks (`fs.realpathSync`) so a project reachable via multiple path spellings (e.g. `/tmp/…` vs `/private/tmp/…` on macOS) maps to **one** memory store. Agent-stored memories and terminal recall now always converge on the same `~/.timps/memory/<hash>/`.
