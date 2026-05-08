# TIMPS Provider Configuration

## Overview

TIMPS supports multiple AI providers including Claude, GPT, Gemini, and Ollama.

## Supported Providers

### Anthropic Claude

```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "apiKey": "${ANTHROPIC_API_KEY}",
  "maxTokens": 4096,
  "temperature": 0.7
}
```

### OpenAI GPT

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo-preview",
  "apiKey": "${OPENAI_API_KEY}",
  "maxTokens": 4096,
  "temperature": 0.7,
  "topP": 1
}
```

### Google Gemini

```json
{
  "provider": "google",
  "model": "gemini-pro",
  "apiKey": "${GOOGLE_API_KEY}",
  "maxTokens": 8192,
  "temperature": 0.7
}
```

### Ollama (Local)

```json
{
  "provider": "ollama",
  "model": "llama2",
  "baseUrl": "http://localhost:11434",
  "temperature": 0.7
}
```

## Configuration Examples

### Development

```json
{
  "provider": "openai",
  "model": "gpt-3.5-turbo",
  "maxTokens": 2048,
  "temperature": 0.5
}
```

### Production

```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "maxTokens": 8192,
  "temperature": 0.7,
  "topP": 0.9
}
```

## Environment Variables

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# Google
GOOGLE_API_KEY=xxx

# Azure OpenAI
AZURE_OPENAI_API_KEY=xxx
AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
```

## Model Comparison

| Provider | Model | Context | Best For |
|----------|-------|---------|-----------|
| Anthropic | Claude 3 Opus | 200K | Complex reasoning |
| Anthropic | Claude 3 Sonnet | 200K | Balanced |
| OpenAI | GPT-4 Turbo | 128K | General purpose |
| OpenAI | GPT-3.5 Turbo | 16K | Fast, cheap |
| Google | Gemini Pro | 32K | Multimodal |
| Ollama | Llama 2 | 4K | Local, private |

## Advanced Configuration

### Rate Limiting

```json
{
  "provider": "openai",
  "rateLimit": {
    "requestsPerMinute": 60,
    "requestsPerHour": 5000
  }
}
```

### Retry Configuration

```json
{
  "provider": "openai",
  "retry": {
    "maxAttempts": 3,
    "initialDelay": 1000,
    "backoffMultiplier": 2
  }
}
```

### Custom Endpoints

```json
{
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "organization": "org-xxx"
}
```

## Provider-Specific Features

### Anthropic

- Stream responses
- System prompts
- Tool use

### OpenAI

- Function calling
- JSON mode
- Seed parameter

### Google

- Multimodal input
- Safety settings
- Generation config

### Ollama

- Local models
- Custom models
- GPU support

## Troubleshooting

### Rate Limit Errors

Reduce requests or upgrade tier.

### Token Limit Errors

Reduce maxTokens or simplify prompts.

### Timeout Errors

Increase timeout or reduce model complexity.

### Authentication Errors

Verify API key is correct and has proper permissions.