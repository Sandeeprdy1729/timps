---
"@timps/server": patch
---

Rename the global bin from `timps` to `timps-server` so installing both
`@timps/server` and `@timps-ai/timps-code` no longer collides on the same
`timps` shim (previously the second install overwrote the first, so which
product `timps` launched depended on install order). The CLI
(`@timps-ai/timps-code`) remains the canonical `timps` command; the server is
now invoked as `timps-server`. The private root package no longer declares a
conflicting `timps` bin either.
