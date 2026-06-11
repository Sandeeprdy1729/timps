# TIMPS — The AI Coding Agent That Remembers Everything

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — AI Coding Agent" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm timps-code"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm timps-mcp"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=TIMPs.timps-ai-coding-agent"><img src="https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode" alt="VS Code Extension"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="https://discord.gg/MmsTNm8WF6"><img src="https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <b>Claude Code forgets everything when you close it. TIMPS remembers — forever.</b><br>
  <i>Free (Ollama), open source, 100% local, works in Claude/Cursor/Windsurf via MCP.</i>
</p>

> TIMPS remembers your code, your decisions, and your mistakes — so your AI agent doesn't make you re-explain anything. Free, local, 30-second install.

---

## Quick Start

### CLI Only (30 seconds)

```bash
npm install -g timps-code
cd your-project
timps "what does this codebase do?"
```

Auto-detects Ollama if running, or walks you through picking a provider.

```bash
timps --provider claude "refactor the auth module"    # Claude
timps --provider gemini "explain the architecture"    # Gemini
timps --provider ollama "quick fix"                   # Free local
timps --provider auto "analyze this codebase"        # Intelligent routing
```

### Full Server + Docker

```bash
git clone https://github.com/Sandeeprdy1729/timps
cd timps && docker compose up -d
npm install -g timps-mcp
```

Then add to Claude Code (`~/.claude.json`):

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": { "TIMPS_URL": "http://localhost:3000" }
    }
  }
}
```

---

## Documentation

**Start here:** [`DOCS.md`](DOCS.md) — installation, configuration, CLI commands, memory API,
MCP tools, VS Code extension, skills, and contributing guide.

### For developers

| File | What it covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Memory layers, 17 intelligence tools, benchmark, CI, MCP internals |
| [`AGENTS.md`](AGENTS.md) | AI agent instructions: repo layout, entrypoints, conventions, gotchas |
| [`CONTRIBUTING.md`](contributing.md) | PR checklist, how to add a skill, changeset workflow |
| [`TEST_GUIDE.md`](TEST_GUIDE.md) | Testing patterns and guidelines |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history and release notes |

### For ops

| File | What it covers |
|---|---|
| [`DEPLOY.md`](DEPLOY.md) | Deployment instructions |
| [`DEPLOY_CLOUD.md`](DEPLOY_CLOUD.md) | Cloud-specific deployment |

### Project context

| File | What it covers |
|---|---|
| [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) | Full project overview and vision |
| [`ROADMAP.md`](ROADMAP.md) | Planned features and milestones |
| [`PHASE_GATEWAY.md`](PHASE_GATEWAY.md) | Phase planning and gate criteria |
| [`GOVERNANCE.md`](GOVERNANCE.md) | Project governance model |
| [`MAINTAINERS.md`](MAINTAINERS.md) | Maintainers and contact info |
| [`SECURITY.md`](SECURITY.md) | Security policy and reporting |

### Package-specific READMEs

| File | Package |
|---|---|
| [`sandeep-ai/README.md`](sandeep-ai/README.md) | `@timps/server` — full server + REST API |
| [`sandeep-ai/QUICKSTART.md`](sandeep-ai/QUICKSTART.md) | Server quick start |
| [`sandeep-ai/DEPLOY.md`](sandeep-ai/DEPLOY.md) | Server deployment |
| [`sandeep-ai/TUI_README.md`](sandeep-ai/TUI_README.md) | Terminal UI reference |
| [`timps-code/README.md`](timps-code/README.md) | `timps-code` — CLI agent |
| [`timps-code/SPEC.md`](timps-code/SPEC.md) | CLI spec |
| [`timps-mcp/README.md`](timps-mcp/README.md) | `timps-mcp` — MCP server |
| [`timps-vscode/README.md`](timps-vscode/README.md) | VS Code extension |
| [`timps-vscode/PUBLISH.md`](timps-vscode/PUBLISH.md) | VS Code publishing guide |
| [`timps-vscode/TIMPS_SKILLS.md`](timps-vscode/TIMPS_SKILLS.md) | VS Code skills integration |
| [`apps/marketplace/README.md`](apps/marketplace/) | `@timps/marketplace` — plugin/extension marketplace |
| [`apps/mobile/README.md`](apps/mobile/) | `@timps/mobile` — mobile app |

---

## Workflow Recipes

Four ready-to-use YAML workflows for Claude Code and other AI coding agents:

| Workflow | What it does |
|---|---|
| [`code-review.yaml`](workflow_recipes/code-review.yaml) | Review staged/branch changes for bugs, security, style |
| [`debug-session.yaml`](workflow_recipes/debug-session.yaml) | Systematic debug: reproduce, isolate, fix, verify |
| [`deploy-check.yaml`](workflow_recipes/deploy-check.yaml) | Pre-deploy safety checklist (tests, build, env, migrations) |
| [`feature-plan.yaml`](workflow_recipes/feature-plan.yaml) | Plan and scaffold a new feature with tests |

Load these in Claude Code via `/.claude/instructions/` or paste directly into a session.

---

## Contributing

See the [Documentation](#documentation) section above for contributing guides and build instructions. All contributions welcome — MIT licensed.

### Bounty Program

We run periodic bounty contests for major features. Check Discord for active bounties!

---

## Star History

<a href="https://www.star-history.com/?repos=Sandeeprdy1729%2Ftimps&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Sandeeprdy1729%2Ftimps&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Sandeeprdy1729%2Ftimps&type=date&theme=dark&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Sandeeprdy1729%2Ftimps&type=date&legend=top-left" />
  </picture>
</a>

---

## Community

- **[Discord](https://discord.gg/MmsTNm8WF6)** — real-time chat, help, announcements
- **[GitHub Discussions](https://github.com/Sandeeprdy1729/timps/discussions)** — Q&A, ideas
- **[X/Twitter](https://x.com/timpsai)** — announcements

---

## License

MIT
