---
"@timps-ai/timps-code": patch
---

### LSP proxy: no duplicate language servers after a restart

`LspProxyServer`'s child `exit` handler cleared `realServerProcess`
unconditionally, so after `stop()` + `start()` the old process's late exit
wiped the reference to the new one. The proxy then thought no server was
running and the next `start()` spawned a duplicate. The handler now only clears
its own child. `stop()` also returns a Promise that resolves once the server
has exited (escalating to SIGKILL after 2s), so callers can wait for a clean
shutdown.
