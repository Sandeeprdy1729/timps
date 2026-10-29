---
"@timps-ai/memory-core": patch
"@timps-ai/timps-mcp": patch
---

### memory-core: one store per Windows project, deterministic forecasts, auth warning

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
