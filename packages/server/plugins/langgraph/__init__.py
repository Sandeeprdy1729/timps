"""
TIMPs LangGraph Plugin - Memory integration for LangGraph agents
"""

from typing import Optional, Dict, Any, List, Callable, TypeVar, Generic
from langgraph.graph import StateGraph, END
from datetime import datetime
import json

T = TypeVar("T")


class TIMPsState:
    """Base state class with TIMPs memory fields."""

    def __init__(
        self,
        user_id: str = "",
        agent_id: str = "",
        messages: List[Dict] = None,
        memory_context: str = "",
        retrieved_memories: List[Dict] = None,
        **kwargs,
    ):
        self.user_id = user_id
        self.agent_id = agent_id
        self.messages = messages or []
        self.memory_context = memory_context
        self.retrieved_memories = retrieved_memories or []
        for k, v in kwargs.items():
            setattr(self, k, v)

    def to_dict(self) -> Dict:
        return {
            "user_id": self.user_id,
            "agent_id": self.agent_id,
            "messages": self.messages,
            "memory_context": self.memory_context,
            "retrieved_memories": self.retrieved_memories,
        }


class TIMPsMemoryStore:
    """
    TIMPs memory store for LangGraph with entity resolution and decay.
    """

    def __init__(
        self, user_id: str, agent_id: Optional[str] = None, decay_rate: float = 0.95
    ):
        self.user_id = user_id
        self.agent_id = agent_id or f"langgraph_{datetime.now().timestamp()}"
        self.decay_rate = decay_rate
        self._memory_index: Dict[str, List[Dict]] = {}
        self._entity_graph: Dict[str, Dict] = {}

    def add_memory(
        self, content: str, metadata: Optional[Dict] = None, salience: float = 1.0
    ) -> str:
        """Add a memory to the store."""
        memory_id = f"mem_{len(self._memory_index)}_{datetime.now().timestamp()}"

        memory = {
            "id": memory_id,
            "content": content,
            "metadata": metadata or {},
            "salience": salience,
            "timestamp": datetime.now().isoformat(),
            "entities": self._extract_entities(content),
            "user_id": self.user_id,
            "agent_id": self.agent_id,
        }

        for entity in memory["entities"]:
            if entity not in self._entity_graph:
                self._entity_graph[entity] = {
                    "name": entity,
                    "first_seen": memory["timestamp"],
                    "connections": [],
                }
            self._entity_graph[entity]["connections"].append(memory_id)

        self._memory_index[memory_id] = memory
        return memory_id

    def _extract_entities(self, content: str) -> List[str]:
        """Extract entities from content."""
        words = content.split()
        return [w for w in words if w[0].isupper() and len(w) > 2]

    def retrieve(self, query: str, limit: int = 5) -> List[Dict]:
        """Semantic retrieval with entity linking."""
        query_entities = self._extract_entities(query)
        scored = []

        for mem_id, memory in self._memory_index.items():
            score = memory["salience"]

            for q_entity in query_entities:
                if q_entity in memory["entities"]:
                    score *= 1.5

            for word in query.split():
                if word.lower() in memory["content"].lower():
                    score *= 1.1

            self._apply_decay(memory)
            scored.append((score, memory))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in scored[:limit]]

    def _apply_decay(self, memory: Dict) -> None:
        """Apply temporal decay to salience."""
        memory["salience"] *= self.decay_rate


class TIMPsMemoryNode:
    """
    LangGraph node that retrieves memories before processing.

    Usage:
        graph.add_node("memory", TIMPsMemoryNode(memory_store, query="relevant context"))
    """

    def __init__(
        self,
        memory_store: TIMPsMemoryStore,
        query_extractor: Optional[Callable[[Dict], str]] = None,
    ):
        self.memory_store = memory_store
        self.query_extractor = query_extractor or (
            lambda state: state.get("messages", [{}])[-1].get("content", "")
        )

    def __call__(self, state: Dict) -> Dict:
        """Retrieve memories and add to state."""
        query = self.query_extractor(state)
        memories = self.memory_store.retrieve(query, limit=5)

        memory_context = ""
        if memories:
            context_parts = ["Relevant past context:"]
            for m in memories:
                context_parts.append(f"- {m['content'][:150]}")
            memory_context = "\n".join(context_parts)

        return {
            **state,
            "retrieved_memories": memories,
            "memory_context": memory_context,
        }


class TIMPsSummaryNode:
    """
    LangGraph node that summarizes and stores conversation.
    Use before END or in periodic checkpoints.
    """

    def __init__(self, memory_store: TIMPsMemoryStore):
        self.memory_store = memory_store

    def __call__(self, state: Dict) -> Dict:
        """Summarize and store conversation."""
        messages = state.get("messages", [])
        if not messages:
            return state

        conversation = "\n".join(
            [f"{m.get('type', 'user')}: {m.get('content', '')}" for m in messages[-10:]]
        )

        summary = self._summarize(conversation)

        self.memory_store.add_memory(
            content=summary,
            metadata={
                "type": "conversation_summary",
                "message_count": len(messages),
                "agent_id": state.get("agent_id", ""),
            },
            salience=0.8,
        )

        return {**state, "memory_stored": True}

    def _summarize(self, text: str) -> str:
        """Simple extractive summarization."""
        sentences = text.split(".")
        if len(sentences) <= 3:
            return text

        key_sentences = [sentences[0], sentences[-1]]
        if len(sentences) > 2:
            key_sentences.insert(1, sentences[len(sentences) // 2])

        return ".".join(key_sentences[:3])


def create_timps_graph(
    user_id: str,
    agent_id: str,
    process_node: Callable,
    initial_state: Optional[Dict] = None,
) -> StateGraph:
    """
    Create a LangGraph with TIMPs memory integration.

    Usage:
        def my_node(state):
            # Your agent logic
            return {"result": "done"}

        graph = create_timps_graph(
            user_id="user123",
            agent_id="coder",
            process_node=my_node
        )

        result = graph.compile().invoke({
            "user_id": "user123",
            "agent_id": "coder",
            "messages": [{"role": "user", "content": "Hello"}]
        })
    """
    memory_store = TIMPsMemoryStore(user_id=user_id, agent_id=agent_id)

    def memory_retrieval(state: Dict) -> Dict:
        query = state.get("messages", [{}])[-1].get("content", "")
        memories = memory_store.retrieve(query, limit=5)

        memory_context = ""
        if memories:
            context_parts = ["Context from memory:"]
            for m in memories:
                context_parts.append(f"- {m['content'][:150]}")
            memory_context = "\n".join(context_parts)

        return {
            **state,
            "memory_context": memory_context,
            "retrieved_memories": memories,
        }

    def memory_storage(state: Dict) -> Dict:
        messages = state.get("messages", [])
        if len(messages) >= 3:
            conversation = "\n".join(
                [
                    f"{m.get('role', 'user')}: {m.get('content', '')}"
                    for m in messages[-5:]
                ]
            )

            memory_store.add_memory(
                content=conversation[:500],
                metadata={"type": "conversation_checkpoint"},
                salience=0.7,
            )

        return {**state, "memory_stored": True}

    builder = StateGraph(Dict)
    builder.add_node("memory_retrieval", memory_retrieval)
    builder.add_node("process", process_node)
    builder.add_node("memory_storage", memory_storage)

    builder.set_entry_point("memory_retrieval")
    builder.add_edge("memory_retrieval", "process")
    builder.add_edge("process", "memory_storage")
    builder.add_edge("memory_storage", END)

    return builder


class TIMPsCheckpointer:
    """
    LangGraph checkpointer with TIMPs memory semantics.
    Replaces default checkpointer with entity-resolved state persistence.
    """

    def __init__(
        self,
        user_id: str,
        checkpoint_dir: str = "./checkpoints",
        decay_rate: float = 0.95,
    ):
        self.user_id = user_id
        self.checkpoint_dir = checkpoint_dir
        self.decay_rate = decay_rate
        self.memory_store = TIMPsMemoryStore(user_id=user_id, decay_rate=decay_rate)

    def get(self, thread_id: str) -> Optional[Dict]:
        """Get checkpoint with memory context."""
        memories = self.memory_store.retrieve(f"thread {thread_id}", limit=3)

        checkpoint = {
            "thread_id": thread_id,
            "user_id": self.user_id,
            "memories": memories,
            "memory_context": "\n".join([m["content"][:200] for m in memories]),
        }

        return checkpoint

    def put(self, thread_id: str, state: Dict) -> None:
        """Save checkpoint with entity extraction."""
        content = json.dumps(state)

        self.memory_store.add_memory(
            content=content[:500],
            metadata={"type": "checkpoint", "thread_id": thread_id},
            salience=0.9,
        )


__all__ = [
    "TIMPsState",
    "TIMPsMemoryStore",
    "TIMPsMemoryNode",
    "TIMPsSummaryNode",
    "create_timps_graph",
    "TIMPsCheckpointer",
]
