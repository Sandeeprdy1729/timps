---
"@timps/server": patch
---

Harden the `web_fetch` SSRF guard. The previous `isInternalUrl` check only
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
