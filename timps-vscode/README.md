# TIMPs VS Code Extension

Memory-backed inline warnings directly in your editor.

## What it does

- **Bug Pattern Warnings** — inline highlights when your code matches your personal bug-writing triggers
- **Tech Debt Alerts** — warns when patterns match past production incidents in your codebase
- **API Quirk Lookup** — instantly see known gotchas for any API you're working with
- **Contradiction Detection** — check if a decision contradicts your past positions
- **Status Bar** — live connection status to your TIMPs server

## Requirements

TIMPs server must be running: `cd sandeep-ai && npm run server`

## Setup

1. Install this extension
2. Open VS Code Settings → search "TIMPs"
3. Set `timps.serverUrl` to your TIMPs server URL (default: `http://localhost:3000`)
4. Set `timps.userId` to your user ID (default: `1`)

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
| `timps.serverUrl` | `http://localhost:3000` | TIMPs server URL |
| `timps.userId` | `1` | Your TIMPs user ID |
| `timps.enableInlineWarnings` | `true` | Show inline code warnings |
| `timps.checkOnSave` | `true` | Analyze file on save |

## License

MIT — github.com/Sandeeprdy1729/timps