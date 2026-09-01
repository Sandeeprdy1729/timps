# TIMPS — Auto-Setup by Any Coding Agent

> **Read me and act.** This file is the one-stop instruction sheet for turning TIMPS
> (persistent memory for AI coding agents) into a working MCP server on the user's
> machine — no matter which coding agent you are.
>
> You are one of: **Claude Code, OpenCode, Cursor, Windsurf, Antigravity, ZCode,
> Kimi Code, Qwen Code, Codex, Gemini CLI, Hermes, OpenClaw, Cline, Aider, Goose,
> Continue, Zed, JetBrains AI Assistant, ... or anything else that can speak MCP.**
>
> Your job: **read this file, then perform the setup steps below on the user's
> laptop.** After you finish, TIMPS should be wired into *every* coding agent the
> user has installed, and its memory will persist across sessions automatically.

---

## 0. What we are setting up (30-second mental model)

TIMPS is an **MCP server** that gives coding agents a persistent memory layer.
It exposes `timps_*` tools (`timps_store_memory`, `timps_get_memories`,
`timps_check_contradiction`, `timps_record_incident`, etc. — ~70 tools).

```
   Claude Code ─┐
   Cursor     ──┤
   Windsurf   ──┤      ┌──────────────────────────┐
   OpenCode   ──┼────► │  timps-mcp (MCP server)  │ ──► local memory files
   Antigravity──┤      └──────────────────────────┘     (~/.timps/…, persisted)
   ZCode      ──┤                 ▲
   Kimi/Qwen  ──┘     every agent shares the same store
   (any MCP client)
```

**Persistence mode we use here: LOCAL (recommended).**
- No server, no Docker, no API keys.
- Memory is a `FileBackend` on the local disk, keyed per project under `~/.timps/`.
- It **survives restarts** — that is the whole point. Restart the agent, open a new
  session, and it still remembers what was decided yesterday.
- The exact same store is shared by every agent, so context carries across tools.

> Optional *server mode* (shared Postgres/Qdrant/Redis for a whole team or
> multiple machines) is documented at the end in [Appendix B](#appendix-b-server-mode-optional).

---

## 1. Prerequisites to check first

1. **Node.js 18+** — the MCP server and CLI are npm packages.
2. **npm** — ships with Node.

```bash
node --version   # v18 or newer
npm --version
```

If Node is missing, tell the user to install it (`brew install node` on macOS,
or https://nodejs.org) before continuing. Do NOT silently fail.

---

## 2. The ONE-command path (try this first)

The TIMPS CLI ships a setup command that auto-detects the common agents and
registers the MCP server in each one. Run it:

```bash
# Preview what it will change (safe):
npx -y @timps-ai/timps-code setup --dry-run --list

# Apply — LOCAL mode, no server:
npx -y @timps-ai/timps-code setup
```

That single command handles, automatically:
- **Detecting** every supported agent installed on the machine.
- **Registering** the `timps` MCP server in each agent's config.
- **Installing a memory instruction block** into each agent's global rule file
  (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `timps.mdc`, ...) so every future session
  auto-loads TIMPS context and auto-stores user data.

**Supported by `timps setup` (auto):**
Claude Code, OpenCode, Cursor, Windsurf, Codex CLI, Gemini CLI.

```bash
# Verify what got detected / registered:
npx -y @timps-ai/timps-code setup --list
```

If any of those common agents are present, the automatic path handles them. Then
**continue to Part 3** to cover every agent that auto-detection missed.

> **Why `npx -y @timps-ai/timps-code`?** `timps-code` is the CLI package that
> contains the `timps` command. `timps-mcp` is a *different* package — the MCP
> server binary itself. You need both eventually; the CLI command installs and
> configures everything.

---

## 3. Manual wiring for every OTHER agent

Auto-detection can't know about every MCP client (Antigravity, ZCode, Kimi Code,
Qwen Code, Hermes, OpenClaw, Cline, Aider, Goose, Zed, ... and anything new that
comes out next week). For each agent the user actually uses, you must write its
MCP config by hand. The pattern is identical everywhere — one standard block.

### 3.1 The universal MCP block

```json
{
  "mcpServers": {
    "timps": {
      "command": "npx",
      "args": ["-y", "@timps-ai/timps-mcp"]
    }
  }
}
```

LOCAL mode needs **no env vars at all** — persistence is automatic. Only add env
if you're using server mode (Appendix B).

Some clients want the command split differently. Both of these are equivalent:

```jsonc
// Form A — command + args array (most clients)
{ "mcpServers": { "timps": { "command": "npx", "args": ["-y", "@timps-ai/timps-mcp"] } } }

// Form B — command as single array ("type": "stdio")
{ "mcpServers": { "timps": { "type": "stdio", "command": ["npx", "-y", "@timps-ai/timps-mcp"] } } }
```

> **Windows apps** (Antigravity, ZCode, etc. run under PowerShell / packaged
> runtimes): if bare `npx` can't be spawned, wrap it:
> `{ "command": "cmd", "args": ["/c", "npx", "-y", "@timps-ai/timps-mcp"] }`

### 3.2 Which agents to wire manually

Ask the user (or detect their config files). For the agent **you** are, wire
yourself. For the others, ask "which of these do you use?" then wire those.

| Agent | Config file (macOS/Linux) | Config file (Windows) | Key |
|-------|---------------------------|-----------------------|-----|
| Claude Code | `~/.claude.json` | `%USERPROFILE%\.claude.json` | `mcpServers` |
| OpenCode | `~/.config/opencode/opencode.json` | `%USERPROFILE%\.config\opencode\opencode.json` | `mcp` (see below) |
| Cursor | `~/.cursor/mcp.json` | `%USERPROFILE%\.cursor\mcp.json` | `mcpServers` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `mcpServers` |
| Codex CLI | `~/.codex/config.toml` | `%USERPROFILE%\.codex\config.toml` | `[mcp_servers.timps]` |
| Gemini CLI | `~/.gemini/settings.json` | `%USERPROFILE%\.gemini\settings.json` | `mcpServers` |
| Cline | `~/.cline/` or assistant config | (same) | `mcpServers` |
| Aider | `~/.aider.conf.yml` / `.aider.conf.yml` | (same) | `aider.mcp.servers.*` |
| Zed | `~/.config/zed/settings.json` | (same) | `lsp` / `context_servers` |
| JetBrains AI | IDE "MCP Servers" settings | (same) | via UI |
| Antigravity | `~/.antigravity/` config | (same) | `mcpServers` |
| ZCode | `~/.zcode/` config | (same) | `mcpServers` |
| Kimi Code | `~/.kimi/` config | (same) | `mcpServers` |
| Qwen Code | `~/.qwen/` config | (same) | `mcpServers` |
| Hermes / OpenClaw | user-level MCP config | (same) | `mcpServers` |

**If a config file doesn't exist yet, create it.** Writing the right keys into a
fresh JSON file is safe and idempotent.

### 3.3 Notes for specific formats

**OpenCode** uses `mcp` (not `mcpServers`) with `type: "local"`:

```json
{
  "mcp": {
    "timps": {
      "type": "local",
      "command": ["npx", "-y", "@timps-ai/timps-mcp"],
      "enabled": true
    }
  }
}
```

**Codex CLI** uses TOML:

```toml
[mcp_servers.timps]
command = "npx"
args = ["-y", "@timps-ai/timps-mcp"]
```

**Gemini CLI** uses `type: "stdio"`:

```json
{
  "mcpServers": {
    "timps": { "type": "stdio", "command": ["npx", "-y", "@timps-ai/timps-mcp"] }
  }
}
```

**Antigravity / ZCode / Kimi / Qwen / Hermes / OpenClaw** — these all accept the
universal `mcpServers` block (Form A). If a client exposes an in-app MCP settings
panel, prefer that and paste the same `timps` entry.

### 3.4 Always merge, never clobber

When editing an existing config, **merge** the `timps` entry into the existing
`mcpServers`/`mcp` object. Do NOT overwrite the user's other MCP servers or
settings.

---

## 4. Install the memory-usage instruction block

Wiring the MCP binary alone only lets the agent *call* memory tools on demand.
To make memory actually persist and self-populate, each agent also needs a short
instruction block telling it to **auto-load context at session start** and
**auto-store user data as it happens**.

`timps setup` installs this for the 6 auto-detected agents. For every agent you
wired manually in Part 3, append the block below to that agent's user-level
instruction/memory file. The block is fenced with markers so it's idempotent
(re-running is a no-op) and removable.

**Create-or-append this block** to each agent's global instruction file:

```markdown
<!-- timps:memory:start -->
# TIMPS Memory

TIMPS is your persistent long-term memory layer, shared across every coding agent
on this machine. Use the `timps_*` MCP tools every session:

- **Load context first** — at session start, or before answering a question about
  the user or project, call `timps_get_memories` and ground your answers on it.
- **AUTO-CAPTURE IS MANDATORY (do not ask first).** Persist user content
  automatically: documents, reports, specs, decisions, preferences, project facts,
  and requirements. Call `timps_store_memory` for each distinct item.
- **Never contradict history** — before a strong opinion, call
  `timps_check_contradiction`.
- **Never fabricate or store secrets** — never store passwords, API keys, or
  credentials.
<!-- timps:memory:end -->
```

Where the block goes (per agent):
- **Claude Code** → `~/.claude/CLAUDE.md`
- **OpenCode** (and this read-me file's home) → append to `AGENTS.md`
- **Gemini CLI** → `~/.gemini/GEMINI.md`
- **Cursor** → `~/.cursor/rules/timps.mdc` (YAML frontmatter: `alwaysApply: true`, `globs: ["**/*"]`)
- **Windsurf / Antigravity / ZCode / Kimi / Qwen / Hermes / OpenClaw / others** →
  whichever global rules file that agent loads each session (`AGENTS.md`,
  `RULES.md`, `.cursorrules`, or the client's own "rules/memory" file). Use the
  client's documented convention.

> If you don't know a client's rule-file location, register the MCP server and
> **tell the user** which file to add the block to. Registration alone still gives
> on-demand memory recall.

---

## 5. Verify everything is connected

1. **Tell the user to restart / reload each agent** — MCP servers are loaded at
   startup; edits don't take effect until the next launch.

2. **Confirm the server registers.** In each agent:
   - Claude Code: `/mcp` → `timps` listed with green checks (~70 tools)
   - Cursor/Windsurf/ZCode/etc.: MCP settings panel → `timps` shows **connected**
   - OpenCode: server list shows `timps`

3. **Smoke-test persistence from chat:**

```
> what do you remember about me?
→ (agent calls timps_get_memories)

> remember that my production deploy uses blue-green
→ (agent calls timps_store_memory)

> I'm going to rely on setTimeout for serialization here
→ (may trigger timps_warn_bug_pattern / timps_check_contradiction)
```

4. **Prove persistence survives a restart:** store one fact, have the user fully
   quit and reopen the agent, then ask `what do you remember about me?`. The fact
   should come back. If it does, you're done.

---

## 6. Sanity checklist (before you tell the user it's done)

- [ ] Ran `npx -y @timps-ai/timps-code setup` (auto path) — or confirmed it found nothing to do.
- [ ] Every agent the user uses has a `timps` MCP entry (auto or manual).
- [ ] No existing config was clobbered (only merged).
- [ ] Memory instruction block present in each agent's rule file.
- [ ] Told the user to restart every agent.
- [ ] Storage lives under `~/.timps/` (LOCAL mode) and persists.

---

## Appendix A — Commands you may need

```bash
# Preview / scan (safe, nothing written)
npx -y @timps-ai/timps-code setup --dry-run --list

# Apply LOCAL mode to all detected agents
npx -y @timps-ai/timps-code setup

# Uninstall TIMPS from every agent (reversible)
npx -y @timps-ai/timps-code setup --uninstall

# Register MCP only, skip the rule-file instruction block
npx -y @timps-ai/timps-code setup --no-instructions
```

The raw `timps-mcp` binary (if the user installed it globally):

```bash
npm install -g @timps-ai/timps-mcp
timps-mcp --version
```

Environment variables:

| Var | Default | Meaning |
|-----|---------|---------|
| `TIMPS_PROJECT_PATH` | cwd | Where LOCAL memory is stored (defaults to the agent's working dir). |
| `TIMPS_LOCAL` | — | `true` forces LOCAL mode even if a server URL is set. |
| `TIMPS_URL` / `TIMPS_MEMORY_URL` | — | Set only for server mode (Appendix B). |
| `TIMPS_API_KEY` | — | `timps_…` server key (server mode only). |

---

## Appendix B — Server mode (optional, shared memory)

LOCAL mode is the recommended default and needs nothing. Use server mode only when
the user wants a **single shared memory store across a team or multiple machines**
(Postgres + Qdrant + Redis + MemoryServer via Docker, port 4100).

```bash
cd packages/memory-core
docker compose up -d
curl http://localhost:4100/health     # → {"status":"ok",…}
```

Then every agent registers the MCP with two env vars (this replaces the local
block from Part 3):

```json
{
  "mcpServers": {
    "timps": {
      "command": "npx",
      "args": ["-y", "@timps-ai/timps-mcp"],
      "env": {
        "TIMPS_URL": "http://localhost:4100",
        "TIMPS_MEMORY_URL": "http://localhost:4100"
      }
    }
  }
}
```

Or point all agents at the server in one shot:

```bash
npx -y @timps-ai/timps-code setup --server http://localhost:4100
```

See `DEPLOY.md` and `TIMPS-MCP-CONNECT-GUIDE.md` for the full stack guide
(Postgres replicas, API-key auth, Prometheus/Grafana).
