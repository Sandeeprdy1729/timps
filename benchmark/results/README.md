# TIMPS Memory Recall Benchmark

> **Last run:** *(not run yet — see instructions below)*

## Summary

This benchmark measures whether TIMPS 9-layer memory improves LLM recall accuracy on real developer questions compared to a baseline (no memory).

| Metric | Baseline (no memory) | TIMPS (with memory) | Improvement |
|---|---|---|---|
| Recall accuracy | TBD | TBD | TBD |
| Avg precision | TBD | TBD | TBD |
| Avg latency (ms) | TBD | TBD | TBD |
| Avg memory entries used | — | TBD | — |

*Results will be filled in after running the benchmark.*

---

## Methodology

- **50 questions** covering 4 categories: architecture decisions, code patterns, bug history, personal preferences
- **Ground truth** defined as keyword sets — the answer must contain at least 1 keyword to be a "recall hit"
- **Precision score** = fraction of expected keywords present in the answer (0–100%)
- **TIMPS runner** seeds the memory engine with 45 realistic project facts before answering
- **Baseline runner** sends the raw question to the LLM with no context injection

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

1. Run both runners and collect the JSON files from `benchmark/results/`
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
