# TIMPS — Persistent Memory for AI Coding Agents

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — AI Coding Agent" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT"></a>
</p>

<p align="center">
  <b>Claude Code, Cursor, and Windsurf forget everything the moment you close the session.</b><br>
  TIMPS is an MCP server that gives them memory that survives restarts — architecture decisions, past bugs, your conventions.<br>
  <i>Free and fully local with Ollama. No API key required to try it.</i>
</p>

<p align="center">
  <b>Read in:</b>
  <a href="README.md">English</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.hi.md">हिन्दी</a> •
  <a href="README.pt.md">Português</a>
</p>

> **Status:** solo project, early. The MCP server and CLI are the parts I actually use daily and trust. Everything else in this repo (desktop app, mobile, JetBrains, plugin marketplace) is younger and less tested — flagged below. I'd genuinely rather you try the core and tell me it's broken than read marketing copy.

<p align="center">
  <video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%" alt="TIMPS real demo — cross-session memory recall across opencode sessions"></video>
</p>

---

## Try it in 30 seconds

```bash
npx timps-code "what does this codebase do?"
```

No install, no config, no API key. Point it at any repo. If you have Ollama running locally, this is 100% free and nothing leaves your machine. If not, it'll walk you through picking a provider.

To actually get persistent memory in Claude Code, Cursor, or any MCP client, add the MCP server:

```bash
npm install -g timps-mcp
```

then point your MCP client at it (config instructions in [MCP Setup](#mcp-setup)).

---

## What it actually does

Ask Claude Code to fix a bug today. Close the session. Ask it something related tomorrow — it has no idea what you decided yesterday, what you already tried, or why you structured something the way you did. You end up re-explaining the same context every single session.

TIMPS sits between you and your agent as an MCP server and keeps a memory store per project:

- **What it remembers** — architectural decisions you've made, patterns and conventions specific to your codebase, bugs you've already hit and how they were fixed, and a plain audit log of what it wrote and why.
- **Where it lives** — local JSON/SQLite files by default, keyed per-project so different repos don't bleed into each other. Optional Postgres/Qdrant if you want it shared across a team.
- **What it costs** — free if you run Ollama locally. Optional paid providers (Claude, GPT, Gemini) if you want their reasoning quality instead.

That's the whole pitch. It's a memory layer, not a new agent — it works alongside whatever coding agent you already use.

---

## How it works (short version)

Under the hood, memory is organized in a few real tiers:

1. **Working memory** — current session: active files, recent errors, live goals. Cleared on exit.
2. **Episodic memory** — a log of past sessions and their outcomes.
3. **Semantic memory** — the durable stuff: patterns, conventions, decisions that got promoted from episodic because they kept mattering.
4. **Audit trail** — an append-only, hash-chained log of every memory write, so you can see exactly what the system learned and when.

There's a deeper set of subsystems on top of this (temporal pattern detection, contradiction detection, confidence scoring, importance-based pruning) for people who want to go further — full breakdown in [`ARCHITECTURE.md`](ARCHITECTURE.md) rather than here, since most people don't need to know the internals to use it.

---

## MCP Setup

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Windsurf

Add to `~/.config/windsurf/config.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Any other MCP client

Run `timps-mcp` over stdio. That's all the protocol requires.

---

## What's measured, honestly

Run yourself: `npx tsx benchmark/index.ts --quick`

| Metric | Result |
|---|---|
| Recall@5 (20 test queries against a 50-fact synthetic corpus) | 19/20 |
| Contradiction detection (10 known contradictory pairs) | 10/10 |
| Query latency, in-process, 500 facts | ~1ms p95 |

These are self-run benchmarks on a synthetic dataset I built — not independently verified, and not a claim about how it performs on your actual codebase. Take them as "the core logic works as designed," not as a competitive claim.

---

## Also in this repo (early / experimental)

The monorepo includes a VS Code extension, a desktop app (Tauri), a mobile app, a JetBrains plugin, and a multi-agent "swarm" mode for task decomposition. These exist and mostly work, but they've had far less real-world use than the CLI/MCP core — treat them as "try if you're curious," not "this is production-ready." I'd rather be upfront about that than have you find out the hard way.

---

## Try it, then tell me what's wrong

This is genuinely useful to me right now: run the 30-second command above on one of your real repos, and tell me what broke, what was confusing, or what it got wrong. That feedback is worth more to this project than a star.

- Issues: [github.com/Sandeeprdy1729/timps/issues](https://github.com/Sandeeprdy1729/timps/issues)
- Discord: [discord.gg/MmsTNm8WF6](https://discord.gg/MmsTNm8WF6)

## License

MIT
