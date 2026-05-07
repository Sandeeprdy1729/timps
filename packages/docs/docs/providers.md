---
sidebar_position: 3
---

# Providers

TIMPS supports 15+ LLM providers. All use the same interface — just set the env var and pass `--provider`.

## Supported providers

| Name | Env Key | Default Model | Cost |
| --- | --- | --- | --- |
| `ollama` | none | `qwen2.5-coder:7b` | Free (local) |
| `openai` | `OPENAI_API_KEY` | `gpt-4o` | Paid |
| `claude` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` | Paid |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.0-flash` | Free tier |
| `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | Free tier |
| `openrouter` | `OPENROUTER_API_KEY` | `anthropic/claude-sonnet-4-5` | Pay-per-use |
| `mistral` | `MISTRAL_API_KEY` | `mistral-large-latest` | Paid |
| `cohere` | `COHERE_API_KEY` | `command-r-plus` | Free tier |
| `together` | `TOGETHER_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Paid |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` | Low cost |
| `perplexity` | `PERPLEXITY_API_KEY` | `sonar-pro` | Paid |
| `azure` | `AZURE_OPENAI_API_KEY` | from deployment | Paid |
| `xai` | `XAI_API_KEY` | `grok-3-mini` | Paid |
| `fireworks` | `FIREWORKS_API_KEY` | `llama-v3p3-70b-instruct` | Low cost |

## Usage

```bash
# Set provider for one command
timps --provider groq "Explain this code"

# Set as default via env
export TIMPS_PROVIDER=claude
timps "Code review please"

# Model override
timps --provider openai --model gpt-4o-mini "Quick summary"
```

## Configuration file

Create `~/.timps/config.toml`:

```toml
[provider]
default = "ollama"
model = "qwen2.5-coder:7b"
```

## Ollama setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull qwen2.5-coder:7b

# TIMPS uses it automatically
timps "Hello"
```

## See configured providers

```bash
timps providers
```

```text
Available providers:
────────────────────
  ✓ ollama
  ✓ claude
  ○ openai
  ○ gemini
```

✓ = API key set  ○ = not configured
