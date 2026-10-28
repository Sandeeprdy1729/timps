---
"@timps-ai/memory-core": patch
"@timps-ai/timps-mcp": patch
---

### Fix EPERM crashes on Windows from leaked file descriptors

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
