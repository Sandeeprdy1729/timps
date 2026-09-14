---
"timps-code": minor
---

### Generic connector sync services (calendar/drive/github/notion/slack/linear/ms365)

New `src/services/connectors/` module implementing the shared sync pipeline for the 7 non-gmail connectors: `registry.ts` (provider defs matching `packages/timps-desktop/.../connectors.rs`), `tokens.ts` (token/state storage + `ensureAccessToken` refresh), `clients.ts` (read-only per-provider fetchers → normalized items), `sync.ts` (`runConnectorSync` raw-store → summarize → `itemFact` distill → memory, dedup by raw file).

New `src/commands/connectors.ts` registers `<id>:sync|status|disconnect` for each provider — the exact commands the desktop Sync buttons shell out to. 9 tests added covering registry, storage, fact distillation, and the full (mocked-fetch) pipeline. Gmail keeps its own command module and shares no storage, staying backward compatible.