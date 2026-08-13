---
"@timps/server": patch
---

Make `web_search` resilient instead of hardcoding one unofficial proxy
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
