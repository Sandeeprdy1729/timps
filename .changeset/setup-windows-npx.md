---
"@timps-ai/timps-code": patch
---

### `timps setup`: working MCP registration on Windows; README points at current packages

- On Windows, `timps setup` registered `command: "npx"`. MCP clients spawn
  servers without a shell and `npx` is `npx.cmd` there, so the server failed to
  start with ENOENT. Windows registrations now use `cmd /c npx -y @timps-ai/timps-mcp`.
- `--binary` pointing at a `.js`/`.cjs`/`.mjs` bundle is now run with `node`.
- The README quickstart (`npx timps-code`) and npm badges pointed at the stale
  unscoped `timps-code`/`timps-mcp` packages (2.0.1); they now use
  `@timps-ai/timps-code` and `@timps-ai/timps-mcp`.
