# @timps/server — Persistent AI Memory Server

[![npm](https://img.shields.io/npm/v/@timps/server?color=brightgreen)](https://www.npmjs.com/package/@timps/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Sandeeprdy1729/timps/blob/main/LICENSE)

Express HTTP server that backs the CLI agent, MCP tools, and VS Code extension. Provides REST API for 28 forge layers, 25 intelligence tools, PostgreSQL persistence, and Qdrant vector search.

## Quick Start

```bash
cd packages/server
cp .env.example .env   # add your API keys
npm install
npm run server
```

Server starts at `http://localhost:3000`.

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/chat` | Chat with AI (streaming) |
| `GET /api/memory/:userId` | Get user memories |
| `POST /api/contradiction/check` | Contradiction detection |
| `GET /api/positions/:userId` | List tracked positions |
| `GET /api/health` | Health check |
| `POST /api/chronos/ingest` | ChronosForge causal graph ingest |
| `GET /api/chronos/query` | ChronosForge query |
| `GET /api/nexus/graph/:userId` | NexusForge knowledge graph |

### Intelligence Tools (18+)

TemporalMirror, RegretOracle, LivingManifesto, BurnoutSeismograph, ContradictionTool, DeadReckoning, SkillShadow, CurriculumArchitect, TechDebtSeismograph, BugPatternProphet, APIArchaeologist, CodebaseAnthropologist, InstitutionalMemory, ChemistryEngine, MeetingGhost, CollectiveWisdom, RelationshipIntelligence, CurateTierTool

### Memory Layers

ShortTermMemory, LongTermMemory with 28 forge/subsystem layers: ChronosForge, EchoForge, ResonanceForge, AetherForgeERL, HarmonicSheafWeaver, EclipseForge, SupraSheaf, QPTW, TitanicForge, QERW, QISRD, QITRL — plus L10-L22 (EngramLog through ConfidenceCalibrator).

### Providers

Ollama, OpenAI, Gemini, OpenRouter, Claude — configurable via environment variables.

## Database

PostgreSQL (required for persistence) + Qdrant vector store (optional, for hybrid search).
