---
"@timps-ai/memory-core": patch
"@timps-ai/timps-mcp": patch
---

### Fix recall ranking: normalize BM25 scores before confidence calibration

`recall()` passed raw MiniSearch BM25 scores (typically 3–15) to
`ConfidenceCalibrator` as `similarity`, which is weighted as if it were 0–1.
Every candidate clamped to confidence 1.0, so the final order was decided by
floating-point noise in the false-memory risk score and the best match often
ranked last. Similarity is now scaled relative to the top candidate.

Benchmark (`benchmark/index.ts --quick`): Recall@1 0% → 70%, Recall@5 15% → 90%,
MRR 0.08 → 0.77.
