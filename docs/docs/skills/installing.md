---
sidebar_position: 2
---

# Installing Skills

```bash
# In the TIMPS CLI
/skills install nextjs-patterns
```

Skills are saved to `~/.timps/skills/<id>.md` and automatically loaded every time TIMPS starts.

## Managing installed skills

```bash
# List all skills with [installed] tags
/skills list

# Search for specific skills
/skills search react

# View content of an installed skill
/skills show typescript-strict
```

## What happens at install

1. TIMPS reads `registry.json` (bundled with `timps-code`)
2. The skill's `content` field is written to `~/.timps/skills/<id>.md`
3. On next agent start, all `~/.timps/skills/*.md` files are concatenated and prepended to the system prompt

No network request. Install is sub-second.
