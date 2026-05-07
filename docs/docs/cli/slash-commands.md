---
sidebar_position: 2
---

# Slash Commands Reference

Slash commands are typed inside the TIMPS CLI session prompt.

## /memory

```
/memory stats              — Show memory layer counts
/memory search <query>     — Full-text search semantic memory
/memory clear working      — Reset working memory
/memory clear all          — Wipe all memory (⚠️ irreversible)
```

## /skills

```
/skills list               — Browse marketplace grouped by category
/skills search <query>     — Search by name, description, or tag
/skills install <id>       — Install a skill from the registry
/skills show <id>          — Print installed skill content
```

## /git

```
/git status                — Show git status
/git diff                  — Show unstaged diff
/git diff --staged         — Show staged diff
/git commit                — Stage all + commit with AI message
/git branch <name>         — Create and switch to branch
/git log                   — Recent commits
```

## /swarm

```
/swarm <task>              — Launch multi-agent swarm for large tasks
```

Swarm mode spawns parallel Coder + Verifier agents and merges their results.

## /exit

Ends the session, saves working memory snapshot, and writes an episode summary.
