local M = {}

function M.usage(msg)
  vim.api.nvim_err_writeln("[TIMPS] " .. (msg or ""))
end

function M.info(msg)
  vim.notify("[TIMPS] " .. msg, "info")
end

function M.warn(msg)
  vim.notify("[TIMPS] " .. msg, "warn")
end

function M.err(msg)
  vim.api.nvim_err_writeln("[TIMPS] ERROR: " .. msg)
end

return M
