# @timps-ai/memory-core

## 1.0.4

### Patch Changes

- 23eff61: ### MemoryServer: `/context` and gRPC `GetContext` returned an empty context

  `MemoryEngine.getContextString()` became async, but the REST `POST /context`
  handler and the gRPC `GetContext` handler didn't await it, so REST clients got
  `{ "context": {} }` (a serialized Promise) and gRPC got a Promise in a string
  field. Both now await the result. The `benchmark/runners/timps.ts` LLM benchmark
  had the same bug with `recall()`, so it compared "no memory" against "no memory";
  it now awaits recall.

- 7bdf855: ### memory-core: one store per Windows project, deterministic forecasts, auth warning

  - **Windows:** `projectHash()` used `fs.realpathSync`, which keeps the caller's
    casing, so `C:\Proj` and `c:\proj` (VS Code often lowercases the drive)
    hashed to different stores and a project's memory split in two depending on
    which tool launched the server. It now uses `fs.realpathSync.native`, which
    returns the on-disk case. A store that already exists under the old hash
    keeps being used, so no memories are orphaned.
  - `ChronosForge.simulateForesight()` and ResonanceForge (weave phase,
    harmonic projection) used unseeded `Math.random()`, so identical state could
    return a different risk level on every call. Noise is now seeded from the
    inputs (`fnv1a` + `mulberry32`), as the "no `Math.random()`" rule intends.
  - Intelligence tools built IDs from `Math.random()`; they now use `generateId()`
    (crypto), matching the repo convention.
  - `MemoryServer` (`start.ts`) now warns at startup when neither
    `TIMPS_JWT_SECRET` nor `TIMPS_API_KEY_AUTH` is set, since the server is then
    unauthenticated.

- 5762f45: ### Fix recall ranking: normalize BM25 scores before confidence calibration

  `recall()` passed raw MiniSearch BM25 scores (typically 3–15) to
  `ConfidenceCalibrator` as `similarity`, which is weighted as if it were 0–1.
  Every candidate clamped to confidence 1.0, so the final order was decided by
  floating-point noise in the false-memory risk score and the best match often
  ranked last. Similarity is now scaled relative to the top candidate.

  Benchmark (`benchmark/index.ts --quick`): Recall@1 0% → 70%, Recall@5 15% → 90%,
  MRR 0.08 → 0.77.

- 0bba65e: ### Security: remove polynomial ReDoS in four regexes; npm audit runs on Windows

  CodeQL flagged `js/polynomial-redos` in regexes that run on user- or
  plugin-supplied text. Each now matches the same inputs in linear time:

  - `ContentCompressor` file-path entities: anchored to the start of a path-like
    run (100k `-` took seconds, now well under 1 ms).
  - Marketplace scanner `"dependencies"` parsing: the object body can no longer
    run past a nested `{`.
  - `ConstitutionalSandbox` code-fence extraction: a language tag only counts
    when a newline follows it. This also fixes inline fences like
    ` ```print('hi')``` `, which lost `print` as a fake language tag.
  - `MeetingGhost` deadline parsing: no more adjacent `\s*` quantifiers.

  The marketplace scanner's `npm audit` spawned `npm.cmd` with `shell: false`,
  which Node rejects on Windows (EINVAL since the CVE-2024-27980 fix), so the
  audit was always skipped there. It now runs npm's CLI script with the current
  `node` binary, still without a shell.

- 10aeb95: ### Sandbox: run on Windows; create Python venvs without pip

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

- 9bd54c7: ### Fix EPERM crashes on Windows from leaked file descriptors

  `FileBackend.write()`/`append()` and `EngramLog`'s atomic write opened the
  temp file with `fs.openSync(path, 'r')` only to fsync it, and never closed the
  descriptor. On Windows the open handle blocks the next rename onto the same
  file, so `timps-mcp` crashed on first launch in a new project
  (`schema-version.json` is written once per migration) and every second
  `timps_store_memory` call in a session failed with
  `EPERM: operation not permitted, rename '...json.wal'`.

  The descriptor is now opened `'r+'` (Windows rejects fsync on read-only
  handles, so the old code never actually synced there) and always closed.
  `InstitutionalMemory.save()` also leaked a write descriptor; it now uses
  `fs.writeFileSync`.
