---
sidebar_position: 1
---

# CLI Commands

## Starting TIMPS

```bash
# Interactive agent session
timps

# Specify model
TIMPS_MODEL=gpt-4o timps

# Point at a specific project
timps --cwd /path/to/project
```

## Slash Commands

Use slash commands inside the agent session:

| Command | Description |
|---|---|
| `/help` | List all available slash commands |
| `/memory stats` | Show memory layer statistics |
| `/memory search <query>` | Search semantic memory |
| `/memory clear working` | Clear working memory |
| `/skills list` | Browse skills marketplace |
| `/skills install <id>` | Install a skill |
| `/skills search <query>` | Search skills |
| `/skills show <id>` | Show installed skill content |
| `/git status` | Show git status |
| `/git diff` | Show current diff |
| `/git commit` | Stage and commit changes |
| `/git branch <name>` | Create a new branch |
| `/swarm` | Launch multi-agent swarm |
| `/exit` | End the session |

## One-shot mode

Run a single task without starting the interactive session:

```bash
timps "explain the main entry point"
timps "fix the TypeScript errors in src/api/"
timps "write tests for the payment module"
```
