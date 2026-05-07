---
sidebar_position: 1
---

# Skills Overview

Skills are Markdown documents that inject domain knowledge into the TIMPS agent's system prompt. Install a skill once and it's automatically included every time TIMPS starts in that project.

## Why skills?

The agent's base training knows general programming — but it doesn't know your team's React patterns, your preferred TypeScript strictness level, or your API security checklist. Skills fill that gap.

## Browsing available skills

```
/skills list
```

Output:

```
📦 Skills Marketplace (12 available, 0 installed)

⚛️  Frontend
  nextjs-patterns      Next.js App Router patterns (v1.0.0)
  react-patterns       React component patterns (v1.0.0)
  react-query-patterns TanStack Query v5 patterns (v1.0.0)

📐 TypeScript
  typescript-strict    TypeScript strict mode patterns (v1.0.0)
  zod-validation       Zod schema validation patterns (v1.0.0)

🧪 Testing
  testing-patterns     Testing best practices (v1.0.0)

🔒 Security
  api-security         API security patterns (v1.0.0)

🗄️  Database
  prisma-patterns      Prisma ORM patterns (v1.0.0)

🐳 DevOps
  docker-patterns      Docker and container patterns (v1.0.0)

🔧 Workflow
  git-workflow         Git workflow and branching (v1.0.0)
  error-handling       Error handling patterns (v1.0.0)
  monorepo-patterns    Monorepo management patterns (v1.0.0)
```

## Searching skills

```
/skills search security
```

## Installing a skill

```
/skills install nextjs-patterns
```

Skills are written to `~/.timps/skills/<id>.md` and loaded at agent startup.

## Viewing an installed skill

```
/skills show nextjs-patterns
```

## Community skills

All skills live in [`timps-code/src/skills/registry.json`](https://github.com/Sandeeprdy1729/timps/blob/main/timps-code/src/skills/registry.json). Submit a PR to add a new skill!

See [Creating Skills](./creating) for the format.
