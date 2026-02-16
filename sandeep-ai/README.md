# Sandeep AI

A persistent cognitive partner that remembers, evolves, and builds with its user.

## System Overview

Sandeep AI is a production-ready AI agent system featuring:

- **Memory-First Architecture**: Three-layer memory system (short-term, long-term, structured knowledge)
- **Model-Agnostic Design**: Pluggable interface for OpenAI, Gemini, and Ollama
- **Tool Execution**: Dynamic tool calling with file operations and web search
- **Vector Search**: Qdrant-powered semantic memory retrieval
- **REST API**: Full-featured API for integration
- **CLI Interface**: Interactive chat mode

## Architecture

```
sandeep-ai/
├── core/           # Agent, planner, executor, reflection
├── memory/         # Short-term, long-term, embeddings
├── models/         # OpenAI, Gemini, Ollama adapters
├── tools/          # File, web search tools
├── db/             # PostgreSQL & Qdrant clients
├── api/            # Express routes & server
├── config/         # Environment configuration
└── interfaces/     # CLI interface
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Qdrant (optional, for vector search)

## Quick Start

### 1. Clone and Install

```bash
cd sandeep-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `OPENAI_API_KEY` (or `GEMINI_API_KEY`, or use Ollama)

### 3. Start PostgreSQL

```bash
# Using Docker
docker run -d \
  --name sandeep-postgres \
  -e POSTGRES_DB=sandeep_ai \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:14
```

### 4. Start Qdrant (Optional)

```bash
docker run -d \
  --name sandeep-qdrant \
  -p 6333:6333 \
  qdrant/qdrant
```

### 5. Run the Server

```bash
npm run build
npm start
```

Server runs at `http://localhost:3000`

## Usage

### API Endpoints

#### Chat

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "username": "Sandeep",
    "message": "Hello, remember that I prefer TypeScript over JavaScript"
  }'
```

#### Get User Memory

```bash
curl http://localhost:3000/api/memory/1
```

#### Get Goals

```bash
curl http://localhost:3000/api/goals/1
```

### CLI Mode

```bash
npm run cli -- --user-id 1 --interactive
```

Commands:
- Type your message and press Enter
- `clear` - Clear conversation history
- `exit` or `quit` - Exit the chat

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `DEFAULT_MODEL_PROVIDER` | LLM provider (openai/gemini/ollama) | openai |
| `SHORT_TERM_TOKEN_LIMIT` | Max tokens in short-term memory | 4000 |
| `LONG_TERM_TOP_RESULTS` | Memories to retrieve | 5 |

## Database Schema

The system automatically creates these tables:

- `users` - User accounts
- `conversations` - Chat sessions
- `messages` - Individual messages
- `memories` - Long-term memories with vector embeddings
- `goals` - User goals
- `preferences` - User preferences
- `projects` - User projects

## Tool System

Sandeep AI includes built-in tools:

1. **file_operations** - Read, write, list, delete files
2. **web_search** - Search the web
3. **web_fetch** - Fetch URL content

### Tool Definitions

Tools are automatically passed to the LLM, which decides when to use them based on the conversation context.

## Extending the System

### Adding a New Model

1. Create a new file in `models/` (e.g., `anthropicModel.ts`)
2. Extend `BaseModel` class
3. Implement `generate()` and `getEmbedding()` methods
4. Add to `models/index.ts`

### Adding a New Tool

1. Create a new file in `tools/` (e.g., `calculatorTool.ts`)
2. Extend `BaseTool` class
3. Implement `execute()` method
4. Add to `tools/index.ts`

### Multi-Agent Extension

The current architecture supports multi-agent deployment:
- Each agent maintains independent memory
- Shared long-term store enables knowledge sharing
- Add agent coordination in `core/`

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure PostgreSQL with connection pooling
3. Set up Redis for caching
4. Use environment variables for secrets
5. Consider PM2 or similar for process management

## License

MIT
