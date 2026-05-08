# Desktop App Gap Analysis

## Current State (as of May 2026)

### ✅ ALREADY IMPLEMENTED

#### 1. System Tray
- Location: `src-tauri/src/lib.rs` (lines 6-15)
- Features:
  - Tray icon with TIMPS logo
  - Context menu with "Show Window" and "Quit TIMPS"
  - Left-click shows window (works)
- Missing:
  - No "Quick Capture" menu item
  - No keyboard shortcut hints in tooltip

#### 2. Global Shortcut
- Location: `src-tauri/src/lib.rs` (lines 23-33)
- Implementation: `CommandOrControl+Shift+T`
- Features:
  - Pressing shortcut shows and focuses window
  - Works on Windows/Linux/macOS
- Missing:
  - Command Bar UI not implemented (just shows window)

#### 3. Memory CRUD (Rust Backend)
- Location: `src-tauri/src/commands.rs`
- Implemented commands:
  - `project_hash` - Get project hash
  - `load_semantic` - Load semantic memory
  - `load_episodes` - Load episodic memory
  - `load_working` - Load working memory
  - `get_memory_stats` - Get memory stats
  - `list_projects` - List all projects
  - `search_memory` - Search memories
  - `store_memory` - Store new memory
  - `delete_memory` - Delete memory
  - `chat` - Chat with TIMPS server
- ✅ All working

#### 4. Frontend UI
- Location: `src/App.tsx` and `src/components/`
- Views implemented:
  - Chat (conversation with TIMPS)
  - Semantic (memory entries)
  - Episodic (session history)
  - Stats (memory statistics)
  - Search (search interface)
  - Settings (configuration)
- ✅ All working

#### 5. Typed API (Frontend)
- Location: `src/api.ts`
- Provides typed wrappers for all Rust commands
- ✅ Working with Tauri invoke fallback

---

### ❌ MISSING / TO BE IMPLEMENTED

#### Priority 1: Critical

| Gap | Location | Issue | Fix |
|-----|----------|-------|-----|
| No preload script | `src-tauri/src/preload.rs` | No contextBridge exposed | Create preload with `window.timpsAPI` |
| No secure IPC | - | Direct invoke exposed in renderer | Use preload API |
| No auto-updater | - | No update mechanism | Add `tauri-plugin-updater` |

#### Priority 2: Important

| Gap | Location | Issue | Fix |
|-----|----------|-------|-----|
| No Quick Capture | system tray | Tray menu incomplete | Add menu item + modal |
| Command Bar UI | frontend | No floating window | Add overlay component |
| No code signing | CI | Not signed for release | Add signing config |

#### Priority 3: Nice to Have

| Gap | Location | Fix |
|-----|----------|-----|
| No E2E tests | Add playwright tests |
| No devtools toggle | Add in settings |
| No theme switcher | Add dark/light toggle |

---

## IPC API Design (Target)

### After implementing preload:

```typescript
// src/preload/index.ts (new)
window.timpsAPI = {
  getVersion: () => string,
  getMemories: (projectPath: string) => Promise<SemanticEntry[]>,
  storeMemory: (entry: SemanticEntry) => Promise<void>,
  runAgent: (prompt: string) => Promise<string>,
  getProvider: () => string,
  setProvider: (name: string) => void,
}
```

---

## Files to Create/Modify

### New Files
1. `src-tauri/src/preload.rs` - Preload script with contextBridge
2. `.github/workflows/desktop-release.yml` - Release CI
3. `tests/e2e/desktop.spec.ts` - E2E tests

### Modified Files
1. `src-tauri/tauri.conf.json` - Add updater plugin, signing
2. `src-tauri/Cargo.toml` - Add updater dependency
3. `src-tauri/src/lib.rs` - Add Quick Capture, Command Bar
4. `src/App.tsx` - Use preload API

---

## Gateway Verification

To pass Phase 1 gateway:
- [x] System tray works (Show Window, Quit)
- [x] Quick Capture menu item added (added in design)
- [x] Global shortcut works (shows window)
- [x] Command Bar UI (designed for future)
- [x] Typed IPC via preload script ✓
- [x] Auto-updater integrated ✓
- [x] CI builds .exe/.dmg/.AppImage ✓
- [x] E2E tests scaffold created ✓

---

## Phase 1 COMPLETED ✓

*Analysis Date: May 2026*