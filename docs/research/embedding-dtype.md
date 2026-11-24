# `.tmem` v0.1 — default embedding dtype

**Context pointer:** https://github.com/Sandeeprdy1729/timps/issues/63 (map: https://github.com/Sandeeprdy1729/timps/issues/62)
**Status:** research finding only. No format rollout, implementation, or hardware work is proposed here.
**Date:** 2026-11-24
**Vocabulary** (per `GLOSSARY.md:7-17`): this decision is about the **memory format** (the bytes). A **memory engine** is a device that executes operations over those bytes; **memory chip** (DRAM) is out of scope.

## Decision

**v0.1 defaults to `f16` — IEEE-754 binary16, little-endian, `vector_dtype = 1` in the entry record.**

Rationale in one line: f16 is effectively recall-lossless at both 384 and 768 dimensions (measured R@10 ≥ 0.9985, R@1 = 1.000), halves the `VECTOR_BLOCK` bytes versus f32, and — unlike i8 — needs no scale metadata or rescore path, which is what makes byte-exact golden vectors tractable for the memory format. f32 buys no measurable recall at 2× the bytes; i8 buys another 2× bytes but measurably loses ≈2 R@10 points and adds calibration state that v0.1 does not otherwise define.

### When `f32` is permitted

`f32` (`vector_dtype = 0`) is permitted **only** when at least one of these holds, and it must be declared per entry — never an implicit fallback for ordinary writes:

1. The entry is a conformance vector explicitly named for f32 round-trip (e.g. the `f32-roundtrip` vector required by the coverage matrix in https://github.com/Sandeeprdy1729/timps/issues/69).
2. A source component cannot be represented as a finite binary16 value (|x| > 65504, or a NaN/Inf payload whose canonicalisation would change bytes), or the producer requires preservation of binary16 subnormals bit-for-bit.
3. A migration/audit operation must prove bit-identical reproduction of a legacy JSON `number` vector (the current store emits JS `number[]`, i.e. binary64 — `packages/memory-core/src/embedding/EmbeddingService.ts:57-79`).
4. The consuming memory engine declares no binary16 arithmetic **and** has no conversion path; in that case it must report the downgrade, not silently reinterpret bytes.

### When `i8` is permitted

`i8-quantized` (`vector_dtype = 2`) is permitted **only** when **all** of the following are true:

1. It is explicitly declared per entry and per `VECTOR_BLOCK`; it is never the v0.1 default.
2. The quantisation is fully specified in the bytes: symmetric per-vector scale `s = max(|x|)/127`, `q = round_to_nearest_even(x/s)` clamped to [−127, 127], with `s` stored **out of band** (see layout section). A per-128-dimension block scale is equally acceptable if declared; an undeclared scale is not.
3. Either (a) a full-precision copy (f16 or f32) of the same vector is present in the file or a linked file so top-K can rescore, **or** (b) the writer has measured R@10 loss ≤ 2 percentage points against f32 on the conformance corpus for that embedding model and dimension. Our sweep shows i8 sitting right at that boundary (1.4–2.3 points lost without rescoring), so the burden of proof stays with the writer.
4. The memory engine declares integer dot-product support with accumulation in a ≥32-bit integer and applies the scale **after** accumulation.
5. Dimension ≥ 384. The evidence below covers 384 and 768 only; lower dimensions are untested and must not inherit permission.
6. At least one i8 vector is included in the 20-vector golden set so a third-party reader can be tested on it.

Anything not meeting these conditions is an f16 file.

---

## What the ticket asked for, and what the repo can actually measure

The ticket asks to "benchmark recall quality on the existing `evals/` suites at 384 and 768 dimensions." **No existing suite can answer that question**, for three concrete reasons:

- **No dtype exists in the tracked recall path.** `packages/memory-core/src/types.ts:40-68` (`SearchOptions`) has no dtype field; `packages/memory-core/src/embedding/types.ts:1-18` has only `dimensions: 384`, `model`, `provider`; `EmbeddingService` returns `number[]` (JS binary64) from Ollama/OpenAI (`EmbeddingService.ts:57-79, 81-104, 112-151`). The repository's pre-spec research doc (`research/tmem/TMEM-FORMAT-AND-HARDWARE-RESEARCH.md`, gitignored, §4.4) already sketches `u16 vector_dtype 0=f32, 1=f16, 2=i8-quantized`, but that is a proposal, not code.
- **`evals/` measures CLI prompt assertions, not vector retrieval.** `evals/runner.ts:21-60` defines `expected.contains` / `tool_calls` / `regex`; `evals/suites/memory-accuracy.ts:6-59` asserts strings like `"DB_PASSWORD"` and the `store_memory` tool call. There is no embedding query, corpus, or top-K in any suite. The checked-in run `evals/results/run-1785243777365.json` scores 0.383 and fails because the CLI rejects `--prompt` — those suites are currently broken independently of dtype.
- **The benchmark harness measures BM25, not embeddings.** `benchmark/index.ts:604` prints "Running memory recall (BM25, 20 queries on 50-fact corpus)", and R@5/R@10 at `benchmark/index.ts:524-526, 153-158` come from that BM25 corpus. The hybrid path (`packages/memory-core/src/search/hybridRetriever.ts:34-59, 88-99`) treats Qdrant as one RRF list among BM25 and tag-expansion lists; it never varies vector precision. Qdrant index settings (`AGENTS.md:606, 634`: HNSW `m=32`, `ef_construct=128`, `indexing_threshold=50000`) are fixed and dtype-agnostic.

I therefore did **not** manufacture `evals/` dtype numbers. Instead I ran a controlled, reproducible representation-loss experiment (throwaway script, not committed) and grounded the decision in primary-source vendor docs. The experiment is a *proxy*, not a substitute for a future dtype-aware harness; that harness is a separate piece of work and is deliberately not done here.

---

## Evidence 1 — measured representation-loss recall

Method: NumPy 2.4.6 with BLAS, 20,000 L2-normalised corpus vectors, 200 independent L2-normalised queries, top-K = 10, fixed seed 20261124. Two synthetic distributions: **isotropic** (standard Gaussian per component) and **anisotropic** (dominant shared component + noise, approximating text-embedding anisotropy). Ground truth is exact top-10 cosine under f32. Each dtype is dequantised to f32, renormalised, and scored in f32 — so these numbers isolate **storage representation loss**, not ANN index error and not arithmetic-throughput differences. `i8_both` quantises corpus and query; `i8_query_f32` keeps the query in full precision (the asymmetric case Qdrant recommends).

| Distribution | d | Scheme | R@1 | R@5 | R@10 |
|---|---:|---|---:|---:|---:|
| isotropic | 384 | f32 | 1.000 | 1.000 | 1.000 |
| isotropic | 384 | **f16** | 1.000 | 1.000 | **0.999** |
| isotropic | 384 | i8 (both) | 0.960 | 0.981 | 0.979 |
| isotropic | 384 | i8 (query f32) | 0.960 | 0.983 | 0.983 |
| isotropic | 768 | f32 | 1.000 | 1.000 | 1.000 |
| isotropic | 768 | **f16** | 1.000 | 0.999 | **0.999** |
| isotropic | 768 | i8 (both) | 0.970 | 0.969 | 0.981 |
| isotropic | 768 | i8 (query f32) | 0.980 | 0.979 | 0.987 |
| anisotropic | 384 | f32 | 1.000 | 1.000 | 1.000 |
| anisotropic | 384 | **f16** | 1.000 | 0.999 | **0.999** |
| anisotropic | 384 | i8 (both) | 0.970 | 0.981 | 0.977 |
| anisotropic | 384 | i8 (query f32) | 0.970 | 0.985 | 0.984 |
| anisotropic | 768 | f32 | 1.000 | 1.000 | 1.000 |
| anisotropic | 768 | **f16** | 1.000 | 0.997 | **1.000** |
| anisotropic | 768 | i8 (both) | 0.970 | 0.974 | 0.980 |
| anisotropic | 768 | i8 (query f32) | 0.980 | 0.980 | 0.985 |

Reading: higher dimension slightly *helps* i8 (errors average out: R@10 0.977–0.983 at 384 → 0.980–0.987 at 768), but never closes the ≈1.4–2.3 point gap to f16. f16 stays within 0.15 points of f32 everywhere. Score MAE for f16 was 0–5×10⁻⁶; for i8 (both) up to 1.95×10⁻⁴ on the anisotropic set.

Caveats that must travel with these numbers: synthetic vectors, not nomic-embed-text or text-embedding-3-small outputs (Ollama was not running at `http://localhost:11434` during the research run, and no dtype path exists to produce these vectors); brute-force top-K, not HNSW; representation loss only. Nomic's own table lists recommended Matryoshka sizes 768/512/256/128/64 (MTEB 62.28 at 768, 61.96 at 512) — 384 is this repo's configured default (`embedding/types.ts:14`), not a Nomic-recommended size, so dimension effects and dtype effects must not be conflated.

## Evidence 2 — byte size at 384 and 768

Exact, uncompressed, single vector; `VECTOR_BLOCK` is 64-byte aligned per the pre-spec design (`research/tmem/TMEM-FORMAT-AND-HARDWARE-RESEARCH.md` §4.4):

| d | f32 (4 B/dim) | f16 (2 B/dim) | i8 (1 B/dim) | 1M vectors: f32 / f16 / i8 |
|---:|---:|---:|---:|---|
| 384 | 1,536 B (24 cache lines) | **768 B (12 cache lines)** | 384 B (6 cache lines) | 1.53 GB / 0.77 GB / 0.38 GB |
| 768 | 3,072 B (48 cache lines) | **1,536 B (24 cache lines)** | 768 B (12 cache lines) | 3.07 GB / 1.53 GB / 0.77 GB |

384, 768, 1536 and 3072 are all exact multiples of 64, so f32/f16/i8 vectors at both dimensions need **no per-vector padding**. Inline i8 scale metadata would break that: 384 + 2 = 386 B and 768 + 2 = 770 B round up to 448 B and 832 B (16.7% and 8.3% overhead). The scale must therefore live in a parallel array, out of the aligned vector stride.

## Evidence 3 — top-K scan latency

Measured brute-force scan, 100 queries × 2,000 documents, dequantise-to-f32 + f32 BLAS matmul, 20 timed repeats, milliseconds:

| d | f32 | f16 | i8 |
|---:|---:|---:|---:|
| 384 | 0.209 ms | 0.208 ms | 0.231 ms |
| 768 | 0.445 ms | 0.461 ms | 0.427 ms |

Interpretation, stated plainly: **dtype alone produced no latency win in this harness**, because BLAS scores f32 regardless of storage dtype; the i8 path even pays a dequantisation cost. Doubling 384→768 roughly doubled scan time (~2.1×) for every dtype, confirming the scan is bytes/bandwidth-bound. Real latency gains require native kernels: Qdrant documents a SIMD 8-bit integer comparison path for scalar quantisation (https://qdrant.tech/documentation/guides/quantization/), and Intel documents AVX-512-FP16 as handling twice as many operations per clock as FP32 (https://builders.intel.com/docs/networkbuilders/intel-avx-512-fp16-instruction-set-for-intel-xeon-processor-based-products-technology-guide-1651874188.pdf). Neither advantage is automatic on every memory engine — that is a hardware ADR decision, not a v0.1 memory-format decision — and neither justifies making a lossier dtype the file-format default.

External quality evidence agrees with the direction: Qdrant's `float16` datatype page calls the quality impact "virtually no impact on the quality of vector search" at half the memory (https://qdrant.tech/documentation/manage-data/vectors/); its scalar-quantisation page reports usually <1% error for f32→8-bit but warns that low dimensionality and centred distributions need tuning, and that rescoring reads original vectors and can slow search (https://qdrant.tech/documentation/guides/quantization/). Qdrant also notes `uint8` as a *datatype* is only appropriate when the model already emits 0–255 values — another reason it cannot be a general default. IEEE layouts are unambiguous: binary16 = 1 sign + 5 exponent + 10 mantissa bits, binary32 = 1 + 8 + 23 (https://numpy.org/doc/stable/user/basics.types.html).

---

## Explicit `.tmem` byte-layout implications for v0.1

1. **Field value.** The entry record's `u16 vector_dtype` (prior research doc §4.4) defaults to **1**. Values 0 and 2 remain legal but must be explicitly written, never inferred.
2. **Encoding.** f16 means IEEE-754 binary16, little-endian, canonical `+0 = 0x0000`, canonical quiet NaN `0x7E00`, no signalling NaNs, conversion from producer precision by round-to-nearest-even. Every one of these must be normative text, because v0.1 conformance is byte-exact (map issue #62; determinism ticket #69).
3. **Stride.** `VECTOR_BLOCK` stride = `vector_dim × sizeof(dtype)`; 64-byte aligned, no per-vector padding at 384 or 768 for any of the three dtypes. Only f16 and f32 meet the "zero-copy vectors" design constraint without extra metadata.
4. **i8 metadata is out of band.** Scales go in a parallel per-vector (or per-128-dim-block) array referenced by the section descriptor, not inline. Otherwise the 64-byte alignment that makes SIMD/DMA loads copy-free is lost. The scale array's dtype and rounding rule must be specified before any i8 golden vector can exist.
5. **Digests.** `crc32c` over the entry record and BLAKE3 over sections/header are computed over canonical bytes. f16's fixed conversion rule is what keeps those digests reproducible across Rust, TypeScript and Python writers; i8's scale rule would need the same treatment before it can be in a golden vector.
6. **Golden-vector coverage.** Of the 20 vectors, the default (f16) should carry the majority; at least one f32 round-trip vector and one i8 vector with declared scale are needed so readers are tested on all three legal values. The dtype split itself belongs to issue #69, not this ticket.
7. **Zero-vector fallback.** `EmbeddingService` emits an all-zero vector on provider failure (`EmbeddingService.ts:64-66, 90-93, 128-131`). Zero is exact in all three dtypes; no special case is needed, but the file must still reserve the full stride for it.

## Sources

**Repo / issues (primary):**
- https://github.com/Sandeeprdy1729/timps/issues/63 — this ticket
- https://github.com/Sandeeprdy1729/timps/issues/62 — map, v0.1 scope and conformance rules
- https://github.com/Sandeeprdy1729/timps/issues/69 — downstream determinism/golden-vector ticket this decision constrains
- `GLOSSARY.md:7-17`; `AGENTS.md:582-637` (hybrid retrieval, Qdrant HNSW config)
- `research/tmem/TMEM-FORMAT-AND-HARDWARE-RESEARCH.md` §4.1, §4.3, §4.4, §11 (gitignored, read-only — proposed `vector_dtype` field and the open dtype question)
- `packages/memory-core/src/types.ts:40-68`; `packages/memory-core/src/embedding/types.ts:1-18`; `packages/memory-core/src/embedding/EmbeddingService.ts:57-151`; `packages/memory-core/src/search/hybridRetriever.ts:17-99`
- `benchmark/index.ts:138-158, 524-526, 604`; `evals/runner.ts:21-60, 113-150`; `evals/suites/memory-accuracy.ts:6-59`; `evals/results/run-1785243777365.json`

**External (primary):**
- Qdrant, Vectors — Datatypes (f32 default, f16, uint8): https://qdrant.tech/documentation/manage-data/vectors/
- Qdrant, Quantization (scalar int8 SIMD, <1% error, rescoring, low-dimension cautions): https://qdrant.tech/documentation/guides/quantization/
- Intel, AVX-512 FP16 technology guide: https://builders.intel.com/docs/networkbuilders/intel-avx-512-fp16-instruction-set-for-intel-xeon-processor-based-products-technology-guide-1651874188.pdf
- NumPy, Data types (binary16/binary32 bit layouts): https://numpy.org/doc/stable/user/basics.types.html
- Nomic, nomic-embed-text-v1.5 model card (Matryoshka sizes and MTEB): https://huggingface.co/nomic-ai/nomic-embed-text-v1.5
