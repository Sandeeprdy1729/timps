---
"@timps-ai/memory-core": patch
---

### MemoryServer: `/context` and gRPC `GetContext` returned an empty context

`MemoryEngine.getContextString()` became async, but the REST `POST /context`
handler and the gRPC `GetContext` handler didn't await it, so REST clients got
`{ "context": {} }` (a serialized Promise) and gRPC got a Promise in a string
field. Both now await the result. The `benchmark/runners/timps.ts` LLM benchmark
had the same bug with `recall()`, so it compared "no memory" against "no memory";
it now awaits recall.
