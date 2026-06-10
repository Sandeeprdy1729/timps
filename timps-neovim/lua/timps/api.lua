local M = {}

function M.execute(cmd, args, callback)
  local escaped = vim.tbl_map(function(a) return vim.fn.shellescape(tostring(a)) end, args or {})
  local full_cmd = cmd .. " " .. table.concat(escaped, " ")
  local handle = io.popen(full_cmd)
  if not handle then return end
  local output = handle:read("*a")
  handle:close()
  if callback then callback(output) end
  return output
end

function M.find_timps_binary()
  local paths = {
    vim.fn.stdpath("data") .. "/../npm-global/bin/timps",
    "/usr/local/bin/timps",
    "/usr/bin/timps",
    "npx"
  }
  for _, path in ipairs(paths) do
    local test = io.open(path, "r")
    if test then test:close(); return path end
  end
  return "npx"
end

function M.spawn(args, on_output, on_exit)
  local binary = M.find_timps_binary()
  local escaped = vim.tbl_map(function(a) return vim.fn.shellescape(tostring(a)) end, args or {})
  local cmd = binary .. " " .. table.concat(escaped, " ")
  local handle = io.popen(cmd .. " 2>&1")
  if not handle then return end
  local output = ""
  while true do
    local line = handle:read("*l")
    if not line then break end
    output = output .. line .. "\n"
    if on_output then on_output(line) end
  end
  handle:close()
  if on_exit then on_exit(0) end
  return output
end

return M
