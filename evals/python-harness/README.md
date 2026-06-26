# TIMPS Eval Harness — Python Reference Implementation

This is the **language-agnostic benchmark harness** for the AI Memory Systems Arena
(Phase 3c of the TIMPS Intelligence Platform). Any memory system can implement the
`MemorySystemAdapter` interface below and run the standardized eval datasets.

## Quick Start

```bash
pip install -r requirements.txt
python run_eval.py --dataset multi-layer-recall --adapter my_adapter.py
```

## Adapter Interface

Implement this interface in your memory system:

```python
from typing import List, Dict, Any
from abc import ABC, abstractmethod

class MemorySystemAdapter(ABC):
    @abstractmethod
    def store(self, memory: str, tags: List[str] = None) -> None:
        """Store a memory entry."""
        pass

    @abstractmethod
    def recall(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """Recall memories matching the query. Returns list of {content, score}."""
        pass

    @abstractmethod
    def delete(self, memory_id: str) -> None:
        """Delete a memory by ID."""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Clear all memories."""
        pass
```

## Datasets

The standardized datasets are in `packages/memory-core/evals/datasets/`:

| Dataset | Description |
|---------|-------------|
| multi-layer-recall | Tests recall across 22 memory layer types |
| adversarial-contradictions | Tests contradiction detection |
| long-context-retrieval | Tests recall at 10K+ entries |
| temporal-ordering | Tests time-dependent relevance |
| multi-agent-consistency | Tests CRDT merge correctness |

## Metrics

| Metric | Description |
|--------|-------------|
| recall@5 | Percentage of queries where expected memory is in top 5 |
| recall@10 | Percentage of queries where expected memory is in top 10 |
| MRR | Mean Reciprocal Rank |
| latency p50/p95/p99 | Recall latency percentiles |

## Submitting to the Arena

1. Implement `MemorySystemAdapter` for your system
2. Run `python run_eval.py --all --json results.json`
3. Submit results at `https://timps-arena.dev/submit` (coming soon)

## License

MIT
