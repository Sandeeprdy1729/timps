# Compaction at one million entries — `.tmem` research

**Context pointer:** https://github.com/Sandeeprdy1729/timps/issues/64 (parent map: https://github.com/Sandeeprdy1729/timps/issues/62)
**Date:** 2026-11-24
**Status:** research finding; not a spec change and not an implementation
**Vocabulary:** per the root `GLOSSARY.md`, *memory format* means the `.tmem` bytes, *memory engine* means the device executing memory operations, and *memory chip* (DRAM silicon) is out of scope. This ticket is only about the memory format.

## Decision

**`.tmem` v0.1 stays a single-file, append-only memory format. It does not adopt a second log/index file.**

- "Append-only" applies to a *file generation*: records are only appended, never mutated in place. Compaction creates a **new single `.tmem` file generation**, writes live records plus rebuilt sections into it deterministically, then swaps generations by rename. The old generation is unlinked after the swap. There is no persistent pair of files to pin, hash, or ship.
- `ENTRY_INDEX` is an **appended section inside the same file** (index records appended as entries are appended), not a sidecar artifact. A two-file log+index layout is deferred to v0.2 at the earliest.
- The cost analysis below is why: a *full rewrite* costs roughly the same one read pass + one write pass in both shapes, so a second file does not fix the 1M rewrite. What the log+index idea actually fixes is the current store's **per-append O(n) rewrite**; that win is available inside one file and does not require a second artifact.
- Consequences: the spec must define compaction as a deterministic whole-file copy (including chain checkpointing and index/Bloom rebuild), and the 20 golden vectors must include a pre-/post-compaction pair. See "Consequences" below.

This decision was checked against stored project positions before being recorded; no contradiction was reported.

## Question

> How expensive is compaction at one million entries under an append-only format? Using the current JSON store and the proposed log-plus-index shape as reference points, determine the wall-clock and write-amplification cost of a full rewrite, and whether a two-file (log + index) design is warranted in v0.1.

## Evidence ledger — measured vs derived

I distinguish three evidence classes. **No claim in the "reasoned estimate" class is presented as a benchmark.** The repository has no 1M-entry benchmark: `benchmark/index.ts:468` runs its scalability sweep at only 50 / 200 / 500 facts, and `AUDIT-TRACKER.md` H60 records a prior cleanup of fabricated benchmark claims. That history is a further reason to label numbers carefully.

### 1. Code facts (read-only, repo snapshot `e558abed`)

| Fact | Source |
|---|---|
| `store()` loads the *entire* `semantic.json` via `loadSemantic()` before every insert, then persists the whole array via `saveSemantic()` — one full read + one full write per append. | `packages/memory-core/src/MemoryEngine.ts:855`, `:959-960`; `src/storage.ts:170-181` |
| `FileBackend.write()` serializes the whole value to `<key>.wal`, fsyncs, then renames over `<key>`; `FileBackend.append()` **also reads the whole file, writes a whole `.wal`, fsyncs and renames** — so the current "append" API is not an O(1) disk append. | `packages/memory-core/src/backends/FileBackend.ts:124-140`, `:203-216` |
| Default caps: `TIMPS_MAX_SEMANTIC` = 100,000 and `TIMPS_MAX_EPISODES` = 10,000. A 1M-entry store requires raising the env var; otherwise `saveSemantic()` silently truncates the oldest entries with a warning. | `packages/memory-core/src/storage.ts:16-17`, `:175-181` |
| `runCompaction()` loads all entries, runs the pipeline, then calls `saveSemantic()` again when any entries are deleted or compressed — a second whole-file WAL write. | `packages/memory-core/src/MemoryEngine.ts:1419-1446` |
| The pipeline classifies → clusters → consolidates (one awaited LLM call per cluster; no LLM ⇒ rule-based fallback) → compresses → gzips cold entries into `archive/` → counts deletions. | `src/compaction/CompactionPipeline.ts:77-188`; `src/compaction/LLMConsolidationEngine.ts:88-108`; `src/compaction/ArchiveBackend.ts:29-64` |
| k-means cluster count is `max(1, round(sqrt(N/2)))`, with capacity bounded by `clusterMaxSize` (200) in a full merge; the TS fallback is CPU-heavy, native Rust path optional. | `src/compaction/ClusterEngine.ts:44-58`, `AGENTS.md` Phase 4c |
| Two O(n²) shapes at 1M in the current pipeline: cold entries are resolved with `entries.find(...)` per classified cold item, and compression applies `compressed.some(...)` per kept entry. | `CompactionPipeline.ts:153`, `:204`; `MemoryEngine.ts:1438` |
| Compaction is opt-in (`MemoryEngineOptions.compaction` default `undefined`); the prior research doc's proposed entry record already reserves `prev_entry_hash`, per-record vectors and 64-byte alignment. | `MemoryEngine.ts:217`, `:370-373`; `research/tmem/TMEM-FORMAT-AND-HARDWARE-RESEARCH.md` §4.4 |

### 2. Local micro-measurement (measured, not a repo benchmark)

One run on this machine (macOS arm64, Node v22.23.1, 8 GiB RAM, warm page cache), 1,000,000 deterministic synthetic entries shaped like `MemoryEntry` (`id`, `timestamp`, `type`, ~100-byte `content`, 3 tags), **no embeddings**. Raw I/O primitives only; no `MemoryEngine`, no compaction pipeline, no network. Single run, so treat as order-of-magnitude, not a statistically robust benchmark.

| Operation | Measured |
|---|---|
| `JSON.stringify` of 1M entries | 498 ms |
| Serialized size | 213,840,903 B = 213.8 MB → **213.8 B/entry** |
| `writeFileSync` of that JSON (no fsync) | 305 ms (~701 MB/s) |
| `.wal` write + fsync + rename | 906 ms (~236 MB/s) |
| `readFileSync` + `JSON.parse` of that JSON | 1,246 ms |
| Build 1M NDJSON lines | 93 ms; 213.8 MB (same B/entry) |
| Batched write of the append-only log | 297 ms |
| Sequential scan of 1M log lines (parse each line) | 1,112 ms |
| Rewrite log keeping 80% live | 126 ms to build, 1,110 ms to write (cache pressure; first full write was 297 ms — quote the range 0.3–1.1 s) |
| Build synthetic index records | 1,140 ms; 19 MB for ~19 B/record (the prior format's ~40 B/entry estimate ⇒ ~40 MB at 1M) |

These numbers support byte/throughput arithmetic. They do **not** measure a full 1M `MemoryEngine.store()` loop or a 1M `runCompaction()` call; those were not run.

### 3. External primary sources (published, not measured here)

- RocksDB's official wiki says leveled compaction's write amplification is "often larger than 10" (`Leveled-Compaction`, Intra-L0 section). Its own blog quantifies leveled compaction WA at "typically 20–30 times user data" and publishes a 400M-key `db_bench` with 285.90 GB compaction writes and 269.68 GB compaction reads — i.e. a real full compaction reads and writes roughly one full data pass each ([blog](https://rocksdb.org/blog/2022/10/31/align-compaction-output-file.html)).
- RocksDB's FIFO compaction wiki states WA is "always 1" for append-and-drop-oldest files — the closest published analogue to a pure append-only log.
- SQLite's `VACUUM` documentation describes exactly the copy-out model proposed here: copy live content into a new file and overwrite/swap, needing up to 2× free disk space; `VACUUM INTO` writes a consistent snapshot to a new file ([docs](https://www.sqlite.org/lang_vacuum.html)).
- The prior local research doc (`research/tmem/TMEM-FORMAT-AND-HARDWARE-RESEARCH.md` §1, §4.1) states that the current JSON store rewrites `semantic.json` atomically per `store()` (O(n) write per memory), that JSON floats inflate embeddings ~4×, and that the format's own constraints are "one file" and "append-only: compaction rewrites to a new file".

## Cost analysis

Let `b` = bytes per entry and `N` = 1,000,000. Use the measured metadata-only `b ≈ 214 B/entry` ⇒ final logical size `S ≈ 214 MB`. With one 384-dim f32 embedding per entry, binary vectors alone are ~1.5 KB/entry and the prior research's ~4× JSON-float inflation implies `S ≈ 4–6 GB`; treat that as a **reasoned estimate**, not measured here.

### A. Current JSON store

**Per append (building to 1M) — reasoned estimate from measured `b` and the code path:**

At append `k` the store reads ~`k·b`, serializes `(k+1)·b`, and writes `2·(k+1)·b` (WAL + renamed final). Summed over 1M appends:

- Total writes ≈ `b·N·(N+1)` ≈ **2.1 × 10¹⁴ B ≈ 214 TB** with WAL (~107 TB if WAL disabled).
- Write amplification vs final store ≈ **N ≈ 10⁶×** with WAL (~5 × 10⁵× without). The tail append alone writes ~427 MB (WAL + final).
- This is worse than a leveled LSM's published 20–30× WA: the JSON store is not log-structured at all, it rewrites the entire array on every append. The repo's `FileBackend.append()` is no escape — it rewrites the whole file too.

**One full rewrite / compaction event — reasoned estimate from measured primitives:**

| Component | Metadata-only (S ≈ 214 MB) | With 384-d f32 vectors (S ≈ 4–6 GB, reasoned) |
|---|---|---|
| Read + parse existing JSON | 1.25 s measured | ~25–35 s linearized |
| Serialize live set | 0.50 s measured | ~10–15 s |
| WAL write + fsync + rename | 0.91 s measured | ~17–26 s |
| Pipeline work (classify, cluster, consolidate, archive) | not measured; O(n) at best | not measured; potentially minutes (see below) |
| **Primitive subtotal** | **~2.7 s** | **~50–75 s** |
| **Write amplification** | **2× live bytes (2.5× if 20% dead)**; up to **4× (5× with 20% dead)** when `runCompaction()` writes `semantic.json` a second time | same ratios |

Scale cliffs beyond the copy, derived from code (not measured): with 1M all-warm entries, `sqrt(N/2) ≈ 707` clusters; `CompactionPipeline` awaits consolidation **sequentially** per cluster, so 707 BYOK LLM calls (or the same number of rule-based fallbacks) dominate wall clock. The `entries.find()` / `compressed.some()` O(n²) loops above turn a large cold or hot-verbose set into hundreds of billions of comparisons. A 1M compaction is therefore not just "214 MB × 2 I/O passes": the whole-file copy is the *cheap* part.

### B. Proposed log-plus-index shape

Model: one append-only log of fixed-format records plus an in-file index section; compaction scans the old log, writes live records to a new log generation, then rebuilds the index (and Bloom) from the live set.

**Per append (reasoned):** O(1) amortized when writes are real `O_APPEND` writes (buffered). WA ≈ 1× log + a small index append (~40 B/entry, ~19% of `b` here) ⇒ **~1.2×**, or ~2.2× if a WAL is also kept. If the implementation reuses today's `FileBackend.append()` semantics, it is still O(n) per append and **none of this benefit is realized** — the log must be a genuinely appended byte stream.

**One full rewrite (reasoned from measured primitives):**

| Component | Metadata-only (S ≈ 214 MB) | With vectors (S ≈ 4–6 GB, reasoned) |
|---|---|---|
| Sequential scan of old log, parse 1M records | 1.11 s measured | ~20–30 s |
| Write live (80%) log generation | 0.3–1.1 s measured for full write | ~10–25 s |
| Rebuild index (~19–40 MB at 1M) | ~1.1 s measured for 19 MB | ~1–3 s |
| **Primitive subtotal** | **~2.5–3.3 s** | **~31–58 s** |
| **Write amplification** | **~1.1–1.2×** live bytes (≈1.4–1.5× counting 20% dead), ×2 if WAL mirrored | same ratios |

**Comparison:** a full rewrite is the same algorithmic shape in both designs — one read pass + one write pass — so the wall-clock gain from a second file at compaction time is **not decisive** (same order of magnitude, ~2.7 s vs ~2.5–3.3 s on the measured 214 MB case). The decisive gain is eliminating the **~10⁶× per-append WA** and the O(n) parse on every store. That is a layout-internal change (append records + append index in one file), not a reason to split the artifact.

External sanity check: RocksDB's 20–30× leveled WA and 1× FIFO WA bracket the range; the current JSON store at ~10⁶× per append is far outside the LSM envelope, which is why the append path — not the compaction path — is the real emergency.

## Why a two-file design is not warranted in v0.1

1. **It does not buy the thing the ticket asks about.** Full-rewrite WA is ~2× (JSON) vs ~1.1× (log+index) *at best*; the ~1M× WA problem is in the daily append path, and one file with an appended index section solves it.
2. **It breaks the format's first constraint.** Prior research sets "one file: move it, pin it, encrypt it, ship it" as constraint #1. Two files need two BLAKE3s in the golden vectors, an ordering rule, and an atomic pair-swap protocol; a format with 20 byte-exact vectors should not double its conformance surface before v0.2.
3. **It pulls deferred sections into scope.** Reliable two-file compaction normally wants tombstones and version metadata; the map explicitly leaves `TOMBSTONES` (and eight other sections) undefined in v0.1. Whole-file copy generation needs none of them.
4. **Hardware mapping stays intact.** A memory engine reads sections at known offsets; section boundaries inside one mmap-able artifact are addressable. A second artifact requires a second mapping and a join the opcode set does not define.
5. **The spec, not the file count, carries the guarantee.** Compaction must be specified as a deterministic whole-file generation: canonical record order, padding/zero-fill, index rebuild, chain checkpoint, Bloom rebuild. Once that is pinned by vectors, the physical file count is an implementation detail.

## Consequences for the four in-scope sections

| Section | What this decision requires the v0.1 spec to say |
|---|---|
| `ENTRY_INDEX` | Define appended index records (ID hash → file offset/length) inside the single file, plus the rule for finding the newest index state after appends and after a compaction generation. No in-place index mutation, no sidecar index file. Pin record order, alignment and zero-fill so the index bytes are reproducible. |
| `VECTOR_BLOCK` | Compaction copies vector bytes **verbatim**: no re-Embedding, no re-quantization, no dtype change. Byte-exactness of f32/f16/i8 blocks (and their alignment padding) must survive a generation swap. |
| `ENGRAM_CHAIN` | `prev_entry_hash` links must remain verifiable after a generation swap. Define a deterministic compaction checkpoint record/flag that marks the new generation head without rewriting historical hashes, and state whether chain verification restarts at the checkpoint or walks into the previous generation (which would violate one-file portability). Recommendation: self-contained new chain with a checkpoint whose digest commits to the prior generation's head, so a moved single file still verifies alone. |
| `BLOOM` | Rebuild from the live set only, with a fixed hash/seed/bit-order and deterministic input order; pin the exact bytes. A stale Bloom from the pre-compaction generation must not leak into the new file. |

## Consequences for the conformance vectors

- Keep the count at **20 byte-exact vectors with expected BLAKE3**; add a **pre-compaction → post-compaction pair** to the coverage matrix (same logical input, dead entries dropped), plus at least one case exercising a chain checkpoint and one index/Bloom rebuild after appends. If a vector set cannot show the compaction output, the determinism claim is untestable.
- The independent reader written from the spec must be able to read a compacted generation **without any second file or delta log** — that is a concrete acceptance test for the single-file decision.
- Determinism rules called out in the map (float formatting, map order, zero-fill, padding) become mandatory for compaction output, because a full rewrite is where incidental ordering would otherwise appear.
- Sections other than these four stay named/reserved; compaction must not require `TOMBSTONES`, `EXT` or any other v0.2 section bytes.
- Do **not** add a "1M-entry golden vector" to the conformance set. The vectors prove byte layout, not performance; a large perf fixture belongs in a separately run benchmark once an implementation exists.

## What would change this decision

A second file would be worth revisiting only if a measured implementation shows that (a) in-file appended index records cannot keep recall-critical lookup within the v0.1 opcode budget, or (b) compaction must be incremental rather than whole-file (i.e. rewrites must be avoided entirely at 1M+). Neither is established by this research; both are v0.2 questions.

## Sources

- Ticket: https://github.com/Sandeeprdy1729/timps/issues/64; map: https://github.com/Sandeeprdy1729/timps/issues/62
- Root `GLOSSARY.md` (vocabulary); `AGENTS.md` Phase 4c (compaction design); `AUDIT-TRACKER.md` H60 (benchmark-fraud cleanup)
- Local prior research (gitignored, read-only): `/Users/sandeepreddy/Desktop/testbot/research/tmem/TMEM-FORMAT-AND-HARDWARE-RESEARCH.md`, especially §1, §4.1–4.4, §11 question 2
- Tracked code at `e558abed`: `packages/memory-core/src/storage.ts`, `src/backends/FileBackend.ts`, `src/MemoryEngine.ts`, `src/compaction/{CompactionPipeline,ClusterEngine,LLMConsolidationEngine,ArchiveBackend,types}.ts`, `benchmark/index.ts`
- RocksDB wiki: https://github.com/facebook/rocksdb/wiki/Leveled-Compaction and https://github.com/facebook/rocksdb/wiki/FIFO-compaction-style
- RocksDB blog (2022-10-31): https://rocksdb.org/blog/2022/10/31/align-compaction-output-file.html
- SQLite `VACUUM`: https://www.sqlite.org/lang_vacuum.html
