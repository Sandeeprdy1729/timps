local api = require("timps.api")
local utils = require("timps.utils")

local M = {}

local agent_status = {}

function M.status()
  local out = api.execute("timps", {"--swarm"})
  if out then
    print(out)
  else
    utils.info("TIMPS swarm not active. Run a task first.")
  end
end

function M.run_pipeline(pipeline_type, target)
  pipeline_type = pipeline_type or "bugfix"
  local args = {"--swarm", "--pipeline", pipeline_type}
  if target then table.insert(args, 2, target) end
  api.spawn(args, function(line)
    print("[TIMPS] " .. line)
  end)
end

return M
