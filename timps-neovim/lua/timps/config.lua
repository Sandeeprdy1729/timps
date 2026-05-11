local M = {}

M.config = {
  provider = "ollama",
  model = "qwen2.5-coder:latest",
  auto_warn = true,
  share_enabled = false,
}

function M.setup(opts)
  opts = opts or {}
  for k, v in pairs(opts) do
    M.config[k] = v
  end
  vim.g.timps_provider = M.config.provider
  vim.g.timps_model = M.config.model
  vim.g.timps_auto_warn = M.config.auto_warn
end

return M
