---
"@timps/server": patch
---

Tighten the sandbox for the LLM-driven `file_operations` tool. The default
allowlist was `[cwd, $HOME]` — an allowlist that implicitly includes the entire
home directory is not a sandbox (prompt-injected model output could read
`~/.ssh`, `~/.aws`, browser profiles, etc.). The tool is now restricted to the
server's working directory only; operators may explicitly widen it with
`TIMPS_FILE_BASE_DIRS` (colon-separated). Symlink escapes are also blocked —
paths are fully canonicalized (`realpath`) before the containment check, so a
symlink inside the sandbox pointing outside cannot be followed.
