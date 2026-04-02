# TIMPs — AI Memory Intelligence

Memory-backed inline warnings directly in your editor, powered by a free cloud backend.

## What it does

- **Bug Pattern Warnings** — inline highlights when your code matches personal bug-writing triggers
- **Tech Debt Alerts** — warns when patterns match past production incidents in your codebase
- **API Quirk Lookup** — instantly see known gotchas for any API you're working with
- **Contradiction Detection** — check if a decision contradicts your past positions
- **Status Bar** — live connection status to TIMPs cloud

## Quick Start

1. Install this extension from the VS Code Marketplace
2. Done! It connects to the **free TIMPs cloud** automatically
3. Start coding — inline warnings appear on save

> No server setup required. The extension connects to the free hosted backend at `https://timps-api.onrender.com`.

### (Optional) Self-hosted mode

If you prefer to run your own server:

1. Clone the repo: `git clone https://github.com/Sandeeprdy1729/timps.git`
2. Run: `docker compose up -d`
3. Set `timps.serverUrl` to `http://localhost:3000` in VS Code settings

## Commands

| Command | What it does |
|---------|-------------|
| `TIMPs: Check for Contradictions` | Check selected text against your stored positions |
| `TIMPs: Look Up API Quirks` | Look up known undocumented behavior for any API |
| `TIMPs: Check Bug Pattern Risk` | Check current coding context against your bug triggers |
| `TIMPs: Open Intelligence Dashboard` | Open TIMPs dashboard in browser |
| `TIMPs: Show My Memories` | View all stored memories in a panel |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `timps.serverUrl` | `https://timps-api.onrender.com` | TIMPs server URL (cloud by default) |
| `timps.userId` | `1` | Your TIMPs user ID |
| `timps.enableInlineWarnings` | `true` | Show inline code warnings |
| `timps.checkOnSave` | `true` | Analyze file on save |

## License

MIT — github.com/Sandeeprdy1729/timps