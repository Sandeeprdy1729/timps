# @timps/server

## 2.0.5

### Patch Changes

- 7e2583a: Rename the global bin from `timps` to `timps-server` so installing both
  `@timps/server` and `@timps-ai/timps-code` no longer collides on the same
  `timps` shim (previously the second install overwrote the first, so which
  product `timps` launched depended on install order). The CLI
  (`@timps-ai/timps-code`) remains the canonical `timps` command; the server is
  now invoked as `timps-server`. The private root package no longer declares a
  conflicting `timps` bin either.
- d00ec1c: Tighten the sandbox for the LLM-driven `file_operations` tool. The default
  allowlist was `[cwd, $HOME]` — an allowlist that implicitly includes the entire
  home directory is not a sandbox (prompt-injected model output could read
  `~/.ssh`, `~/.aws`, browser profiles, etc.). The tool is now restricted to the
  server's working directory only; operators may explicitly widen it with
  `TIMPS_FILE_BASE_DIRS` (colon-separated). Symlink escapes are also blocked —
  paths are fully canonicalized (`realpath`) before the containment check, so a
  symlink inside the sandbox pointing outside cannot be followed.
- 96d2c98: Harden the `web_fetch` SSRF guard. The previous `isInternalUrl` check only
  string-matched the hostname against static blocklists, so decimal/hex/IPv6
  literals (`http://2130706433`, `http://0x7f.1`, `http://[::1]`) and
  attacker-controlled DNS resolving to private addresses bypassed it.

  - Resolves the hostname via `dns.lookup({ all: true })` and requires EVERY
    resolved address (IPv4 + IPv6) to be public — loopback, RFC 1918, link-local
    (incl. `169.254.169.254`), CGNAT, unique-local, multicast, and reserved
    ranges are denied. Unresolvable hostnames are denied (fail-closed).
  - Follows redirects manually (capped at 5 hops) and re-runs the guard on every
    hop, so a public site cannot `302` into an internal/metadata endpoint.
  - Non-http(s) schemes are rejected; the fetch still runs under the existing
    timeout (M77).

- 3e620d7: Make `web_search` resilient instead of hardcoding one unofficial proxy
  (`https://ddg-api.vercel.app/search`). Providers now form an ordered fallback
  chain configured via `WEB_SEARCH_PROVIDERS` (default `ddg-api,duckduckgo`):

  - `ddg-api` — existing community proxy, still first by default
  - `duckduckgo` — official DuckDuckGo instant-answer API (api.duckduckgo.com,
    no key, structured JSON)
  - `custom` — operator-owned endpoint via `WEB_SEARCH_URL` (e.g. self-hosted
    SearXNG), optional `WEB_SEARCH_API_KEY` sent as a Bearer token

  When a provider is down, rate-limited, or changes shape, the tool falls through
  to the next provider instead of silently returning errors. If every provider
  fails, it returns a clear `Search error: all search providers failed — ...`
  listing each provider's failure, and an empty/invalid provider config is
  reported rather than crashing.
