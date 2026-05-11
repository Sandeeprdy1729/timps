# TIMPS JetBrains Plugin

## Overview
Full TIMPS integration for IntelliJ IDEA, WebStorm, PyCharm, GoLand, and all JetBrains IDEs.

## Features
- **TIMPS Chat Panel** — Chat window integrated in the IDE
- **Memory Explorer** — Visual episodic/semantic memory browser
- **Intelligence Tool Windows** — Bug warnings, burnout analysis, tech debt alerts
- **Agent Terminal** — Embedded TIMPS terminal with syntax highlighting
- **Inline Suggestions** — AI completions powered by TIMPS memory

## Architecture

```
timps-jetbrains/
├── src/
│   ├── main/kotlin/
│   │   ├── TIMPSPlugin.kt         # Plugin entry point
│   │   ├── TIMPSToolWindow.kt     # Tool window for TIMPS panel
│   │   ├── TIMPSChatTool.kt       # Chat interface
│   │   ├── MemoryExplorer.kt      # Memory graph visualization
│   │   ├── IntelligencePanel.kt   # Burnout, bug, debt warnings
│   │   ├── agent/
│   │   │   ├── TIMPSAgent.kt       # Agent communication
│   │   │   └── AgentConfigurable.kt
│   │   ├── actions/
│   │   │   ├── RunTIMPSAction.kt
│   │   │   ├── MemoryBranchAction.kt
│   │   │   └── SwarmPipelineAction.kt
│   │   └── services/
│   │       ├── TIMPSService.kt    # Background service
│   │       └── MemorySyncService.kt
│   └── resources/
│       └── META-INF/
│           └── plugin.xml
├── build.gradle.kts
└── settings.gradle.kts
```

## Development Setup

```bash
# Requires IntelliJ IDEA with Kotlin plugin
# Open this directory as a Gradle project
# Run: ./gradlew runIde

# Build plugin:
./gradlew buildPlugin

# Install from file:
# Settings → Plugins → Install from disk → timps-jetbrains/build/libs/timps-jetbrains-*.zip
```

## API Integration
- Communicates with `timps-code` CLI via process streams
- Uses TIMPS REST API for server mode
- MCP bridge for external tool access

## Key Classes

| Class | Purpose |
|---|---|
| `TIMPSPlugin` | Plugin lifecycle, extension registration |
| `TIMPSToolWindow` | Main panel container |
| `TIMPSChatTool` | Chat UI with streaming responses |
| `MemoryExplorer` | D3.js-powered knowledge graph |
| `TIMPSAgent` | Process management for CLI |
| `IntelligencePanel` | Warning tooltips for bug/debt/burnout |

## TODO
- [ ] Tool window implementation
- [ ] Chat UI with streaming
- [ ] Memory graph visualization
- [ ] Intelligence alerts (bug/debt/burnout)
- [ ] Inline code completions
- [ ] Swarm pipeline runner
- [ ] Memory branch visualization
- [ ] Test on IntelliJ IDEA Community Edition
- [ ] Publish to JetBrains Marketplace

## License
MIT