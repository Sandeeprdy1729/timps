"""
TIMPs SDK - Python
The heart of AI memory systems

@example
```python
from timps import TIMPs

timps = TIMPs(
    api_key="your-api-key",
    user_id="user_123"
)

# Store a memory
memory = await timps.store(
    "User prefers TypeScript over JavaScript",
    memory_type="preference",
    importance=0.9
)

# Retrieve relevant context
memories = await timps.retrieve("What language does the user prefer?")

# Get pre-assembled context for LLM
context = await timps.assemble_context(task="Write a web app")
```
"""

import asyncio
import hashlib
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Optional
from uuid import uuid4


class MemoryType(Enum):
    FACT = "fact"
    PREFERENCE = "preference"
    GOAL = "goal"
    PATTERN = "pattern"
    ENTITY = "entity"
    RELATIONSHIP = "relationship"


class ContradictionSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Memory:
    id: str
    content: str
    memory_type: MemoryType
    importance: float
    salience: float
    tags: list[str] = field(default_factory=list)
    entity_ids: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class Entity:
    id: str
    name: str
    aliases: list[str] = field(default_factory=list)
    entity_type: str = "unknown"
    facts: list[str] = field(default_factory=list)
    confidence: float = 0.5
    linked_entities: list[str] = field(default_factory=list)


@dataclass
class ContextPacket:
    memories: list[Memory]
    entities: list[Entity]
    relevant_facts: list[str]
    temporal_context: dict
    contradiction_warnings: list[dict]
    assembled_at: datetime = field(default_factory=datetime.now)
    tokens: int = 0


@dataclass
class Contradiction:
    id: str
    contradiction_type: str
    original_claim: str
    new_claim: str
    severity: ContradictionSeverity
    confidence: float
    resolution: str = "pending"


@dataclass
class GarbageCollectionResult:
    memories_pruned: int
    memories_summarized: int
    tokens_freed: int
    essential_facts_extracted: int


class EventEmitter:
    """Simple event emitter for Python"""

    def __init__(self):
        self._listeners: dict[str, list[Callable]] = {}

    def on(self, event: str, listener: Callable):
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(listener)
        return self

    def off(self, event: str, listener: Callable):
        if event in self._listeners:
            self._listeners[event] = [
                l for l in self._listeners[event] if l != listener
            ]
        return self

    def emit(self, event: str, *args, **kwargs):
        if event in self._listeners:
            for listener in self._listeners[event]:
                listener(*args, **kwargs)


class TIMPs:
    """
    TIMPs SDK - The heart of AI memory systems

    Provides:
    - Memory storage with entity resolution
    - Semantic retrieval
    - Context assembly for LLMs
    - Contradiction detection (Truth Engine)
    - Temporal decay and salience
    - Memory garbage collection
    """

    def __init__(
        self,
        api_url: str = "http://localhost:3000",
        api_key: Optional[str] = None,
        user_id: str = "default",
        project_id: Optional[str] = None,
        embedding_model: str = "nomic-embed-text",
        retrieval_limit: int = 10,
        decay_enabled: bool = True,
        entity_resolution: bool = True,
        sync_callback: Optional[Callable] = None,
    ):
        self.config = {
            "api_url": api_url,
            "api_key": api_key,
            "user_id": user_id,
            "project_id": project_id or user_id,
            "embedding_model": embedding_model,
            "retrieval_limit": retrieval_limit,
            "decay_enabled": decay_enabled,
            "entity_resolution": entity_resolution,
        }

        self._memories: dict[str, Memory] = {}
        self._entities: dict[str, Entity] = {}
        self._events = EventEmitter()
        self._sync_callback = sync_callback

    # ─── Core Memory Operations ───────────────────────────────────────────────

    def store(
        self,
        content: str,
        memory_type: MemoryType = MemoryType.FACT,
        importance: float = 0.5,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict] = None,
        link_to_entities: Optional[list[str]] = None,
        decay: Optional[bool] = None,
    ) -> Memory:
        """
        Store a memory with automatic entity resolution and salience calculation
        """
        use_decay = decay if decay is not None else self.config["decay_enabled"]

        memory = Memory(
            id=self._generate_id(),
            content=content,
            memory_type=memory_type,
            importance=importance,
            salience=self._calculate_salience(importance),
            tags=tags or [],
            entity_ids=[],
            metadata=metadata or {},
        )

        # Entity Resolution
        if self.config["entity_resolution"]:
            resolved = self._resolve_entities(content)
            memory.entity_ids = [e.id for e in resolved]

            for entity in resolved:
                self._entities[entity.id] = entity

        # Link explicit entities
        if link_to_entities:
            memory.entity_ids = list(set(memory.entity_ids + link_to_entities))

        # Calculate decay
        if use_decay:
            memory.expires_at = self._calculate_decay_expiry(memory)

        self._memories[memory.id] = memory

        # Emit event
        self._events.emit("memory:stored", memory)

        # Check contradictions
        contradictions = self.detect_contradictions(memory)
        if contradictions:
            self._events.emit(
                "contradiction:detected",
                {"memory": memory, "contradictions": contradictions},
            )

        return memory

    async def store_async(
        self,
        content: str,
        memory_type: MemoryType = MemoryType.FACT,
        importance: float = 0.5,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict] = None,
    ) -> Memory:
        """Async version of store"""
        return self.store(content, memory_type, importance, tags, metadata)

    def retrieve(
        self,
        query: str,
        limit: Optional[int] = None,
        memory_types: Optional[list[MemoryType]] = None,
        entity_ids: Optional[list[str]] = None,
        min_salience: Optional[float] = None,
        include_decayed: bool = False,
    ) -> list[Memory]:
        """
        Retrieve relevant memories using semantic search
        """
        limit = limit or self.config["retrieval_limit"]

        results = []
        query_embedding = self._embed(query)

        for memory in self._memories.values():
            # Filters
            if memory_types and memory.memory_type not in memory_types:
                continue
            if entity_ids and not any(eid in memory.entity_ids for eid in entity_ids):
                continue
            if min_salience and memory.salience < min_salience:
                continue
            if (
                not include_decayed
                and memory.expires_at
                and memory.expires_at < datetime.now()
            ):
                continue

            # Score
            memory_embedding = self._embed(memory.content)
            score = self._cosine_similarity(query_embedding, memory_embedding)

            results.append((memory, score))

        # Sort by score
        results.sort(key=lambda x: x[1], reverse=True)

        return [memory for memory, _ in results[:limit]]

    def assemble_context(
        self,
        task: Optional[str] = None,
        max_tokens: Optional[int] = None,
        include_entity_graph: bool = True,
        include_temporal_context: bool = True,
        include_contradictions: bool = True,
    ) -> ContextPacket:
        """
        Assemble complete context packet for LLM consumption
        This is the "Pre-Inference Routing" - TIMPs prepares context before LLM sees it
        """
        start_time = time.time()

        if task:
            memories = self.retrieve(task, limit=20)
        else:
            memories = [m for m in self._memories.values() if m.salience > 0.3]
            memories.sort(key=lambda m: m.salience, reverse=True)
            memories = memories[:20]

        # Entity resolution
        entity_ids = set()
        for memory in memories:
            entity_ids.update(memory.entity_ids)

        entities = [self._entities[eid] for eid in entity_ids if eid in self._entities]

        # Relevant facts
        relevant_facts = [m.content for m in memories]

        # Temporal context
        now = datetime.now()
        temporal_context = {
            "recent_events": [
                m.content
                for m in memories
                if (now - m.created_at).total_seconds() < 24 * 60 * 60
            ],
            "upcoming_goals": [
                m.content for m in memories if m.memory_type == MemoryType.GOAL
            ],
        }

        # Contradictions
        contradiction_warnings = []
        if include_contradictions:
            contradiction_warnings = self._check_all_contradictions(memories)

        # Estimate tokens
        tokens = sum(len(f) for f in relevant_facts) // 4 + len(entities) * 50

        # Respect token limit
        if max_tokens:
            truncated_facts = []
            current_tokens = 0
            for fact in relevant_facts:
                fact_tokens = len(fact) // 4
                if current_tokens + fact_tokens <= max_tokens:
                    truncated_facts.append(fact)
                    current_tokens += fact_tokens
            relevant_facts = truncated_facts
            tokens = current_tokens

        latency = (time.time() - start_time) * 1000
        if latency > 100:
            print(f"TIMPs: assemble_context took {latency:.0f}ms (target <100ms)")

        return ContextPacket(
            memories=memories,
            entities=entities,
            relevant_facts=relevant_facts,
            temporal_context=temporal_context,
            contradiction_warnings=contradiction_warnings,
            assembled_at=datetime.now(),
            tokens=tokens,
        )

    # ─── Entity Resolution ──────────────────────────────────────────────────────

    def _resolve_entities(self, text: str) -> list[Entity]:
        """Resolve entities from text"""
        resolved = []
        words = text.lower().split()

        # Find matching entities
        for entity in self._entities.values():
            if entity.name.lower() in " ".join(words):
                resolved.append(entity)

        # Extract new potential entities
        potential = self._extract_potential_entities(text)
        for name in potential:
            if not any(e.name == name for e in resolved):
                entity = Entity(
                    id=self._generate_id(),
                    name=name,
                    aliases=[name.lower(), name.upper()],
                    entity_type=self._guess_entity_type(name),
                    facts=[],
                    confidence=0.5,
                    linked_entities=[],
                )
                self._entities[entity.id] = entity
                resolved.append(entity)

        return resolved

    def _extract_potential_entities(self, text: str) -> list[str]:
        """Extract potential entities from text"""
        entities = []

        # CamelCase
        import re

        camel_case = re.findall(r"[A-Z][a-z]+(?:[A-Z][a-z]+)+", text)
        entities.extend(camel_case)

        # URLs
        urls = re.findall(r"https?://[^\s]+", text)
        for url in urls:
            try:
                from urllib.parse import urlparse

                entities.append(urlparse(url).hostname)
            except:
                pass

        # File paths
        paths = re.findall(r"/[\w/.-]+\.\w+", text)
        entities.extend(paths)

        # Acronyms
        acronyms = re.findall(r"\b[A-Z]{2,}\b", text)
        entities.extend(acronyms)

        return entities

    def _guess_entity_type(self, name: str) -> str:
        """Guess entity type from name"""
        if "." in name or "/" in name:
            return "file"
        if "http" in name:
            return "api"
        common_tools = [
            "React",
            "Node",
            "Python",
            "TypeScript",
            "JavaScript",
            "Docker",
            "Postgres",
        ]
        if any(t in name for t in common_tools):
            return "tool"
        return "unknown"

    # ─── Temporal Decay & Salience ──────────────────────────────────────────────

    def _calculate_salience(self, importance: float) -> float:
        """Calculate salience score"""
        return min(1.0, max(0.0, importance))

    def _calculate_decay_expiry(self, memory: Memory) -> datetime:
        """Calculate when memory should expire"""
        decay_rates = {
            MemoryType.FACT: timedelta(days=7),
            MemoryType.PREFERENCE: timedelta(days=365),
            MemoryType.GOAL: timedelta(days=30),
            MemoryType.PATTERN: timedelta(days=180),
            MemoryType.ENTITY: timedelta(days=365),
            MemoryType.RELATIONSHIP: timedelta(days=365),
        }

        base = decay_rates.get(memory.memory_type, timedelta(days=7))
        multiplier = 0.5 + (memory.importance * 0.5)

        return datetime.now() + (base * multiplier)

    def apply_decay(self) -> dict[str, int]:
        """Apply decay to all memories"""
        pruned = 0
        updated = 0
        now = datetime.now()

        to_remove = []

        for memory in self._memories.values():
            if memory.expires_at and memory.expires_at < now:
                to_remove.append(memory.id)
            else:
                # Decay salience
                age_hours = (now - memory.created_at).total_seconds() / 3600
                decay_factor = 0.99 ** (age_hours / 24)
                new_salience = memory.salience * decay_factor

                if abs(new_salience - memory.salience) > 0.01:
                    memory.salience = new_salience
                    memory.updated_at = now
                    updated += 1

        for memory_id in to_remove:
            del self._memories[memory_id]
            pruned += 1

        return {"pruned": pruned, "updated": updated}

    # ─── Truth Engine / Contradiction Detection ─────────────────────────────────

    def detect_contradictions(self, new_memory: Memory) -> list[Contradiction]:
        """Detect if new memory contradicts existing ones"""
        contradictions = []
        similar = self.retrieve(new_memory.content, limit=5)

        negation_pattern = r"\b(not|never|no|don\'t|doesn\'t|won\'t|wouldn\'t|isn\'t|aren\'t|can\'t|couldn\'t)\b"
        import re

        has_negation = lambda text: bool(
            re.search(negation_pattern, text, re.IGNORECASE)
        )

        for existing in similar:
            if existing.id == new_memory.id:
                continue

            existing_negated = has_negation(existing.content)
            new_negated = has_negation(new_memory.content)

            if existing_negated != new_negated:
                similarity = self._cosine_similarity(
                    self._embed(existing.content), self._embed(new_memory.content)
                )

                if similarity > 0.7:
                    contradictions.append(
                        Contradiction(
                            id=self._generate_id(),
                            contradiction_type="direct"
                            if similarity > 0.9
                            else "indirect",
                            original_claim=existing.content,
                            new_claim=new_memory.content,
                            severity=(
                                ContradictionSeverity.HIGH
                                if similarity > 0.9
                                else ContradictionSeverity.MEDIUM
                            ),
                            confidence=similarity,
                        )
                    )

        return contradictions

    def _check_all_contradictions(self, memories: list[Memory]) -> list[dict]:
        """Check all memories for contradictions"""
        contradictions = []
        import re

        negation_pattern = r"\b(not|never|no|false|wrong|bad|don\'t|doesn\'t|won\'t|canceled|rejected)\b"
        has_negation = lambda text: len(
            re.findall(negation_pattern, text, re.IGNORECASE)
        )

        for i, mem_a in enumerate(memories):
            for mem_b in memories[i + 1 :]:
                similarity = self._cosine_similarity(
                    self._embed(mem_a.content), self._embed(mem_b.content)
                )

                if similarity > 0.7:
                    a_negated = has_negation(mem_a.content) > 0
                    b_negated = has_negation(mem_b.content) > 0

                    if a_negated != b_negated:
                        contradictions.append(
                            {
                                "original_claim": mem_a.content,
                                "new_claim": mem_b.content,
                                "severity": "high" if similarity > 0.9 else "medium",
                                "confidence": similarity,
                            }
                        )

        return contradictions

    def resolve_contradiction(
        self,
        contradiction_id: str,
        resolution: str,
        user_decision: Optional[str] = None,
    ) -> None:
        """Resolve a contradiction"""
        self._events.emit(
            "contradiction:resolved",
            {
                "contradiction_id": contradiction_id,
                "resolution": resolution,
                "user_decision": user_decision,
            },
        )

    # ─── Memory Garbage Collection ───────────────────────────────────────────────

    def garbage_collect(
        self,
        older_than_days: int = 30,
        min_salience: float = 0.2,
        summarize: bool = True,
    ) -> GarbageCollectionResult:
        """Summarize old memories into essential facts"""
        cutoff = datetime.now() - timedelta(days=older_than_days)

        to_process = []
        to_keep = []

        for memory in self._memories.values():
            if memory.created_at < cutoff and memory.salience < min_salience:
                to_process.append(memory)
            else:
                to_keep.append(memory)

        memories_summarized = 0
        essential_facts = 0

        if summarize and to_process:
            summary = self._summarize_memories(to_process)
            if summary:
                self.store(summary, MemoryType.FACT, importance=0.3)
                memories_summarized = len(to_process)
                essential_facts = 1

        # Prune
        for memory in to_process:
            del self._memories[memory.id]

        tokens_freed = sum(len(m.content) for m in to_process) // 4

        return GarbageCollectionResult(
            memories_pruned=len(to_process),
            memories_summarized=memories_summarized,
            tokens_freed=tokens_freed,
            essential_facts_extracted=essential_facts,
        )

    def _summarize_memories(self, memories: list[Memory]) -> Optional[str]:
        """Simple extractive summarization"""
        if not memories:
            return None

        text = " ".join(m.content for m in memories)

        import re

        sentences = re.split(r"[.!?]+", text)
        key_sentences = [s.strip() for s in sentences if len(s.strip()) > 20][:5]

        if key_sentences:
            return f"Key points from recent interactions: {'.'.join(key_sentences)}."
        return None

    # ─── Utility Methods ────────────────────────────────────────────────────────

    def _generate_id(self) -> str:
        """Generate unique ID"""
        return f"{int(time.time() * 1000)}-{uuid4().hex[:9]}"

    def _embed(self, text: str) -> list[float]:
        """Generate embedding vector"""
        # Simple hash-based embedding for demo
        # In production, use actual embedding model (OpenAI, Ollama, etc.)
        hash_val = sum(ord(c) * (i + 1) for i, c in enumerate(text))

        dimension = 384
        vector = [(hash_val * (i + 1) * 0.1) % 1.0 for i in range(dimension)]

        # Normalize
        norm = sum(v * v for v in vector) ** 0.5
        return [v / norm for v in vector]

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity"""
        if len(a) != len(b):
            return 0.0

        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot / (norm_a * norm_b)

    # ─── Events ────────────────────────────────────────────────────────────────

    def on(self, event: str, listener: Callable):
        """Register event listener"""
        self._events.on(event, listener)
        return self

    def off(self, event: str, listener: Callable):
        """Remove event listener"""
        self._events.off(event, listener)
        return self

    # ─── Persistence ───────────────────────────────────────────────────────────

    async def sync(self):
        """Sync state with backend"""
        if self._sync_callback:
            await self._sync_callback(
                {
                    "memories": list(self._memories.values()),
                    "entities": list(self._entities.values()),
                }
            )
        print("TIMPs: Syncing state...")
