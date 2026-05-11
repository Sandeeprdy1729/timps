local api = require("timps.api")
local utils = require("timps.utils")

local M = {}

local chat_bufnr = nil

function M.open(opts)
  opts = opts or {}
  if chat_bufnr and vim.api.nvim_buf_is_valid(chat_bufnr) then
    vim.api.nvim_set_current_buf(chat_bufnr)
    return
  end
  chat_bufnr = vim.api.nvim_create_buf(false, true)
  local winOpts = { relative = "editor", width = 80, height = 24, row = 3, col = (vim.o.columns - 80) / 2 }
  local win_id = vim.api.nvim_open_win(chat_bufnr, true, winOpts)
  vim.api.nvim_buf_set_name(chat_bufnr, "TIMPS Chat")
  vim.api.nvim_buf_set_lines(chat_bufnr, 0, -1, false, {
    "TIMPS Chat — Type your message and press Enter",
    "─────────────────────────────────────────────",
    "",
  })
  vim.api.nvim_buf_add_keymap(chat_bufnr, "n", "<CR>", "", {
    callback = function()
      local lines = vim.api.nvim_buf_get_lines(chat_bufnr, 0, -1, false)
      local input_line = nil
      for i = #lines - 1, 2, -1 do
        if lines[i]:match("^> ") then
          input_line = lines[i]:sub(3)
          break
        end
      end
      if input_line and input_line ~= "" then
        M.stream_message(input_line)
      end
    end
  })
  vim.api.nvim_buf_add_keymap(chat_bufnr, "n", "q", "", {
    callback = function()
      vim.api.nvim_win_close(win_id, true)
      chat_bufnr = nil
    end
  })
  vim.w[chat_bufnr] = { timps_chat = true }
end

function M.stream_message(msg)
  if not chat_bufnr or not vim.api.nvim_buf_is_valid(chat_bufnr) then
    M.open()
  end
  local lines = vim.api.nvim_buf_get_lines(chat_bufnr, 0, -1, false)
  local line_count = #lines
  vim.api.nvim_buf_set_lines(chat_bufnr, line_count, line_count + 1, false, { "> " .. msg, "" })
  vim.api.nvim_buf_set_lines(chat_bufnr, line_count + 1, line_count + 2, false, { "Thinking..." })
  local output = api.spawn({"--chat"}, function(line)
    vim.schedule(function()
      local cur_lines = vim.api.nvim_buf_get_lines(chat_bufnr, 0, -1, false)
      vim.api.nvim_buf_set_lines(chat_bufnr, #cur_lines, #cur_lines + 1, false, { line })
    end)
  end)
  vim.schedule(function()
    local cur_lines = vim.api.nvim_buf_get_lines(chat_bufnr, 0, -1, false)
    if #cur_lines > 0 and cur_lines[#cur_lines] == "Thinking..." then
      vim.api.nvim_buf_set_lines(chat_bufnr, #cur_lines - 1, #cur_lines, false, {})
    end
    vim.api.nvim_buf_set_lines(chat_bufnr, #cur_lines, #cur_lines + 1, false, { "", "─────────────────────────────────────────────", "" })
  end)
end

function M.oneshot(msg)
  if not msg or msg == "" then
    utils.usage("Usage: TIMPS <message>")
    return
  end
  local out = api.spawn({"--chat"}, function(line)
    print(line)
  end)
end

return M
