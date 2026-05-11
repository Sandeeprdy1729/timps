local utils = require("timps.utils")

local M = {}

local ns_id = vim.api.nvim_create_namespace("timps_warnings")

function M.warn(line, col, end_col, message, severity)
  severity = severity or "warning"
  local hl_group = severity == "error" and "DiagnosticError" or "DiagnosticWarn"
  vim.api.nvim_buf_set_extmark(0, ns_id, line - 1, col, {
    end_col = end_col,
    virt_text = { { " " .. message, hl_group } },
    virt_text_pos = "eol",
  })
end

function M.clear(bufnr)
  bufnr = bufnr or 0
  vim.api.nvim_buf_clear_namespace(bufnr, ns_id, 0, -1)
end

function M.bug_warning(line, message)
  M.warn(line, 0, 0, "[BUG] " .. message, "error")
end

function M.debt_warning(line, message)
  M.warn(line, 0, 0, "[DEBT] " .. message, "warning")
end

return M
