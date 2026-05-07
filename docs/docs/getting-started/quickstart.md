---
sidebar_position: 2
---

# Quickstart

## 1. Install and launch

```bash
npm install -g timps-code
cd your-project
timps
```

## 2. Configure your model

TIMPS works with any major provider. On first run it prompts for an API key, or set env vars:

```bash
# Anthropic (Claude)
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...

# Google Gemini
export GEMINI_API_KEY=...

# Free — local Ollama (no API key needed)
export TIMPS_MODEL=ollama/mistral
```

## 3. Ask your first question

```
> Explain the architecture of this codebase
```

TIMPS stores what it learns in the **3-layer memory system** — next session it already knows your project.

## 4. Install a skill

```
/skills install nextjs-patterns
```

Skills inject domain knowledge into the agent's system prompt. Install once, always applied.

## 5. Check your memory

```
/memory stats
```

Outputs working memory, episode count, and semantic fact count — all persisted to `~/.timps/memory/`.
