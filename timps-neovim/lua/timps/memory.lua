local api = require("timps.api")
local utils = require("timps.utils")

local M = {}

function M.stats()
  local out = api.execute("timps", {"--stats"})
  if out then
    print(out)
  else
    utils.err("Failed to run timps --stats")
  end
end

function M.show()
  local out = api.execute("timps", {"--stats"})
  if out then
    local lines = {}
    for line in out:gmatch("[^\r\n]+") do
      table.insert(lines, line)
    end
    vim.notify(table.concat(lines, "\n"), "info", { title = "TIMPS Memory" })
  end
end

function M.branch(name)
  if not name or name == "" then
    utils.usage("Branch name required: TIMPBranch <name>")
    return
  end
  api.execute("timps", {"--memory-branch", name})
  utils.info("Memory branch created: " .. name)
end

function M.merge(name)
  if not name or name == "" then
    utils.usage("Branch name required: TIMPMerge <name>")
    return
  end
  api.execute("timps", {"--memory-merge", name})
  utils.info("Memory branch merged: " .. name)
end

return M
