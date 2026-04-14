# TIMPs — AI Coding Agent

A powerful AI coding agent for VS Code, like Claude Code and OpenCode.

[![Install](https://img.shields.io/badge/VS%20Code-Install-blue)](https://marketplace.visualstudio.com/items?itemName=sandeeprdy1729.timps-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Esc` | Open TIMPs terminal |
| `Cmd+Shift+Esc` | New TIMPs session |
| `Cmd+Shift+C` | Open TIMPs chat |
| `Cmd+Option+K` | Insert file reference |
| `Cmd+Option+E` | Explain selected code |
| `Cmd+Option+R` | Refactor selected code |
| `Cmd+Option+T` | Write tests |
| `Cmd+Option+F` | Fix bugs |

---

## 🚀 Features

### Terminal Agent (like OpenCode)
- Press **Cmd+Esc** to open TIMPs in a terminal
- Natural language commands: `/explain`, `/refactor`, `/test`, `/fix`
- Full project context awareness
- Terminal integration - works like you're using CLI

### Chat Interface (like Claude Code)
- Press **Cmd+Shift+C** to open chat panel
- Conversation-style AI assistance
- Side-by-side view while coding
- Code snippets and explanations

### Context Awareness
- Automatically shares current file/selection with TIMPs
- Right-click context menu for selected code
- File reference shortcuts: `@file.ts#L42`

### AI-Powered Actions
- **Explain**: Understand any code selection
- **Refactor**: Improve code structure
- **Test**: Generate test cases
- **Fix**: Debug and fix issues

### Memory That Learns
TIMPs remembers your coding patterns, past bugs, and decisions to provide smarter assistance over time.

---

## 📦 Installation

### Automatic Setup (Recommended)
1. Install the extension
2. TIMPs auto-detects Ollama and downloads your model
3. Press **Cmd+Esc** to start!

### Manual Setup

**Install Ollama:**
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com
```

**Pull your model:**
```bash
ollama pull sandeeprdy1729/timps-coder
```

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `timps.agentMode` | `terminal` | `terminal`, `chat`, or `inline` |
| `timps.useLocalAgent` | `true` | Use local Ollama AI |
| `timps.localModel` | `sandeeprdy1729/timps-coder` | Ollama model |
| `timps.ollamaUrl` | `http://localhost:11434` | Ollama URL |
| `timps.autoInstall` | `true` | Auto-install dependencies |
| `timps.enableDiagnostics` | `true` | Show inline hints |

---

## 🎯 Usage

### From Terminal
1. Press **Cmd+Esc**
2. Type natural language commands:
```
/explain this function
/refactor to use async/await
/test write unit tests for this
/fix handle the error case
```

### From Chat
1. Press **Cmd+Shift+C**
2. Ask questions about your code

### From Context Menu
1. Select code in editor
2. Right-click → TIMPs
3. Choose action (Explain, Refactor, Test, Fix)

### File References
1. Press **Cmd+Option+K**
2. Inserts `@filename#Lline`

---

## 💡 Tips

- Use `/help` in terminal for all commands
- TIMPs has memory - it learns from your patterns
- Combine with git for best results
- Works with any Ollama model

---

## 🤖 Supported Models

- `sandeeprdy1729/timps-coder` (recommended - your custom model)
- `qwen2.5-coder:7b` - General coding
- `deepseek-r1:7b` - Reasoning
- `codellama:13b` - Meta's model

---

## 🏗️ Architecture

```
┌──────────────┐     Terminal     ┌─────────────┐
│ VS Code      │ ────────────────→│ TIMPs CLI    │
│ Extension    │                  │ (Node.js)    │
└──────────────┘                  └──────┬──────┘
       │                                  │
       │ Chat                             ▼
       ▼                          ┌─────────────┐
┌──────────────┐                  │ Ollama      │
│ Webview     │                  │ (Local AI) │
│ Panel       │                  └─────────────┘
└──────────────┘
```

---

## 🛠️ Development

```bash
# Clone and setup
git clone https://github.com/Sandeeprdy1729/timps.git
cd timps/timps-vscode

# Install
npm install

# Test (F5 to launch debug)
npm run watch

# Build
npm run compile

# Package
npx vsce package
```

---

## 📄 License

MIT - [github.com/Sandeeprdy1729/timps](https://github.com/Sandeeprdy1729/timps)
