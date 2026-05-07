---
sidebar_position: 3
---

# Creating Skills

Skills are Markdown files with a metadata header. Adding one to the registry makes it available to all TIMPS users via `/skills install`.

## Skill format

Each skill entry in `registry.json` has this shape:

```typescript
interface RegistrySkill {
  id: string;           // kebab-case, unique
  name: string;         // Human-readable name
  description: string;  // One-line description
  category: string;     // e.g. "Frontend", "Testing", "Security"
  tags: string[];       // Searchable tags
  author: string;       // GitHub username
  version: string;      // semver
  content: string;      // Full Markdown content
}
```

## Example skill

```json
{
  "id": "svelte-patterns",
  "name": "Svelte Patterns",
  "description": "Svelte 5 runes and component patterns",
  "category": "Frontend",
  "tags": ["svelte", "runes", "frontend"],
  "author": "yourname",
  "version": "1.0.0",
  "content": "# Svelte Patterns\n\nWhen writing Svelte 5 components:\n\n- Use `$state()` rune for reactive state\n- Use `$derived()` for computed values\n- Use `$effect()` for side effects\n..."
}
```

## Submitting a skill

1. Fork [Sandeeprdy1729/timps](https://github.com/Sandeeprdy1729/timps)
2. Edit `timps-code/src/skills/registry.json` — add your entry to the `skills` array
3. Bump `registry.json` version if making breaking changes
4. Open a PR with the title `feat(skills): add <id>`

The TIMPS team reviews and merges skills PRs weekly. Once merged, your skill is available to all users on the next `timps-code` release.
