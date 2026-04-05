# TIMPS Code - Open Source Coding Agent

## Vision
An open-source, memory-first CLI coding agent that outperforms all competitors on coding benchmarks. Built with TIMPs hierarchical memory, ProvenForge versioning, and multi-provider support.

## Architecture

### Core Principles
1. **Memory-First**: Every action is stored, versioned, and retrievable
2. **Provider Agnostic**: Works with Claude, GPT-4, Gemini, Ollama, DeepSeek, etc.
3. **Self-Improving**: Learns from errors and improves over time
4. **Benchmark Optimized**: Built for SWE-Bench, HumanEval, MBPP, BigCodeBench

### Directory Structure
```
timps-code/
├── src/
│   ├── agent/          # Agent framework
│   │   ├── base.ts     # Base agent class
│   │   ├── coder.ts    # Coding specialist
│   │   ├── planner.ts  # Planning mode
│   │   └── verifier.ts # Verification agent
│   ├── tools/          # Tool system (expanded)
│   ├── memory/         # TIMPs memory integration
│   ├── providers/      # Multi-provider abstraction
│   ├── skills/         # Skill/plugin system
│   └── commands/       # Slash commands
```

## Features

### 1. Agent Framework
- **Base Agent**: Generic async streaming agent
- **Coder Agent**: Specialized for code tasks
- **Planner Agent**: Creates and refines plans
- **Verifier Agent**: Validates code correctness

### 2. Tool System (25+ tools)
- File operations (read, write, edit, multi-edit, patch)
- Search (grep, glob, search_code)
- Git operations (status, diff, log, commit, stash)
- Shell execution (bash with safety)
- Code execution (notebook, REPL)
- Web access (search, fetch)
- Diagnostics (lint, type check, test)
- Task management (create, list, get)
- Project analysis (structure, dependencies)
- LLM interaction (think, ask)

### 3. Memory System (TIMPs Integration)
- **Layer 1**: Working memory (current goal, active files)
- **Layer 2**: Episodic memory (session summaries)
- **Layer 3**: Semantic memory (facts, patterns, conventions)
- **ProvenForge**: Versioned memory with branches
- **CurateTier**: Hierarchical curation
- **ForgeLink**: Typed relationships between memories

### 4. Planning Mode
- Multi-step task breakdown
- Verification checkpoints
- Token budget management
- Plan persistence and resumption

### 5. Self-Correction
- Error pattern recognition
- Root cause analysis
- Retry with backoff
- Learning from failures

### 6. Slash Commands
- `/plan` - Enter planning mode
- `/exit-plan` - Exit planning mode
- `/task` - Task management
- `/skills` - Skill management
- `/memory` - Memory operations
- `/git` - Git operations
- `/compact` - Context compaction
- `/doctor` - System diagnostics
- `/think` - Reasoning mode
- `/retry` - Retry last failed action
- `/verify` - Run verification
- `/benchmark` - Run coding benchmarks

### 7. Provider Support
- Claude (Anthropic)
- GPT-4/GPT-4o (OpenAI)
- Gemini (Google)
- Ollama (local models)
- DeepSeek (DeepSeek)
- Groq (Groq)
- OpenRouter (multi-model)

### 8. Benchmark Optimizations
- Token budget management
- Context pruning strategies
- Efficient tool use
- Cache-optimized retrieval

## Success Metrics
- SWE-Bench: >50% solve rate
- HumanEval: >90% pass rate
- MBPP: >85% pass rate
- Response time: <2s for tool execution
- Memory retrieval: <100ms

## Differentiation from Claude Code
1. **Open Source**: Full transparency
2. **Multi-Provider**: Not locked to Claude
3. **Memory-First**: Built-in TIMPs memory
4. **Versioned Context**: ProvenForge versioning
5. **Hierarchical Curation**: CurateTier
6. **Benchmark Focused**: Optimized for coding tasks
