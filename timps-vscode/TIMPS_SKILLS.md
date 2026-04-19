# TIMPS Skills Documentation

These skills are automatically installed to `~/.timps/skills/` when you first launch the extension.
They are injected into the TIMPS-Coder system prompt to enhance its behavior.

## Installed Skills

| Skill ID | Name | Category | Description |
|---|---|---|---|
| `bug-fixer` | Bug Fixer | coding | TIMPS-Coder specialty: root cause + complete fix |
| `code-reviewer` | Code Reviewer | coding | 🔴/🟡/🟢 severity review |
| `full-stack-dev` | Full-Stack Dev | coding | Next.js, TypeScript, Tailwind, Prisma |
| `test-writer` | Test Writer | coding | Jest/pytest/JUnit comprehensive tests |
| `doc-writer` | Doc Writer | coding | JSDoc, docstrings, inline comments |
| `security-auditor` | Security Auditor | security | Injection, XSS, auth flaw detection |
| `perf-optimizer` | Performance Optimizer | coding | Complexity analysis + optimization |
| `api-designer` | API Designer | coding | REST API design + OpenAPI |
| `refactor-master` | Refactor Master | coding | Clean code, SOLID, DRY |

## Using Skills in CLI (timps-code)

Skills from `~/.timps/skills/` are auto-loaded by the TIMPS CLI agent:

```bash
# List installed skills
timps /skills

# The agent uses all installed skills automatically in system prompt
timps "Fix the bug in auth.ts"
```

## Adding Custom Skills

Create a `.md` file in `~/.timps/skills/`:

```markdown
---
name: my-skill
category: coding
description: What this skill does
---

# My Custom Skill

Your instructions here...
```

## Skill Format (from GLM)

All skills follow the frontmatter + markdown body format:
- `name:` Display name
- `category:` Grouping (coding, security, writing, etc.)
- `description:` Used for search/discovery
- Body: Instructions injected into agent system prompt

## Integration with TIMPS-Coder

When TIMPS-Coder runs, the active skills' instruction bodies are appended to the system prompt under `## Active TIMPS Skills`. This teaches the model your preferred output formats and behavioral rules.
