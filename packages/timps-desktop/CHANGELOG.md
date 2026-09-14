# TIMPS Desktop Changelog

## v0.1.1 (Sep 2026)

### Changed
- **Aggregate all stores**: Overview, Lens, Stats and Nexus now operate across every
  store in `~/.timps/memory/<hash>/` instead of a single active project. The top bar
  shows the aggregate scope (stores · facts · episodes) and every result is stamped
  with its source store.
- **Lens is now memory search**: debounced full-text search across all stores with
  per-result highlighting, tags, scores and store chips.
- **Stats rewritten**: aggregate breakdown with per-store table and a "no data" empty
  state (fixed the eternal-loading bug).
- **Nexus simplified**: static whole-graph view of all stores. No simulated physics
  loop and no 5-second polling — layout runs once on load, nodes are capped at 800,
  and a manual refresh button replaces auto-refresh.
- **Settings cleaned up**: removed the AI Provider section (OpenAI/Anthropic/xAI/Ollama
  + API key) and the Server URL section. Project path selection removed.
- **Connectors guided setup**: 3-step flow per provider — open the developer console
  from the app, register `http://localhost:12849/oauth2callback`, then paste
  client_id/client_secret inline or import the OAuth client JSON. Connect requires
  credentials first.

### Added
- **Memory view**: file/folder browser over `~/.timps` with sizes and a content
  preview pane.
- New Rust commands: `get_aggregate_stats`, `load_all_semantic`, `load_all_episodes`,
  `search_memory_all`, `list_memory_tree`, `read_memory_file`, `load_unified_graph_all`,
  `connector_save_credentials`, `connector_open_console`.

### Fixed
- Fixed the fixed-port OAuth listener (binds `127.0.0.1:12849` first, falls back to an
  ephemeral port with a warning when busy).
- Fixed a latent `trim_label` panic on multi-byte characters in the Nexus graph.
- Passive clipboard captures now go to the shared home store instead of a project path.

### Removed
- Chat view, Command Center, Search view, Semantic view, Episodic view,
  BackgroundDaemon and PassiveListener components (no longer wired up in the app).

## v0.1.0 (May 2026)

### Added
- System tray with context menu (Show Window, Quick Capture, Settings, Quit)
- Global shortcuts: Cmd+Shift+T (show window), Cmd+Shift+N (quick capture), Cmd+Shift+K (command bar)
- Quick Capture modal for fast memory entry
- Command Bar overlay for natural language queries
- Memory CRUD operations via Rust backend
- Chat integration with TIMPS server
- Multiple UI views: Chat, Semantic, Episodic, Stats, Search, Settings
- Theme system (dark/light/system)
- Auto-updater support (tauri-plugin-updater)
- Typed IPC API via preload script
- Code signing configuration
- E2E tests scaffold

### Features
- Memory views with filtering and search
- Project path management
- Provider configuration display
- Keyboard shortcuts documentation
- About section with version info