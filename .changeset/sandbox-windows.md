---
"@timps-ai/memory-core": patch
---

### Sandbox: run on Windows; create Python venvs without pip

- `SubprocessSandbox` spawned `bash`/`python3` by bare name with a sandbox
  `PATH` of `/usr/bin:/bin`, which doesn't exist on Windows, so every Bash and
  Python sandbox run failed with exit code -1. On Windows the runtime is now
  resolved to an absolute path via the host `PATH`/`PATHEXT`, `SYSTEMROOT` and
  friends are passed through (Python can't start without them), `python` is
  used instead of the `python3` Store alias, and the venv interpreter is read
  from `Scripts\python.exe`. POSIX behavior is unchanged.
- `PythonSandbox` now creates its venv with `--without-pip`. pip was never
  used, and bootstrapping it made each construction take seconds (~14s on
  Windows), which also caused intermittent 5s test timeouts in CI.
