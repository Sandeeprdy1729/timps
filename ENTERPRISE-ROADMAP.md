# TIMPS Enterprise Roadmap — "One memory layer for every coding agent"

This doc is the gap analysis between **what is built in the repo today** and **what it takes for companies to adopt TIMPS as the memory orchestrator for all their coding agents** (Claude Code, Codex, OpenCode, Kimi, Cursor, Windsurf, Gemini CLI, …).

It is intentionally opinionated: the goal is not "more layers" — it is **adoption**. Every phase below is ordered so that each step is independently shippable and de-risks the next.

---

## 1. The thesis

> Every coding agent today has its own throwaway context. TIMPS is the durable, shared, cross-agent memory layer — and the MCP protocol is the single integration point that already reaches all of them.

The repo already contains the hardest part: a genuinely deep memory engine (22 layers, 25 deterministic intelligence tools, contradiction detection, provenance, CRDT conflict resolution, branches, audit, multimodal). What it does **not** contain yet is the product layer that makes companies comfortable running it at scale.

---

## 2. Gap analysis matrix

Legend: ✅ built today · 🟡 partial / needs packaging · ❌ missing

| Capability companies need | Repo status | Notes |
|---|---|---|
| **Zero-friction install** (`npx timps setup`) | 🟡 | `install.sh` clones the whole monorepo and builds from source. No single `npx` command, no agent auto-registration. |
| **One-binary MCP server** | 🟡 | `timps-mcp` bundles at build time but still `require()`s `zod` / MCP SDK / memory-core from `node_modules` at runtime → not standalone. |
| **Cross-agent capture** (all agents → TIMPS memory) | ✅ | `timps-mcp` is a stdio MCP server with 70 tools; SDK is local-only. Config still has to be hand-written per agent. |
| **Shared canonical store** across agents | ✅ | SDK + CLI + MCP all write to `~/.timps/memory/<projectHash>` (canonical store, one-time migration from legacy). |
| **Local-first by default** | ✅ | LOCAL mode = `MemoryEngine` + `FileBackend`, zero external services. Ollama optional. |
| **Server mode (single deploy)** | ✅ | `packages/server` HTTP API + memory-core `MemoryServer` (REST/gRPC/WS). |
| **Horizontal scale (enterprise)** | ✅ | 9-service compose (Postgres primary + 2 streaming replicas, PgBouncer, Redis, Qdrant, MemoryServer, Prometheus, Grafana, OTel). |
| **Auth / org scoping** | ✅ | `x-org-id/team-id/project-id` middleware, RLS, token auth, rate limiter, encrypted key vault. |
| **Audit + team features** | ✅ | EngramLog audit, team digests, branches, conflict resolution, `timps audit --member --since`. |
| **Telemetry / privacy** | ✅ | `off / local / anonymous` modes, redaction pipeline, Prometheus + Grafana dashboards. |
| **Lossless guarantee (marketing promise)** | 🟡 | Compaction/archival is lossy by design. Needs the "EngramLog is source of truth; every layer is rebuildable" framing and an export format. |
| **Single-binary / native distribution** | ❌ | `download_cli.sh` expects a Rust `timps` binary that isn't wired to the TS CLI. No SEA/pkg binary build for `timps-mcp`. |
| **Managed cloud (SaaS)** | ❌ | No hosted offering, billing was deliberately removed (Phase 3e — TIMPS is free/self-hosted). Cloud = hosting of the same stack, not new features. |
| **SSO / enterprise auth** | ❌ | Local username/password only. No OIDC/SAML/SCIM. |
| **Data residency + export/delete** | ❌ | No egress/export command, no per-tenant retention, no data-residency selection. |
| **Kubernetes deployment** | 🟡 | `deploy/k8s/timps-memory.yaml` exists but no operator/helm, no auth secret wiring, no migration strategy. |
| **Compliance packaging** (SOC2-style evidence) | ❌ | Audit trail exists in code but isn't surfaced as a compliance story. |
| **Cross-agent learning loop** | ✅ | `SelfImprovingAgent` (Phase 6c) tracks mistakes + injects prevention. Not yet cross-agent. |
| **"New dev in an hour" onboarding demo** | 🟡 | Building blocks exist (team digest, branches, audit, codebase memory) but no turnkey onboarding experience. |

---

## 3. Two wedges (do these first)

### Wedge A — `npx timps setup`
One command that detects every installed agent and registers TIMPS as its MCP server. No cloning, no Docker, no build.

- Detects: Claude Code, Codex, OpenCode, Cursor, Windsurf, Gemini CLI, (Kimi when config format is known).
- Writes the correct config per agent (`.claude.json`, `config.toml`, `opencode.json`, `.cursor/mcp.json`, `windsurf/mcp_config.json`, `.gemini/settings.json`).
- Defaults to LOCAL mode (FileBackend) so it works with zero infrastructure and zero API keys.
- `--list` to show what's wired; `--uninstall` to remove.

**Why this wins:** it converts the 30-minute "clone monorepo + build + hand-edit 3 config files" into a 30-second command. That is the entire first-adoption funnel.

> ✅ **Implemented** in `timps-code/src/commands/setup.ts` (13 unit tests, `timps setup --list/--uninstall/--server/--binary/--dry-run`), wired into `timps-code/src/bin/timps.ts`.

### Wedge B — standalone `timps-mcp` bundle + true single binary
One self-contained JS file (esbuild bundle, all deps inlined except the 4 lazy native-only deps `pg`/`ioredis`/`better-sqlite3`/`@qdrant/js-client-rest`), plus a single-file executable (Bun compile preferred; Node SEA fallback).

**Why this wins:** agents that are picky about `npx` spawn latency (Claude Code, Codex) get a stable absolute path; enterprise deploys can copy one file into a controlled location without a package registry.

> ✅ **Implemented**: `timps-mcp` `build:standalone` → `dist/timps-mcp.cjs` (4MB, verified MCP handshake + 69 tools standalone); `timps-mcp/scripts/build-binary.sh` → `dist/bin/timps-mcp` (62MB Bun-compiled binary, verified). Note: Node SEA segfaults on Node 22 + macOS arm64 (known Node bug), so Bun is the default and SEA is a fallback.

---

## 4. Phased roadmap

### Phase 0 — Foundation (this repo, now)
- ✅ Already true: canonical store, MCP server, SDK, local-first, server mode, horizontal scale, audit, telemetry.
- ✅ Land Wedge A + Wedge B (this PR) — both shipped (see above).
- Define the **lossless framing** publicly: EngramLog append-only log is the source of truth; every forge layer is derived and rebuildable. Add `timps memory export` (JSONL of the full log) + `timps memory verify` (rebuild layers from log → checksum). This converts "we keep every byte" into something both true and defensible.

**Exit criteria:** `curl … | npx timps setup` wires a new machine into Claude Code + Codex + OpenCode in under a minute, all local, with memories visible across agents.

### Phase 1 — Distribution
- Publish `@timps-ai/timps-mcp` and `@timps-ai/timps-code` (changesets already configured).
- CI builds the standalone bundle + SEA binaries for darwin/linux x64/arm64 (8 targets, mirroring `memory-core-rs`).
- `download_cli.sh` → installs the real `timps` + `timps-mcp` binaries from GitHub Releases (replaces the dead Rust path).
- Make `timps setup` resolve the locally-installed binary when present, else `npx`.

**Exit criteria:** a new user on macOS and on Linux can run the whole product from pre-built artifacts, never touching a TypeScript build.

### Phase 2 — Enterprise server packaging
- Single-binary `timps-server` (Node SEA) bundling `packages/server` + `MemoryServer`, with `timps init server` producing a runnable stack.
- OIDC/SAML SSO (auth strategy plug-in — keep local auth as default), SCIM provisioning.
- Data residency: per-tenant storage prefix + region selection via config.
- `timps memory export/import/delete` for egress + right-to-be-forgotten; retention policies on the EngramLog.
- Helm chart + k8s operator for the existing compose stack (Postgres replicas + PgBouncer + Redis + Qdrant), with auth secret management.

**Exit criteria:** a company can stand up an on-prem instance from a single tarball, integrate SSO, and pass a data-export audit.

### Phase 3 — Managed cloud
- Host the same stack per tenant (shared Postgres w/ RLS → isolated DB → dedicated cluster as revenue grows).
- `timps login` + `TIMPS_SERVER_URL` already exist — wire them to the cloud control plane.
- Billing is a deliberate non-goal for the open product; the cloud is where paid tiers live.

**Exit criteria:** `npx timps setup --cloud` wires a machine to a managed tenant in minutes.

### Phase 4 — The differentiator (the moat)
- **Cross-agent learning loop:** feed `SelfImprovingAgent` records from every agent (via MCP `timps_record_mistake`) into a per-team prevention layer that every agent's system prompt picks up.
- **Onboarding product:** "new dev in an hour" — team digest + branches + audit + codebase memory packaged as `timps onboard <repo>` producing a briefing doc and a pre-warmed memory.
- Keep the 25-tool count as the marketing anchor, but sell outcomes (contradiction caught, bug pattern avoided, onboarding time) not layers.

**Exit criteria:** a documented demo where a new engineer runs `timps onboard` and a full repo brief in <1 hour, and where a bug pattern caught by TIMPS is attributable in a case study.

---

## 5. Priority rationale

1. **Wedge first, always.** Adoption is the constraint, not depth. Nothing else in this doc matters until `timps setup` is one command.
2. **Lossless framing is free and urgent.** It's a positioning change + one export command; it prevents the single biggest trust objection (finding a purged memory).
3. **Enterprise trust (SSO, residency, export) before managed cloud.** Companies won't send code memory to a SaaS they can't audit; on-prem-first is the only realistic entry.
4. **The learning loop is the moat** — competitors can copy storage, not the accumulated cross-agent mistake model.

## 6. Risks

- **Scope creep into "more features".** Guard with the exit criteria above; features that don't serve adoption are cut.
- **`npx` spawn latency** on some agents (Codex) → mitigated by Wedge B's stable binary path.
- **Config-format churn** in agent tools (opencode/codex/gemini change schemas) → keep agent adapters in one file, version them, degrade gracefully when a schema is unrecognized.
- **"Lossless" overclaim** → only ever promise *the log is lossless and every layer rebuilds from it*, and ship `verify` to prove it.
- **Security hygiene** → `packages/server/.env` currently contains a committed OpenRouter key; rotate it and add a secret scanner pre-commit before any enterprise conversation.

## 7. Definition of "companies use it"

A company is a customer when:
1. `npx timps setup` wires their whole org's agents in one command (local or cloud).
2. An engineer can answer "why is this code like this?" with a memory the *team's* agents wrote.
3. Compliance can run `timps memory export` + read the audit log in 10 minutes.
4. The memory survives agent churn (new agent, new laptop, new tool) with zero data loss.
