# TIMPS Roadmap

> This roadmap tracks the major milestones for the TIMPS project.
> Status: ✅ Done · 🚧 In Progress · 📅 Planned

---

## Foundation (Phases 1–5) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 1 | `@timps/memory-core` extracted as standalone package | ✅ |
| 2 | 46 MCP tools + benchmark | ✅ |
| 3 | Skills Marketplace + VS Code memory UI | ✅ |
| 4 | Turborepo 2.9.9 monorepo setup | ✅ |
| 5 | Web memory dashboard (sigma.js knowledge graph) | ✅ |

---

## Performance & Desktop (Phases 6–8) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 6 | Rust memory core (NAPI-RS, 19 tests) | ✅ |
| 7 | Tauri v2 desktop app skeleton | ✅ |
| 8 | CI/CD (ci.yml + tauri-release.yml) | ✅ |

---

## Extensibility (Phases 9–11) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 9 | `@timps/plugin-sdk` (17 Vitest tests) | ✅ |
| 10 | PluginManager wired into timps-code (15 Jest tests) | ✅ |
| 11 | CHANGELOG + release infrastructure | ✅ |

---

## Rust Native Stack (Phases 12–14) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 12 | Rust agent core (crates: agent, providers×14, memory, tools, server, CLI) | ✅ |
| 13 | Tauri desktop: ChatView, SettingsView, tray, global hotkey | ✅ |
| 14 | Provider parity: 14 providers (added xAI + Fireworks) | ✅ |

---

## Power Features (Phases 15–17) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 15 | Recipes — YAML workflow runner + 4 built-in workflows | ✅ |
| 16 | Plugin marketplace — plugin-git, plugin-shell, plugins.json | ✅ |
| 17 | Eval harness — runner + 3 eval suites | ✅ |

---

## Distribution (Phases 18–20) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 18 | Docusaurus docs site (`packages/docs`) | ✅ |
| 19 | ACP multi-agent protocol (Rust + TypeScript) | ✅ |
| 20 | Native installer: `download_cli.sh`, Homebrew formula, release.yml | ✅ |

---

## Community (Phases 21–22) ✅

| Phase | Feature | Status |
| --- | --- | --- |
| 21 | Community infra: issue templates, stale.yml, ROADMAP.md | ✅ |
| 22 | Enterprise team memory: JWT auth, shared memories, Stripe stub | ✅ |

---

## Future

### v0.2 — Smarter Agent
- [ ] `timps watch` — continuous background mode (file watcher + auto-review on save)
- [ ] Structured tool output format (JSON schema validation per tool)
- [ ] Streaming token budget display in TUI

### v0.3 — Team & Sharing
- [ ] Team memory sync via `timps-enterprise` REST API
- [ ] Shared recipe library (pull from GitHub with `timps recipe pull`)
- [ ] Plugin sandboxing (WASM-based isolation)

### v1.0 — Stability
- [ ] Stable MCP tool names (breaking-change freeze)
- [ ] Memory schema v2 with migration script
- [ ] Signed binaries + notarization for macOS distribution
- [ ] VS Code extension marketplace release

---

_Last updated: auto-generated. See [CHANGELOG.md](./CHANGELOG.md) for release notes._
