#!/usr/bin/env python3
"""
TIMPS Eval Harness — Python Reference Implementation

Runs standardized eval datasets against any memory system that
implements the MemorySystemAdapter interface.

Usage:
    python run_eval.py --all
    python run_eval.py --dataset multi-layer-recall
    python run_eval.py --dataset adversarial-contradictions --json results.json
"""

import json
import os
import sys
import time
import argparse
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


DATASETS_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', 'packages', 'memory-core', 'evals', 'datasets'
)

DATASET_NAMES = [
    'multi-layer-recall',
    'adversarial-contradictions',
    'long-context-retrieval',
    'temporal-ordering',
    'multi-agent-consistency',
]


class MemorySystemAdapter(ABC):
    """Implement this interface to evaluate your memory system."""

    @abstractmethod
    def store(self, memory: str, tags: List[str] = None) -> None:
        pass

    @abstractmethod
    def recall(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete(self, memory_id: str) -> None:
        pass

    @abstractmethod
    def clear(self) -> None:
        pass


class EvalExample:
    def __init__(self, data: dict):
        self.query = data['query']
        self.expected_memories = data['expectedMemories']
        self.context = data.get('context', '')


class EvalDataset:
    def __init__(self, data: dict):
        self.name = data['name']
        self.version = data['version']
        self.description = data['description']
        self.examples = [EvalExample(ex) for ex in data['examples']]


def load_dataset(name: str) -> Optional[EvalDataset]:
    filepath = os.path.join(DATASETS_DIR, f'{name}.json')
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r') as f:
        return EvalDataset(json.load(f))


def load_all_datasets() -> List[EvalDataset]:
    datasets = []
    for name in DATASET_NAMES:
        ds = load_dataset(name)
        if ds:
            datasets.append(ds)
    return datasets


def evaluate(
    adapter: MemorySystemAdapter,
    dataset: EvalDataset,
) -> dict:
    """Run evaluation on a single dataset."""
    per_example = []
    latencies = []

    for example in dataset.examples:
        # Store expected memories
        for memory in example.expected_memories:
            adapter.store(memory, tags=[dataset.name, example.context or 'general'])

    for example in dataset.examples:
        t0 = time.monotonic()
        results = adapter.recall(example.query, top_k=10)
        latency_ms = (time.monotonic() - t0) * 1000
        latencies.append(latency_ms)

        found_contents = [r.get('content', '') for r in results]
        rank = -1
        for i, fc in enumerate(found_contents):
            if any(em[:40] in fc for em in example.expected_memories):
                rank = i
                break

        matched = sum(
            1 for em in example.expected_memories
            if any(em[:40] in fc for fc in found_contents)
        )

        per_example.append({
            'query': example.query,
            'recallAt5': 0 <= rank < 5,
            'recallAt10': rank >= 0,
            'mrr': 1.0 / (rank + 1) if rank >= 0 else 0.0,
            'latencyMs': round(latency_ms, 2),
            'expectedCount': len(example.expected_memories),
            'foundCount': matched,
        })

        # Clear for next example
        adapter.clear()

    total = len(per_example)
    passed = sum(1 for p in per_example if p['recallAt5'])
    sorted_latencies = sorted(latencies)

    def percentile(data, p):
        idx = int(len(data) * p / 100)
        return data[min(idx, len(data) - 1)]

    return {
        'datasetName': dataset.name,
        'metrics': [
            {'name': 'recall@5', 'value': round((passed / total) * 100, 2) if total > 0 else 0, 'unit': '%'},
            {'name': 'recall@10', 'value': round((sum(1 for p in per_example if p['recallAt10']) / total) * 100, 2) if total > 0 else 0, 'unit': '%'},
            {'name': 'mrr', 'value': round(sum(p['mrr'] for p in per_example) / total, 4) if total > 0 else 0, 'unit': ''},
            {'name': 'latency_p50', 'value': round(percentile(sorted_latencies, 50), 2), 'unit': 'ms'},
            {'name': 'latency_p95', 'value': round(percentile(sorted_latencies, 95), 2), 'unit': 'ms'},
            {'name': 'latency_p99', 'value': round(percentile(sorted_latencies, 99), 2), 'unit': 'ms'},
        ],
        'perExample': per_example,
        'summary': {
            'totalExamples': total,
            'passed': passed,
            'failed': total - passed,
            'avgRecallAt5': round((passed / total) * 100, 2) if total > 0 else 0,
            'avgLatencyMs': round(sum(latencies) / len(latencies), 2) if latencies else 0,
        },
    }


class SimpleDictAdapter(MemorySystemAdapter):
    """Toy in-memory adapter for testing the harness."""

    def __init__(self):
        self.memories = {}

    def store(self, memory: str, tags: List[str] = None) -> None:
        mid = f'mem_{len(self.memories)}'
        self.memories[mid] = {'content': memory, 'tags': tags or []}

    def recall(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        query_lower = query.lower()
        scored = []
        for mid, mem in self.memories.items():
            content_lower = mem['content'].lower()
            score = sum(1 for word in query_lower.split() if word in content_lower)
            if score > 0:
                scored.append({'id': mid, 'content': mem['content'], 'score': score})
        scored.sort(key=lambda x: x['score'], reverse=True)
        return scored[:top_k]

    def delete(self, memory_id: str) -> None:
        self.memories.pop(memory_id, None)

    def clear(self) -> None:
        self.memories.clear()


def main():
    parser = argparse.ArgumentParser(description='TIMPS Eval Harness')
    parser.add_argument('--all', action='store_true', help='Run all datasets')
    parser.add_argument('--dataset', type=str, help='Specific dataset to run')
    parser.add_argument('--adapter', type=str, help='Path to adapter Python file')
    parser.add_argument('--json', type=str, help='Output file for JSON results')
    args = parser.parse_args()

    if args.adapter:
        import importlib.util
        spec = importlib.util.spec_from_file_location('adapter', args.adapter)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        adapter = mod.create_adapter()
    else:
        print('Using built-in SimpleDictAdapter (for testing only).')
        print('Pass --adapter <path> to use your own memory system implementation.\n')
        adapter = SimpleDictAdapter()

    if args.dataset:
        datasets = [load_dataset(args.dataset)]
        if not datasets[0]:
            print(f'Dataset not found: {args.dataset}')
            sys.exit(1)
    elif args.all:
        datasets = load_all_datasets()
    else:
        print('Specify --all or --dataset <name>')
        sys.exit(1)

    results = []
    for dataset in datasets:
        print(f'Running: {dataset.name} ({dataset.description})')
        t0 = time.monotonic()
        result = evaluate(adapter, dataset)
        elapsed = time.monotonic() - t0
        print(f'  Recall@5: {result["summary"]["avgRecallAt5"]}%')
        print(f'  Passed:   {result["summary"]["passed"]}/{result["summary"]["totalExamples"]}')
        print(f'  Time:     {elapsed:.2f}s')
        print()
        results.append(result)

    if args.json:
        with open(args.json, 'w') as f:
            json.dump({'results': results, 'timestamp': time.time()}, f, indent=2)
        print(f'Results written to: {args.json}')


if __name__ == '__main__':
    main()
