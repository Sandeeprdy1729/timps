---
"@timps-ai/timps-mcp": patch
---

### timps-mcp: secure the HTTP transport, real version, --version/--help

- **Security:** `--http` mode listened on every interface with
  `Access-Control-Allow-Origin: *` and no auth, so anyone on the network — or
  any web page the user visited (directly or via DNS rebinding) — could read and
  write their memory. It now binds to `127.0.0.1` by default (`--host` /
  `TIMPS_MCP_HOST` to change), rejects cross-site browser origins (loopback
  origins and `TIMPS_MCP_ALLOWED_ORIGINS` are allowed), rejects non-loopback
  `Host` headers when bound to loopback, and requires
  `Authorization: Bearer $TIMPS_MCP_TOKEN` when that variable is set.
- Malformed JSON now gets a JSON-RPC parse error (400) instead of a 500, and
  request bodies are capped at 4 MB (413).
- The server reported version `1.0.0` and its startup line always pointed at
  `http://localhost:3000`, even in local mode. It now reports the package
  version, the actual mode (local project path or server URL) and the tool count.
- `/health` reported a hardcoded 67 tools; it now reports the real count (69).
- `--version`/`-v` and `--help`/`-h` print and exit instead of starting a
  server, and the memory engine is no longer created at import time.
