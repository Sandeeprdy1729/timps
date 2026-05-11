local api = require("timps.api")

local M = {}

function M.open_panel()
  local lines = {
    "╔══════════════════════════════╗",
    "║      TIMPS Intelligence      ║",
    "╠══════════════════════════════╣",
    "║  Bug Warnings:    0          ║",
    "║  Tech Debt:       0          ║",
    "║  Burnout Score:   0%         ║",
    "╚══════════════════════════════╝",
  }
  vim.notify(table.concat(lines, "\n"), "info", { title = "TIMPS Intelligence" })
end

return M
