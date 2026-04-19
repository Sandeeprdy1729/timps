"""
TIMPs CrewAI Plugin - Memory integration for CrewAI agents
"""

from typing import Optional, Dict, Any, List
from crewai import Agent, Task, Crew
from crewai.memory import Memory
from datetime import datetime
import json


class TIMPsMemory:
    """
    TIMPs-powered memory for CrewAI agents.
    One-line integration: agent = TIMPsCrewAIAgent(agent, memory=timps_memory)
    """

    def __init__(
        self,
        user_id: str,
        agent_id: Optional[str] = None,
        decay_rate: float = 0.95,
        decay_interval_hours: int = 24,
    ):
        self.user_id = user_id
        self.agent_id = agent_id or f"crewai_agent_{datetime.now().timestamp()}"
        self.decay_rate = decay_rate
        self.decay_interval_hours = decay_interval_hours
        self._memory_store: Dict[str, Any] = {}
        self._entities: Dict[str, Dict] = {}
        self._facts: List[Dict] = []

    def save_context(self, context: Dict[str, Any], result: str) -> None:
        """Save agent context after task completion."""
        task_id = context.get("task", {}).get("id", f"task_{len(self._facts)}")

        memory_entry = {
            "type": "task_result",
            "task_id": task_id,
            "context": context,
            "result": result,
            "timestamp": datetime.now().isoformat(),
            "agent_id": self.agent_id,
            "user_id": self.user_id,
        }

        self._facts.append(memory_entry)
        self._extract_entities(context, result)
        self._update_salience(task_id)

    def _extract_entities(self, context: Dict, result: str) -> None:
        """Extract entities from context and result."""
        text = f"{json.dumps(context)} {result}"
        words = text.split()

        for i, word in enumerate(words):
            if word[0].isupper() and len(word) > 2:
                if word not in self._entities:
                    self._entities[word] = {
                        "name": word,
                        "first_seen": datetime.now().isoformat(),
                        "mentions": 1,
                        "related_tasks": [],
                    }
                else:
                    self._entities[word]["mentions"] += 1

    def _update_salience(self, task_id: str) -> None:
        """Update salience scores based on recency and importance."""
        for fact in self._facts:
            if fact["task_id"] == task_id:
                fact["salience"] = 1.0
            elif "salience" in fact:
                fact["salience"] *= self.decay_rate

    def recall(self, query: str, limit: int = 5) -> List[Dict]:
        """Retrieve relevant memories based on query."""
        query_lower = query.lower()
        scored_memories = []

        for fact in self._facts:
            salience = fact.get("salience", 0.5)

            if "result" in fact:
                result_lower = fact["result"].lower()
                relevance = sum(
                    1 for word in query_lower.split() if word in result_lower
                ) / len(query_lower.split())
            else:
                relevance = 0.5

            score = salience * relevance
            scored_memories.append((score, fact))

        scored_memories.sort(key=lambda x: x[0], reverse=True)
        return [m[1] for m in scored_memories[:limit]]

    def team_memory(self, crew_id: str, query: str) -> List[Dict]:
        """Retrieve shared team memories."""
        team_memories = [f for f in self._facts if f.get("crew_id") == crew_id]
        return self.recall(query, limit=10) if team_memories else []


class TIMPsCrewAIAgent:
    """
    Wrapper for CrewAI agents with TIMPs memory integration.

    Usage:
        from crewai import Agent

        base_agent = Agent(role="Coder", goal="Write code")
        coder = TIMPsCrewAIAgent(
            base_agent,
            user_id="user123",
            agent_id="coder_agent",
            memory=timps_memory
        )
    """

    def __init__(self, agent: Agent, memory: TIMPsMemory, memory_enabled: bool = True):
        self.agent = agent
        self.memory = memory
        self.memory_enabled = memory_enabled

        self._original_execute = agent.execute_task

        def wrapped_execute(task, context=None):
            result = self._original_execute(task, context)
            if self.memory_enabled:
                self.memory.save_context(
                    {"task": task, "context": context}, str(result)
                )
            return result

        agent.execute_task = wrapped_execute

    def get_memory_context(self, query: str) -> str:
        """Get formatted memory context for the agent."""
        memories = self.memory.recall(query)
        if not memories:
            return ""

        context_parts = ["Previous relevant experiences:"]
        for m in memories[:3]:
            context_parts.append(f"- {m.get('result', '')[:200]}")

        return "\n".join(context_parts)


class TIMPsCrewOrchestrator:
    """
    Crew orchestration with shared team memory.

    Usage:
        orchestrator = TIMPsCrewOrchestrator(
            crew=my_crew,
            user_id="user123",
            crew_id="project_alpha"
        )
        orchestrator.run()
    """

    def __init__(
        self, crew: Crew, user_id: str, crew_id: str, team_memory_enabled: bool = True
    ):
        self.crew = crew
        self.user_id = user_id
        self.crew_id = crew_id
        self.team_memory = TIMPsMemory(user_id=user_id, agent_id=f"crew_{crew_id}")
        self.team_memory_enabled = team_memory_enabled

    def run(self, *args, **kwargs):
        """Run crew with team memory tracking."""
        result = self.crew.run(*args, **kwargs)

        if self.team_memory_enabled:
            self.team_memory.save_context(
                {"crew_id": self.crew_id, "agents": [a.role for a in self.crew.agents]},
                str(result),
            )

        return result

    def get_team_context(self, query: str) -> str:
        """Get shared team memory context."""
        memories = self.team_memory.team_memory(self.crew_id, query)
        if not memories:
            return ""

        context_parts = ["Team shared knowledge:"]
        for m in memories[:5]:
            context_parts.append(f"- {m.get('result', '')[:200]}")

        return "\n".join(context_parts)


def with_timps_memory(
    agent: Agent,
    user_id: str,
    agent_id: Optional[str] = None,
    memory: Optional[TIMPsMemory] = None,
) -> TIMPsCrewAIAgent:
    """
    One-line integration for CrewAI agents.

    Usage:
        from crewai import Agent
        from timps.plugins.crewai import with_timps_memory

        agent = Agent(role="Coder", goal="Write code")
        agent = with_timps_memory(agent, user_id="user123")
    """
    memory_instance = memory or TIMPsMemory(user_id=user_id, agent_id=agent_id)
    return TIMPsCrewAIAgent(agent, memory=memory_instance)
