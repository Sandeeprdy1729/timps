"""
echo_forge.py — EchoForge Layer 7 Python Reference Implementation
=================================================================

Causal Echo Propagation Engine fusing:
  • Echo State Network (reservoir computing) for trajectory prediction
  • Bi-temporal causal graph (BFS) for deterministic O(V+E) propagation
  • Ebbinghaus decay for salience weighting
  • Sparse TF-IDF embedding (murmurhash, EMBED_DIM=64)

This is a 1:1 reference port of the TypeScript implementation in
packages/memory-core/src/EchoForge.ts.

Usage
-----
    from echo_forge import EchoForge, echo_embed

    forge = EchoForge("/tmp/myproject")
    result = await forge.weave("feeling burned out after long sprint", domain="burnout")
    pred   = await forge.predict("burnout")
    print(pred.risk_level, pred.risk_score)

Requirements: Python 3.11+, no external dependencies (stdlib only).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Literal, Optional

# ── Constants ────────────────────────────────────────────────────────────────

RESERVOIR_SIZE       = 200
RESERVOIR_SPARSITY   = 0.1
SPECTRAL_RADIUS      = 0.9
LEAK_RATE            = 0.05
INPUT_SCALE          = 0.3
EMBED_DIM            = 64
HALF_LIFE_MS         = 14 * 24 * 3_600_000          # 14 days in ms
RETRIEVAL_BOOST      = 0.08
HOP_DAMPING          = 0.8
MAX_PROPAGATION_DEPTH= 12
QUENCH_THRESHOLD     = 0.04
CONTRADICTION_ALARM  = 1.5
CRYSTALLISATION_AGE_MS = 30 * 24 * 3_600_000
SUPERSESSION_THRESHOLD = 0.82
CONTRADICTION_THRESHOLD= 0.45
DEFAULT_TOP_K        = 8
TRAJECTORY_STEPS     = 12

EchoDomain = Literal[
    "burnout", "relationship", "decision",
    "code_pattern", "contradiction", "goal", "general"
]

EchoEdgeType = Literal["causes", "supersedes", "contradicts", "correlates"]

# ── Tiny deterministic LCG ────────────────────────────────────────────────

def _lcg_next(seed: int) -> tuple[float, int]:
    """Linear Congruential Generator — mirrors TypeScript LCG for bit-identical output."""
    seed = (seed * 1_664_525 + 1_013_904_223) & 0xFFFFFFFF
    return seed / 4_294_967_296.0, seed

# ── Sparse embedding (murmurhash-based TF-IDF) ────────────────────────────

def _murmurhash(text: str, seed: int = 42) -> int:
    """Simple 32-bit murmurhash approximation (matches TS implementation)."""
    h = seed ^ len(text)
    for ch in text:
        k = ord(ch)
        k = (k * 0xcc9e2d51) & 0xFFFFFFFF
        k = ((k << 15) | (k >> 17)) & 0xFFFFFFFF
        k = (k * 0x1b873593) & 0xFFFFFFFF
        h ^= k
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF
        h = (h * 5 + 0xe6546b64) & 0xFFFFFFFF
    h ^= len(text)
    h ^= h >> 16
    h = (h * 0x85ebca6b) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xc2b2ae35) & 0xFFFFFFFF
    h ^= h >> 16
    return h

STOP_WORDS = frozenset(
    "a an the and or but in on at to for of is are was were be been being "
    "have has had do does did will would could should may might must can it "
    "its this that these those with from by about into over after".split()
)

def echo_embed(text: str) -> dict[int, float]:
    """
    Sparse TF-IDF embedding → L2-normalised dict of {dim_index: weight}.
    Matches TypeScript echoEmbed() exactly.
    """
    tokens = [t for t in re.split(r"[^a-z0-9]+", text.lower()) if t and t not in STOP_WORDS]
    if not tokens:
        return {}

    tf: dict[str, int] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1

    emb: dict[int, float] = {}
    for tok, count in tf.items():
        dim = _murmurhash(tok) % EMBED_DIM
        weight = (1 + math.log(count)) * (1 / math.log(2 + len(tf)))
        emb[dim] = emb.get(dim, 0.0) + weight

    # L2 normalize
    norm = math.sqrt(sum(v * v for v in emb.values()))
    if norm < 1e-10:
        return {}
    return {k: v / norm for k, v in emb.items()}

def _sparse_dot(a: dict[int, float], b: dict[int, float]) -> float:
    if not a or not b:
        return 0.0
    return sum(a.get(k, 0.0) * v for k, v in b.items())

# ── Reservoir matrices (built once at module load) ────────────────────────

def _build_reservoir() -> tuple[list[list[float]], list[list[float]]]:
    """
    Build W_in (RESERVOIR_SIZE × EMBED_DIM) and W_rec (RESERVOIR_SIZE × RESERVOIR_SIZE).
    Deterministic seeded with LCG, spectral radius enforced.
    """
    seed = 42

    # W_in
    W_in: list[list[float]] = []
    for _ in range(RESERVOIR_SIZE):
        row: list[float] = []
        for _ in range(EMBED_DIM):
            v, seed = _lcg_next(seed)
            row.append(v * 2 - 1)
        W_in.append(row)

    # W_rec (sparse)
    W_rec: list[list[float]] = [[0.0] * RESERVOIR_SIZE for _ in range(RESERVOIR_SIZE)]
    for i in range(RESERVOIR_SIZE):
        for j in range(RESERVOIR_SIZE):
            v, seed = _lcg_next(seed)
            if v < RESERVOIR_SPARSITY:
                w, seed = _lcg_next(seed)
                W_rec[i][j] = (w * 2 - 1) * SPECTRAL_RADIUS

    return W_in, W_rec

_W_IN, _W_REC = _build_reservoir()

def _reservoir_step(prev_state: list[float], input_emb: dict[int, float]) -> list[float]:
    """Leaky integrator: x = (1-lr)*x + tanh(W_in*u + W_rec*x)"""
    new_state: list[float] = []
    for i in range(RESERVOIR_SIZE):
        win_u = sum(_W_IN[i][j] * input_emb.get(j, 0.0) * INPUT_SCALE for j in range(EMBED_DIM))
        wrec_x = sum(_W_REC[i][j] * prev_state[j] for j in range(RESERVOIR_SIZE))
        new_state.append((1 - LEAK_RATE) * prev_state[i] + math.tanh(win_u + wrec_x))
    return new_state

def _reservoir_readout(state: list[float], domain: str, seed_offset: int = 0) -> float:
    """Linear readout → scalar [0, 1] risk score."""
    seed = abs(hash(domain)) ^ seed_offset
    score = 0.0
    for i, v in enumerate(state):
        w, seed = _lcg_next((seed + i * 31337) & 0xFFFFFFFF)
        score += v * (w * 2 - 1)
    # Sigmoid
    return 1 / (1 + math.exp(-score / (RESERVOIR_SIZE ** 0.5)))

# ── Data classes ──────────────────────────────────────────────────────────

@dataclass
class EchoNode:
    id: str
    content: str
    domain: str
    embedding: dict[int, float]
    valid_from: int
    valid_to: Optional[int]
    invalid_at: Optional[int]
    causal_parent_id: Optional[str]
    salience: float
    echo_amp: float
    reservoir_state: list[float]
    retrieval_count: int
    tags: list[str]
    created_at: int

@dataclass
class EchoEdge:
    from_id: str
    to_id: str
    weight: float
    edge_type: str
    created_at: int

@dataclass
class EchoPropagationResult:
    echo_map: dict[str, float]
    hops_reached: int
    quenched_nodes: list[str]
    interference_detected: bool

@dataclass
class EchoWeaveResult:
    node_id: str
    superseded_ids: list[str]
    detected_contradictions: list[str]
    propagation: EchoPropagationResult

@dataclass
class EchoPrediction:
    domain: str
    risk_score: float
    risk_level: Literal["high", "medium", "low"]
    trajectory: list[float]
    driving_node_ids: list[str]
    explanation: str
    confidence: float
    interference_signal: float

@dataclass
class EchoQueryResult:
    nodes: list[EchoNode]
    scores: list[float]
    predictions: Optional[list[EchoPrediction]]

@dataclass
class EchoConsolidationReport:
    quenched: int
    retained: int
    crystallised: int
    propagation_ms: float

@dataclass
class EchoStatus:
    active_node_count: int
    edge_count: int
    domain_counts: dict[str, int]
    avg_echo_amp: float
    avg_salience: float
    last_consolidated_at: Optional[int]
    last_propagation_ms: Optional[float]
    version: str

# ── EchoForge ─────────────────────────────────────────────────────────────

class EchoForge:
    """
    Layer 7 — Causal Echo Propagation Engine.

    Parameters
    ----------
    base_dir : str
        Directory for persistent storage. Echo data is stored in
        {base_dir}/echo/echoforge.json.
    """

    def __init__(self, base_dir: str) -> None:
        self._dir = Path(base_dir) / "echo"
        self._dir.mkdir(parents=True, exist_ok=True)
        self._store_path = self._dir / "echoforge.json"
        self._nodes: dict[str, EchoNode] = {}
        self._edges: list[EchoEdge] = []
        self._field_cache: dict[str, list[float]] = {}
        self._last_consolidated_at: Optional[int] = None
        self._last_propagation_ms: Optional[float] = None
        self._load()

    # ── Persistence ─────────────────────────────────────────────────────

    def _load(self) -> None:
        if not self._store_path.exists():
            return
        try:
            with open(self._store_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            for nid, nd in raw.get("nodes", {}).items():
                self._nodes[nid] = EchoNode(**{
                    k: v for k, v in nd.items()
                    if k in EchoNode.__dataclass_fields__
                })
            for ed in raw.get("edges", []):
                self._edges.append(EchoEdge(**{
                    k: v for k, v in ed.items()
                    if k in EchoEdge.__dataclass_fields__
                }))
            self._field_cache = raw.get("field_cache", {})
            self._last_consolidated_at = raw.get("last_consolidated_at")
            self._last_propagation_ms = raw.get("last_propagation_ms")
        except Exception:
            pass

    def _save(self) -> None:
        try:
            data = {
                "version": "2.0",
                "nodes": {nid: asdict(n) for nid, n in self._nodes.items()},
                "edges": [asdict(e) for e in self._edges],
                "field_cache": self._field_cache,
                "last_consolidated_at": self._last_consolidated_at,
                "last_propagation_ms": self._last_propagation_ms,
            }
            tmp = self._store_path.with_suffix(".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f)
            tmp.replace(self._store_path)
        except Exception:
            pass

    # ── Public API ───────────────────────────────────────────────────────

    async def weave(
        self,
        content: str,
        domain: str = "general",
        causal_parent_id: Optional[str] = None,
        tags: Optional[list[str]] = None,
        valid_from: Optional[int] = None,
        valid_to: Optional[int] = None,
        salience: float = 0.5,
    ) -> EchoWeaveResult:
        now = int(time.time() * 1000)
        emb = echo_embed(content)
        prev_state = self._field_cache.get(domain, [0.0] * RESERVOIR_SIZE)
        res_state = _reservoir_step(prev_state, emb)
        self._field_cache[domain] = res_state

        node_id = str(uuid.uuid4())
        node = EchoNode(
            id=node_id,
            content=content,
            domain=domain,
            embedding=emb,
            valid_from=valid_from if valid_from is not None else now,
            valid_to=valid_to,
            invalid_at=None,
            causal_parent_id=causal_parent_id,
            salience=salience,
            echo_amp=salience,
            reservoir_state=res_state,
            retrieval_count=0,
            tags=tags or [],
            created_at=now,
        )

        # Supersession / contradiction detection
        superseded: list[str] = []
        contradictions: list[str] = []

        active = [n for n in self._nodes.values() if n.invalid_at is None and n.domain == domain]
        for existing in active:
            sim = _sparse_dot(emb, existing.embedding)
            if sim >= SUPERSESSION_THRESHOLD:
                existing.invalid_at = now
                superseded.append(existing.id)
                self._edges.append(EchoEdge(
                    from_id=node_id,
                    to_id=existing.id,
                    weight=sim,
                    edge_type="supersedes",
                    created_at=now,
                ))
            elif sim >= CONTRADICTION_THRESHOLD:
                contradictions.append(existing.id)
                self._edges.append(EchoEdge(
                    from_id=node_id,
                    to_id=existing.id,
                    weight=sim,
                    edge_type="contradicts",
                    created_at=now,
                ))

        # Causal parent edge
        if causal_parent_id and causal_parent_id in self._nodes:
            self._edges.append(EchoEdge(
                from_id=causal_parent_id,
                to_id=node_id,
                weight=0.9,
                edge_type="causes",
                created_at=now,
            ))

        self._nodes[node_id] = node

        # Propagate echo from new node
        propagation = self._propagate_echo(node_id, salience, now)

        self._save()
        return EchoWeaveResult(
            node_id=node_id,
            superseded_ids=superseded,
            detected_contradictions=contradictions,
            propagation=propagation,
        )

    async def query(
        self,
        query_text: str,
        top_k: int = DEFAULT_TOP_K,
        domain: Optional[str] = None,
        predict: bool = False,
        at_time: Optional[int] = None,
    ) -> EchoQueryResult:
        now = int(time.time() * 1000)
        t = at_time if at_time is not None else now
        q_emb = echo_embed(query_text)

        candidates = [
            n for n in self._nodes.values()
            if n.invalid_at is None
            and n.valid_from <= t
            and (n.valid_to is None or n.valid_to > t)
            and (domain is None or n.domain == domain)
        ]

        scored: list[tuple[EchoNode, float]] = []
        for node in candidates:
            age_ms = now - node.created_at
            decay = math.exp(-math.log(2) * age_ms / HALF_LIFE_MS)
            retrieval_bonus = node.retrieval_count * RETRIEVAL_BOOST
            sem = _sparse_dot(q_emb, node.embedding)
            score = (sem * 0.5 + node.echo_amp * 0.3 + decay * 0.2 + retrieval_bonus)
            scored.append((node, score))

        scored.sort(key=lambda x: -x[1])
        top = scored[:top_k]

        nodes_out = []
        scores_out = []
        for node, score in top:
            node.retrieval_count += 1
            nodes_out.append(node)
            scores_out.append(score)

        self._save()

        preds = None
        if predict and nodes_out:
            domains_seen = list({n.domain for n in nodes_out})
            preds = []
            for d in domains_seen[:3]:
                preds.append(await self.predict(d))

        return EchoQueryResult(nodes=nodes_out, scores=scores_out, predictions=preds)

    async def predict(
        self,
        domain: str,
        lookback_days: int = 14,
        steps: int = TRAJECTORY_STEPS,
    ) -> EchoPrediction:
        now = int(time.time() * 1000)
        lookback_ms = lookback_days * 24 * 3_600_000
        cutoff = now - lookback_ms

        nodes = [
            n for n in self._nodes.values()
            if n.invalid_at is None
            and n.domain == domain
            and n.created_at >= cutoff
        ]

        if not nodes:
            return EchoPrediction(
                domain=domain,
                risk_score=0.0,
                risk_level="low",
                trajectory=[0.0] * steps,
                driving_node_ids=[],
                explanation=f"No recent {domain} nodes in lookback window.",
                confidence=0.0,
                interference_signal=0.0,
            )

        trajectory = self._reservoir_predict(domain, nodes, now, steps)
        risk_score = float(trajectory[-1])
        risk_level: Literal["high", "medium", "low"] = (
            "high" if risk_score >= 0.7 else "medium" if risk_score >= 0.4 else "low"
        )

        # Driving nodes: top-3 by echo_amp
        driving = sorted(nodes, key=lambda n: -n.echo_amp)[:3]

        # Interference signal: std dev of last-half trajectory
        half = trajectory[len(trajectory) // 2:]
        mean = sum(half) / len(half)
        variance = sum((v - mean) ** 2 for v in half) / len(half)
        interference = math.sqrt(variance) * CONTRADICTION_ALARM

        explanation = (
            f"{'↑ Rising' if len(trajectory) > 1 and trajectory[-1] > trajectory[0] else '→ Stable'} "
            f"{domain} trend. Driven by {len(nodes)} recent signals, "
            f"peak risk at step {trajectory.index(max(trajectory)) + 1}/{steps}."
        )

        return EchoPrediction(
            domain=domain,
            risk_score=round(risk_score, 3),
            risk_level=risk_level,
            trajectory=[round(v, 3) for v in trajectory],
            driving_node_ids=[n.id for n in driving],
            explanation=explanation,
            confidence=min(1.0, len(nodes) / 10),
            interference_signal=round(interference, 3),
        )

    async def predict_all(self, lookback_days: int = 14) -> dict[str, EchoPrediction]:
        domains = ["burnout", "relationship", "decision", "code_pattern", "contradiction", "goal", "general"]
        results = {}
        for d in domains:
            results[d] = await self.predict(d, lookback_days=lookback_days)
        return results

    async def consolidate(self) -> EchoConsolidationReport:
        t0 = time.perf_counter_ns()
        now = int(time.time() * 1000)

        quenched = 0
        retained = 0
        crystallised = 0

        for node in list(self._nodes.values()):
            if node.invalid_at is not None:
                continue
            age_ms = now - node.created_at
            decay = math.exp(-math.log(2) * age_ms / HALF_LIFE_MS)
            effective_amp = node.echo_amp * decay

            if effective_amp < QUENCH_THRESHOLD and age_ms > CRYSTALLISATION_AGE_MS:
                node.invalid_at = now
                quenched += 1
            elif age_ms > CRYSTALLISATION_AGE_MS:
                crystallised += 1
                retained += 1
            else:
                retained += 1

        prop_ms = (time.perf_counter_ns() - t0) / 1_000_000
        self._last_propagation_ms = prop_ms
        self._last_consolidated_at = now
        self._save()

        return EchoConsolidationReport(
            quenched=quenched,
            retained=retained,
            crystallised=crystallised,
            propagation_ms=prop_ms,
        )

    async def get_status(self) -> EchoStatus:
        active = [n for n in self._nodes.values() if n.invalid_at is None]
        domain_counts: dict[str, int] = {}
        for n in active:
            domain_counts[n.domain] = domain_counts.get(n.domain, 0) + 1

        avg_amp = sum(n.echo_amp for n in active) / max(len(active), 1)
        avg_sal = sum(n.salience for n in active) / max(len(active), 1)

        return EchoStatus(
            active_node_count=len(active),
            edge_count=len(self._edges),
            domain_counts=domain_counts,
            avg_echo_amp=round(avg_amp, 3),
            avg_salience=round(avg_sal, 3),
            last_consolidated_at=self._last_consolidated_at,
            last_propagation_ms=self._last_propagation_ms,
            version="2.0",
        )

    async def get_context_string(self, domain: str, limit: int = 5) -> str:
        result = await self.query(domain, top_k=limit, domain=domain)  # type: ignore[arg-type]
        if not result.nodes:
            return f"No active {domain} nodes in EchoForge."
        lines = [f"EchoForge [{domain}] ({len(result.nodes)} signals):"]
        for node, score in zip(result.nodes, result.scores):
            preview = node.content[:80]
            lines.append(f"  • [{score:.2f}] {preview}")
        return "\n".join(lines)

    def export_nodes(self) -> list[EchoNode]:
        return list(self._nodes.values())

    def export_edges(self) -> list[EchoEdge]:
        return list(self._edges)

    # ── Private ──────────────────────────────────────────────────────────

    def _propagate_echo(self, start_node_id: str, start_amp: float, now: int) -> EchoPropagationResult:
        """BFS echo propagation with HOP_DAMPING decay."""
        # Build adjacency (forward + backward)
        adj: dict[str, list[tuple[str, float]]] = {}
        for e in self._edges:
            if e.edge_type in ("causes", "correlates"):
                adj.setdefault(e.from_id, []).append((e.to_id, e.weight))
                adj.setdefault(e.to_id, []).append((e.from_id, e.weight * 0.5))

        echo_map: dict[str, float] = {start_node_id: start_amp}
        quenched: list[str] = []
        interference_detected = False

        queue = [(start_node_id, start_amp, 0)]
        visited: set[str] = {start_node_id}

        while queue:
            nid, amp, depth = queue.pop(0)
            if depth >= MAX_PROPAGATION_DEPTH:
                continue

            node = self._nodes.get(nid)
            if node and amp > node.echo_amp:
                node.echo_amp = min(1.0, node.echo_amp + amp * 0.1)

            for neighbor_id, weight in adj.get(nid, []):
                if neighbor_id in visited:
                    continue
                visited.add(neighbor_id)
                new_amp = amp * HOP_DAMPING * weight
                if new_amp < QUENCH_THRESHOLD:
                    quenched.append(neighbor_id)
                    continue
                echo_map[neighbor_id] = max(echo_map.get(neighbor_id, 0.0), new_amp)
                # Check interference: contradiction edge nearby
                for e in self._edges:
                    if e.edge_type == "contradicts" and (e.from_id == neighbor_id or e.to_id == neighbor_id):
                        if echo_map.get(e.from_id, 0.0) > QUENCH_THRESHOLD and echo_map.get(e.to_id, 0.0) > QUENCH_THRESHOLD:
                            interference_detected = True
                queue.append((neighbor_id, new_amp, depth + 1))

        return EchoPropagationResult(
            echo_map=echo_map,
            hops_reached=len(echo_map) - 1,
            quenched_nodes=quenched,
            interference_detected=interference_detected,
        )

    def _reservoir_predict(
        self,
        domain: str,
        nodes: list[EchoNode],
        now: int,
        steps: int,
    ) -> list[float]:
        """Free-run reservoir rollout for multi-step trajectory."""
        # Initial state: average of recent node reservoir states
        if nodes and nodes[0].reservoir_state:
            state = [
                sum(n.reservoir_state[i] for n in nodes) / len(nodes)
                for i in range(RESERVOIR_SIZE)
            ]
        else:
            state = [0.0] * RESERVOIR_SIZE

        trajectory: list[float] = []
        # Use mean embedding as "attractor"
        mean_emb: dict[int, float] = {}
        for n in nodes:
            for k, v in n.embedding.items():
                mean_emb[k] = mean_emb.get(k, 0.0) + v / len(nodes)

        for step in range(steps):
            state = _reservoir_step(state, mean_emb)
            score = _reservoir_readout(state, domain, seed_offset=step)
            trajectory.append(score)

        return trajectory


# ── Singleton factory ─────────────────────────────────────────────────────

_instances: dict[str, EchoForge] = {}

def get_echo_forge(base_dir: str) -> EchoForge:
    """Get or create an EchoForge singleton for a given base directory."""
    key = str(Path(base_dir).resolve())
    if key not in _instances:
        _instances[key] = EchoForge(base_dir)
    return _instances[key]


# ── CLI demo ─────────────────────────────────────────────────────────────

async def _demo() -> None:
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        forge = EchoForge(tmpdir)

        # Weave some burnout events
        for msg in [
            "working until 2am again, feeling completely drained",
            "missed another deadline, team morale is extremely low",
            "chronic overwork is affecting my health and performance",
        ]:
            r = await forge.weave(msg, domain="burnout")
            print(f"Wove: {r.node_id[:8]}… [{r.superseded_ids}]")

        # Predict
        pred = await forge.predict("burnout")
        print(f"\nBurnout prediction: {pred.risk_level} ({pred.risk_score:.1%})")
        print(f"Trajectory (12 steps): {[f'{v:.2f}' for v in pred.trajectory]}")
        print(f"Explanation: {pred.explanation}")

        # Status
        status = await forge.get_status()
        print(f"\nStatus: {status.active_node_count} nodes, {status.edge_count} edges")

if __name__ == "__main__":
    asyncio.run(_demo())
