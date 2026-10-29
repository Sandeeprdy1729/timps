---
"@timps-ai/memory-core": patch
---

### Security: remove polynomial ReDoS in four regexes; npm audit runs on Windows

CodeQL flagged `js/polynomial-redos` in regexes that run on user- or
plugin-supplied text. Each now matches the same inputs in linear time:

- `ContentCompressor` file-path entities: anchored to the start of a path-like
  run (100k `-` took seconds, now well under 1 ms).
- Marketplace scanner `"dependencies"` parsing: the object body can no longer
  run past a nested `{`.
- `ConstitutionalSandbox` code-fence extraction: a language tag only counts
  when a newline follows it. This also fixes inline fences like
  ```` ```print('hi')``` ````, which lost `print` as a fake language tag.
- `MeetingGhost` deadline parsing: no more adjacent `\s*` quantifiers.

The marketplace scanner's `npm audit` spawned `npm.cmd` with `shell: false`,
which Node rejects on Windows (EINVAL since the CVE-2024-27980 fix), so the
audit was always skipped there. It now runs npm's CLI script with the current
`node` binary, still without a shell.
