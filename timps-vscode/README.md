# TIMPS — AI Coding Agent with Persistent Memory

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Install-blue)](https://marketplace.visualstudio.com/items?itemName=TIMPs.timps-ai-coding-agent)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Install-purple)](https://open-vsx.org/extension/TIMPs/timps-ai-coding-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-timps-181717?logo=github)](https://github.com/Sandeeprdy1729/timps)

**22-layer persistent memory for your AI coding agent.** TIMPS remembers what you worked on, the bugs you fixed, the patterns you established, and the decisions you made — across sessions, branches, and projects.

---

## ✨ Features

### 🧠 Persistent Memory That Spans Sessions
Your AI coding agent remembers everything — past bugs, architecture decisions, API quirks, and coding patterns — across VS Code sessions. Close the editor, come back tomorrow, and your agent picks up where it left off.

### 🪟 Inline Memory Panel
See relevant memories for the file you're editing — function signatures, bug patterns, and related code — updated in real-time as you navigate your project.

### 🔍 Memory-Aware Autocomplete
Suggestions informed by your project's history. Type a function name and TIMPS surfaces similar patterns from the codebase — not generic LLM output, but actual existing code you or your team wrote.

### ⚠️ Contradiction Detection
TIMPS warns you when your current edit contradicts stored memories — preventing regression of previously fixed bugs, catching inconsistent patterns, and flagging architecture drift as it happens.

### 💬 AI Chat with Full Context
Chat with your AI coding agent using local models (Ollama) or cloud models (OpenAI, Gemini). Every message is enriched with project context — file tree, active document, and relevant memories.

### 📊 Project Intelligence
Track velocity trends, detect architecture drift, predict bug risk, and surface tech debt — all powered by TIMPS's 22 forge layers.

---

## 🖼️ Features in Detail

### Inline Memory Panel
The Memory Panel (accessible from the sidebar or `Cmd+Shift+M`) shows memory context for your current file:

- **File-specific memories** — relevant entries from Echo Forge (frequency), Chronos Forge (episodic), and Codebase Anthropologist
- **Contradiction warnings** — highlighted when current code conflicts with stored memories
- **Live updates** — panel refreshes when you switch files or cursor position changes

### Memory-Aware Autocomplete
The completion provider (enabled by default for TypeScript, JavaScript, Python, Rust, Go, Java, C#, C++, and Ruby) surfaces project-specific completions:

- Function names and patterns from your codebase
- Recently edited or frequently used symbols
- Bug-fix patterns and API quirks

### Edit Watcher
File saves and significant edits are automatically recorded as episodic memories. This builds a timeline of your work that the agent can reference in future sessions.

---

## 🚀 Getting Started

### Installation
1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=TIMPs.timps-ai-coding-agent)
2. Press `Cmd+Shift+T` to open the TIMPS Chat
3. Choose your provider (Ollama local, OpenAI, or Gemini) in settings

### Connecting to TIMPS MemoryServer (Recommended)
For full memory features, run the TIMPS MemoryServer:

```bash
# Install and start the MemoryServer
npx @timps/memory-core start
```

Then set `timps.serverUrl` in VS Code settings to `http://localhost:4100`.

### Using Local Memory (Standalone)
TIMPS works with a built-in local memory store — no server required for basic chat features. Memory panel, autocomplete, and contradiction detection work best with the MemoryServer running.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+Shift+T` | Open TIMPS Chat |
| `Cmd+Shift+M` | Show Memory Panel |
| `Cmd+Shift+R` | Search Memories |
| `Cmd+Shift+A` | Ask about selection |
| `Cmd+Shift+E` | Explain code |
| `Cmd+Shift+F` | Fix code |
| `Cmd+Shift+G` | Generate tests |

---

## ⚙️ Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `timps.provider` | `ollama` | AI provider (ollama, openai, gemini) |
| `timps.model` | `sandeeprdy1729/timps-coder` | Model name/ID |
| `timps.serverUrl` | `http://localhost:4100` | TIMPS MemoryServer URL |
| `timps.token` | `""` | API token for MemoryServer |
| `timps.enableAutocomplete` | `true` | Memory-aware autocomplete |
| `timps.enableWatcher` | `true` | Auto-record edits as memories |
| `timps.enableContradictionCheck` | `true` | Inline contradiction warnings |
| `timps.ollamaUrl` | `http://localhost:11434` | Ollama server URL |

---

## 📋 Requirements

- **VS Code** 1.85.0 or higher
- **Optional**: [Ollama](https://ollama.ai) for local AI models
- **Optional**: TIMPS MemoryServer for persistent memory across sessions

---

## 🤝 Contributing

TIMPS is open source. [GitHub repository](https://github.com/Sandeeprdy1729/timps)

---

## 📄 License

MIT
