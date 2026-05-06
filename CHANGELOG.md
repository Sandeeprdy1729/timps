# Changelog

All notable changes to TIMPS are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- AGENTS.md — codebase guide for AI agents working in this repo
- SECURITY.md — security policy and vulnerability reporting process
- GitHub issue templates upgraded to structured YAML forms (bug, feature, setup help)
- `setup_help.yml` issue template — guided troubleshooting for new users
- `.github/dependabot.yml` — weekly automated dependency update PRs
- `.github/workflows/supply-chain-audit.yml` — npm audit + OSV scanning on every push
- `.github/workflows/docker-publish.yml` — multi-arch Docker image auto-publish on tag
- `timps --doctor` diagnostic command to self-diagnose config issues

---

## [2.0.0] — 2025-04-01

### Added
- **Swarm mode** — spawn and orchestrate multiple parallel sub-agents (`timps-code/src/swarm/`)
- **Team memory** — shared episodic memory across agents in a swarm session
- **Multimodal commands** — attach images and screenshots to agent tasks
- **Memory branching** — `timps --branch <name>` / `timps --merge <name>` for safe memory snapshots
- **Hybrid provider** — Ollama + cloud API fallback with configurable thresholds
- **`/git` slash command** — view status and diff from inside the agent session
- **`/mcp` slash command** — list and inspect connected MCP servers
- Extended tool set to 25 tools (added `todo_create`, `todo_list`, `todo_update`, `think`, `plan`)
- `timps-mcp` v1.0 — 20 MCP tools for Claude Code, Cursor, Windsurf
- VS Code extension v1.2 — Memory Explorer panel, `Cmd+Esc` terminal shortcut
- Data pipeline modules: SWE-bench runner, GRPO training, binary synthesis

### Changed
- Memory storage format migrated to per-project hash directories (`~/.timps/memory/<hash>/`)
- Provider selection now auto-detects running Ollama instance on startup
- TUI rebuilt on Ink 4 — faster rendering, better interrupt handling

### Fixed
- Session memory not persisting across restarts when Ollama was slow to respond
- `timps --config` wizard not respecting existing config on re-run
- Multi-edit tool failing on files with Windows-style line endings

---

## [1.2.0] — 2025-02-14

### Added
- OpenRouter provider support (200+ models via single API key)
- DeepSeek provider support
- `timps --model <name>` flag to select model without entering config wizard
- Skills system v1 — `/skills list`, `/skills install <name>`
- `web_search` and `web_fetch` tools

### Changed
- Default Ollama model changed from `llama3:8b` to `qwen2.5-coder:7b` (better coding)

### Fixed
- Race condition in episodic memory write on session exit
- Gemini provider not streaming tool call responses correctly

---

## [1.1.0] — 2025-01-20

### Added
- Gemini provider (free tier available)
- Memory commands: `/memory`, `/branch <name>`, `/merge <name>`, `/clear`
- Self-correction loop — agent retries up to 3 times on tool failure with revised approach
- `run_tests`, `lint`, `type_check` tools for code quality

### Fixed
- Claude provider hanging on long streaming responses

---

## [1.0.0] — 2025-01-01

### Added
- Initial release of `timps-code` CLI coding agent
- 3-layer memory system (working, episodic, semantic)
- Ollama provider (default — free, local)
- Claude and OpenAI providers
- 15 core tools: file ops, git, shell, grep, search
- Interactive TUI (Ink-based)
- One-shot mode: `timps "do this task"`
- `timps --config` setup wizard
- MIT license

[Unreleased]: https://github.com/Sandeeprdy1729/timps/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Sandeeprdy1729/timps/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/Sandeeprdy1729/timps/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Sandeeprdy1729/timps/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Sandeeprdy1729/timps/releases/tag/v1.0.0
