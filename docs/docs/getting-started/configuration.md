---
sidebar_position: 3
---

# Configuration

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Anthropic (Claude) API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `TIMPS_MODEL` | `claude-3-5-sonnet-20241022` | Model string (e.g. `ollama/mistral`) |
| `TIMPS_URL` | — | Remote timps server URL (MCP server-mode) |
| `TIMPS_TOKEN` | — | Auth token for remote server |
| `PROJECT_PATH` | `process.cwd()` | Project root for memory scoping |

## Model selection

```bash
# Use Claude Sonnet (default)
timps

# Use GPT-4o
TIMPS_MODEL=gpt-4o timps

# Use local Ollama (free, no API key)
TIMPS_MODEL=ollama/mistral timps

# Use Gemini 2.0 Flash
TIMPS_MODEL=gemini-2.0-flash-exp timps
```

## Memory location

All memory is stored at `~/.timps/memory/<project-hash>/`:

```
~/.timps/memory/<hash>/
├── episodes.jsonl    # Episodic memory (session history)
├── semantic.json     # Semantic memory (facts + patterns)
└── working.json      # Working memory (current session)
```

The hash is derived from the absolute path of `PROJECT_PATH`.

## Skills location

Installed skills are stored at `~/.timps/skills/<id>.md`.
