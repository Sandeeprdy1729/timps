---
"timps-code": minor
---

`timps setup --server <url>` now registers agents with **both** `TIMPS_URL` and `TIMPS_MEMORY_URL`, so memory tools (`timps_store_memory`, `timps_get_memories`, `timps_check_contradiction`) route to the shared MemoryServer instead of falling back to the LLM `chat` path. Override either URL via `TIMPS_SETUP_ENV`. Server-mode output now points to the new `DEPLOY.md` → Option 5 (MemoryServer full stack) guide covering the docker-compose stack, scaling, and verification.
