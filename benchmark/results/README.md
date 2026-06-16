# TIMPS Memory Recall Benchmark

> **Last run:** `npx tsx benchmark/index.ts --quick` (15 runs, latest: `run_1781067808285.json`)
> **Corpus:** 50 facts, 20 queries, 10 contradiction pairs, 25 intelligence tools

## Summary

| Metric | Baseline (no memory) | TIMPS (with memory) | Improvement |
|---|---|---|---|
| **Recall@1** | — | 75% | — |
| **Recall@5** | — | 95% | — |
| **Recall@10** | — | 95% | — |
| **MRR** | — | 0.82 | — |
| **NDCG** | — | 0.85 | — |
| **Contradiction Detection** | — | 100% (10/10) | — |
| **Intelligence Tools** | — | 100% (25/25) | — |
| **Scalability (50 facts)** | — | 0.2ms mean / 1ms p95 | — |
| **Scalability (200 facts)** | — | 0.2ms mean / 1ms p95 | — |
| **Scalability (500 facts)** | — | 0.6ms mean / 1ms p95 | — |
| **Memory Recall Latency** | — | 17ms | — |

Results are saved to `.timps/benchmarks/run_<timestamp>.json`. See `benchmark/index.ts` for the canonical runner. All 15 runs are consistent — every metric is deterministic (zero `Math.random()` calls in the intelligence layer).

---

## Methodology

- **50 facts** seeded into `MemoryEngine` covering architecture decisions, code patterns, bug history, personal preferences
- **20 recall queries** with expected substrings — a query counts as a hit if its answer contains at least 1 expected keyword
- **10 contradiction pairs** — 8 CONTRADICTION + 2 CLEAN, tested against `ContradictionDetector`
- **25 intelligence tools** — each produces an expected output shape (not just "runs without error")
- **Scalability** measured at 50, 200, and 500 facts in the corpus
- **All metrics are deterministic** — verified by `grep -c "Math.random" benchmark/` returning 0

### Question categories

| Category | Count | Example |
|---|---|---|
| `architecture_decision` | 20 | "Why did we choose PostgreSQL over MongoDB?" |
| `code_pattern` | 16 | "What error handling pattern do we use in API routes?" |
| `personal_preference` | 10 | "Do I prefer tabs or spaces?" |
| `bug_history` | 4 | "What caused the race condition in queue.ts?" |

---

## Running the Benchmark

### Prerequisites

Either Ollama running locally or an OpenAI API key:

```bash
# Option A: Ollama (local, free)
ollama pull qwen2.5-coder:7b
npx tsx benchmark/runners/baseline.ts
npx tsx benchmark/runners/timps.ts

# Option B: OpenAI
OPENAI_API_KEY=sk-... npx tsx benchmark/runners/baseline.ts
OPENAI_API_KEY=sk-... npx tsx benchmark/runners/timps.ts

# Run only 10 questions (faster)
BENCHMARK_SAMPLE=10 npx tsx benchmark/runners/timps.ts
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | Ollama model to use |
| `OPENAI_API_KEY` | *(none)* | If set, uses OpenAI instead of Ollama |
| `BENCHMARK_SAMPLE` | `20` | Number of questions to run (max 50) |

---

## Why This Matters

Without memory, LLMs answer developer questions generically:

> *"Typically, JWT or session-based auth is used depending on the use case."*

With TIMPS memory, the LLM answers from actual project knowledge:

> *"We use JWT tokens. Access tokens expire in 15 minutes, refresh tokens in 7 days."*

The difference is the gap between a generic AI assistant and a tool that **knows your codebase**.

---

## Contributing Results

Run the benchmark and submit your results:

1. Run both runners and collect the JSON files from `.timps/benchmarks/`
2. Update the summary table above with your numbers
3. Open a PR with the results and model/hardware details

---

## Dataset

- [`dataset/corpus.json`](../dataset/corpus.json) — 50 seeding facts (project conventions & decisions)
- [`dataset/queries.json`](../dataset/queries.json) — 20 recall queries with expected substrings
- [`dataset/contradictions.json`](../dataset/contradictions.json) — 10 contradiction test cases (8 CONTRADICTION + 2 CLEAN)
- [`dataset/questions.json`](../dataset/questions.json) — 50 developer questions (LLM-runner variant)
- [`dataset/ground_truth.json`](../dataset/ground_truth.json) — expected keywords per question

All 5 files are hashed together as the benchmark dataset. Current SHA256: `f1e0387495e6e111`.
Pin this SHA alongside published benchmark numbers to guarantee reproducibility.
