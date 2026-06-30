# TIMPS Neovim Plugin

> **Status: Wrapper around `timps` CLI** — all commands call the external `timps` binary. Requires `@timps-ai/timps-code` installed globally.

```lua
-- lazy.nvim
{ 'Sandeeprdy1729/timps', cmd = { 'TIMPS', 'TIMPMem', 'TIMPSwarm' },
  config = function()
    vim.g.timps_provider = 'ollama'
  end
}
```

## Commands

| Command | Action |
|---------|--------|
| `:TIMPS` | One-shot chat via `timps` CLI |
| `:TIMPMem` | Show memory stats |
| `:TIMPSwarm` | Show swarm status |
| `:TIMPSQuery <q>` | Query knowledge graph |
| `:TIMPBranch <n>` | Branch memory |
| `:TIMPMerge <n>` | Merge branch |
| `:TIMPBench` | Run benchmark |
| `:TIMPShare` | Export memory |
| `:TIMPClone <p>` | Import memory pack |

## Keymaps

`<leader>ti` (chat), `<leader>tm` (memory), `<leader>tq` (query), `<leader>ts` (swarm)
