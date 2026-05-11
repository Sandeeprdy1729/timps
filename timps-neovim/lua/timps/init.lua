local chat = require("timps.chat")
local memory = require("timps.memory")
local swarm = require("timps.swarm")
local ui = require("timps.ui")
local highlight = require("timps.highlight")
local config = require("timps.config")
local api = require("timps.api")
local utils = require("timps.utils")

local M = {}

M.config = config

vim.api.nvim_create_user_command("TIMPS", function(opts)
  chat.oneshot(opts.args)
end, { nargs = "?" })

vim.api.nvim_create_user_command("TIMPMem", function()
  memory.show()
end, { nargs = 0 })

vim.api.nvim_create_user_command("TIMPSwarm", function()
  swarm.status()
end, { nargs = 0 })

vim.api.nvim_create_user_command("TIMPSQuery", function(opts)
  local out = api.execute("timps", {"--query", opts.args})
  if out then print(out) end
end, { nargs = "+" })

vim.api.nvim_create_user_command("TIMPBench", function()
  local out = api.execute("timps", {"--benchmark"})
  if out then print(out) end
end, { nargs = 0 })

vim.api.nvim_create_user_command("TIMPShare", function()
  local out = api.execute("timps", {"--share-memory"})
  if out then print(out) end
end, { nargs = 0 })

vim.api.nvim_create_user_command("TIMPClone", function(opts)
  local path = opts.args
  if not path or path == "" then
    utils.usage("Usage: TIMPClone <path-or-url>")
    return
  end
  local out = api.execute("timps", {"--clone-memory", path})
  if out then print(out) end
end, { nargs = "?" })

vim.api.nvim_create_user_command("TIMPBranch", function(opts)
  memory.branch(opts.args)
end, { nargs = "?" })

vim.api.nvim_create_user_command("TIMPMerge", function(opts)
  memory.merge(opts.args)
end, { nargs = "?" })

vim.keymap.set("n", "<leader>ti", function() chat.open() end, { noremap = true, silent = true, desc = "Open TIMPS chat" })
vim.keymap.set("n", "<leader>tm", function() memory.show() end, { noremap = true, silent = true, desc = "TIMPS memory stats" })
vim.keymap.set("n", "<leader>tq", function() vim.cmd("TIMPSQuery ") end, { noremap = true, silent = true, desc = "TIMPS query KG" })
vim.keymap.set("n", "<leader>ts", function() swarm.status() end, { noremap = true, silent = true, desc = "TIMPS swarm status" })

function M.setup(opts)
  config.setup(opts)
end

return M
