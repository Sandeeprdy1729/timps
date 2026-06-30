# TIMPS JetBrains Plugin

> **Status: 🟡 Skeleton — most actions are stubs.** The plugin registers UI panels and tool windows but core functionality (chat, memory, intelligence alerts) is not implemented. The `TIMPSPlugin.actionPerformed` body is empty.

Requires IntelliJ IDEA with Kotlin plugin. Communicates with the `timps` CLI via child process.

```bash
./gradlew runIde    # dev
./gradlew buildPlugin
```

## Files

`TIMPSPlugin.kt` (entry, empty action), `TIMPSToolWindow.kt`, `TIMPSChatTool.kt`, `MemoryExplorer.kt`, `IntelligencePanel.kt`, `TIMPSAgent.kt`, `MemorySyncService.kt`, `TIMPSService.kt` (spawns CLI process)
