# TIMPS Neovim Plugin

## Overview
TIMPS for Neovim — the terminal-native IDE crowd. Inspired by jcode's speed, but with TIMPS's memory.

## Features
- **TIMPS Chat** — `TIMPChat` command opens chat buffer with TIMPS
- **Memory Quick-view** — `TIMPMem` shows recent memories
- **Intelligence Alerts** — Inline virtual text for bug/debt warnings
- **Swarm Panel** — `TIMPSwarm` shows agent statuses
- **Lazy Integration** — Loads TIMPS only when needed

## Installation (Lazy.nvim)

```lua
-- In your lazy spec
{
  'Sandeeprdy1729/timps',
  -- or: requires the timps.nvim file from this repo
  rocks = { 'plenary' }, -- for async operations
  cmd = { 'TIMPS', 'TIMPMem', 'TIMPSwarm', 'TIMPSQuery' },
  ft = { 'python', 'typescript', 'typescriptreact', 'javascript', 'rust', 'go', 'lua', 'c', 'cpp' },
  config = function()
    vim.g.timps_provider = 'ollama'  -- or 'claude', 'openai', 'gemini'
    vim.g.timps_model = 'qwen2.5-coder:latest'
    vim.g.timps_auto_warn = true     -- Show bug/debt warnings
    vim.g.timps_share_enabled = false
  end,
}
```

## Commands

| Command | Description |
|---|---|
| `:TIMPS` | Open TIMPS chat buffer |
| `:TIMPS <message>` | One-shot TIMPS query |
| `:TIMPMem` | Show memory stats |
| `:TIMPSwarm` | Show swarm agent status |
| `:TIMPSQuery <question>` | Query knowledge graph |
| `:TIMPBranch <name>` | Create memory branch |
| `:TIMPMerge <name>` | Merge memory branch |
| `:TIMPBench` | Run benchmark suite |
| `:TIMPShare` | Export and share memory |
| `:TIMPClone <path>` | Import memory pack |

## Key Mappings

```lua
-- ~/.config/nvim/lua/timps.lua
vim.api.nvim_set_keymap('n', '<leader>ti', ':TIMPS<CR>', { noremap = true })
vim.api.nvim_set_keymap('n', '<leader>tm', ':TIMPMem<CR>', { noremap = true })
vim.api.nvim_set_keymap('n', '<leader>tq', ':TIMPSQuery ', { noremap = true })
vim.api.nvim_set_keymap('n', '<leader>ts', ':TIMPSwarm<CR>', { noremap = true })
```

## Architecture

```
timps-neovim/
├── lua/
│   ├── timps/
│   │   ├── init.lua          # Plugin entry
│   │   ├── config.lua         # Configuration
│   │   ├── chat.lua          # Chat buffer UI
│   │   ├── memory.lua        # Memory commands
│   │   ├── swarm.lua         # Swarm commands
│   │   ├── ui.lua            # UI helpers (virtual text)
│   │   ├── api.lua           # TIMPS CLI wrapper
│   │   ├── highlight.lua     # Virtual text warnings
│   │   └── utils.lua          # Common utilities
│   └── timps.nvim            # Entry point (require('timps'))
├── README.md
└── LICENSE
```

## UI Design

- **Chat Buffer** — Full-width terminal buffer with streaming
- **Memory Panel** — Side panel (like NERDTree) with memory graph
- **Intelligence Warnings** — Virtual text below lines with bugs/debt
- **Swarm Status** — Floating window with agent cards

## TODO
- [ ] Core chat buffer with streaming
- [ ] Memory stats display
- [ ] Virtual text for bug/debt warnings
- [ ] Swarm agent panel
- [ ] Knowledge graph query
- [ ] Memory branch/merge
- [ ] MCP integration
- [ ] Lazy loading for performance

## License
MIT