# TIMPS Under the Hood: Provider Models

TIMPS supports multiple LLM providers - Ollama, Claude, OpenAI, Gemini, and more.

## Architecture

```
Provider Interface
├── chat (messages) → text
├── generate (prompt) → text
├── embed (text) → vector
└── tokenize (text) → count
```

## Supported Providers

### Ollama (Free, Local)

```bash
# Install
ollama serve
ollama pull codellama

# Use
timps --provider ollama "fix this bug"
```

### Claude (Anthropic)

```bash
# Set key
export ANTHROPIC_API_KEY=sk-...

# Use
timps --provider claude "explain this code"
```

### OpenAI

```bash
# Set key
export OPENAI_API_KEY=sk-...

# Use
timps --provider openai "summarize this"
```

### Gemini (Google)

```bash
export GEMINI_API_KEY=AI...

timps --provider gemini "analyze this"
```

### OpenRouter (Unified)

```bash
export OPENROUTER_API_KEY=...

timps --provider openrouter --model anthropic/claude-3-opus "task"
```

## Adding New Providers

```typescript
import { BaseModel } from 'timps-code/models/baseModel.ts';

export class MyProvider extends BaseModel {
  async chat(messages: Message[]): Promise<string> {
    // Implement
  }
}
```

## Configuration

```typescript
const agent = createAgent({
  provider: 'ollama',
  model: 'codellama',
  temperature: 0.7,
  maxTokens: 4096,
});
```

## Provider Comparison

| Provider | Cost | Speed | Quality |
|----------|------|-------|---------|
| Ollama | Free | Fast | Good |
| Claude | Paid | Fast | Best |
| OpenAI | Paid | Fast | Great |
| Gemini | Paid | Fast | Great |