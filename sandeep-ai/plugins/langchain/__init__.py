"""
TIMPs LangChain Integration
One-line integration for LangChain agents

@example
```python
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder

from timps.plugins.langchain import TIMPsLangChain

# Create TIMPs memory
memory = TIMPsLangChain(
    user_id="user_123",
    api_key=os.getenv("TIMPS_API_KEY")
)

# Create prompt with TIMPs context
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant with access to TIMPs memory."),
    MessagesPlaceholder(variable_name="timps_context", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Create agent with TIMPs memory
llm = ChatOpenAI(model="gpt-4")

agent = create_openai_functions_agent(llm, [memory.tool()], prompt)
agent_executor = AgentExecutor(agent=agent, tools=[memory.tool()], verbose=True)

# Agent now has memory!
result = await agent_executor.ainvoke({
    "input": "What did I ask you about yesterday?"
})
```
"""

from typing import Any, Dict, List, Optional
from langchain.base_language import BaseLanguageModel
from langchain.callbacks.base import BaseCallbackHandler
from langchain.memory import BaseMemory
from langchain.schema import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain.tools import BaseTool

from timps import TIMPs, MemoryType


class TIMPsLangChain(BaseMemory):
    """
    LangChain Memory backed by TIMPs

    One-line integration:
    ```python
    memory = TIMPsLangChain(user_id="user_123")
    ```
    """

    memory_key: str = "timps_context"

    def __init__(
        self,
        user_id: str,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        project_id: Optional[str] = None,
        memory_type: MemoryType = MemoryType.FACT,
        importance: float = 0.5,
        retrieval_limit: int = 10,
        **kwargs,
    ):
        super().__init__(**kwargs)

        self.timps = TIMPs(
            api_url=api_url,
            api_key=api_key,
            user_id=user_id,
            project_id=project_id,
        )
        self.memory_type = memory_type
        self.default_importance = importance
        self.retrieval_limit = retrieval_limit

    @property
    def memory_variables(self) -> List[str]:
        return [self.memory_key]

    def load_memory_variables(
        self, inputs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Load relevant memories for context"""
        query = ""
        if inputs:
            query = inputs.get("input", "")

        memories = self.timps.retrieve(
            query or "recent context", limit=self.retrieval_limit
        )

        # Format as conversation context
        context = "\n".join([f"- {m.content}" for m in memories])

        return {self.memory_key: context}

    async def aload_memory_variables(
        self, inputs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.load_memory_variables(inputs)

    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, Any]) -> None:
        """Save conversation to TIMPs memory"""
        user_input = inputs.get("input", "")
        ai_output = outputs.get("output", "")

        if user_input:
            self.timps.store(
                content=f"User said: {user_input}",
                memory_type=MemoryType.FACT,
                importance=0.5,
            )

        if ai_output:
            self.timps.store(
                content=f"Assistant responded: {ai_output}",
                memory_type=MemoryType.FACT,
                importance=0.5,
            )

    async def asave_context(
        self, inputs: Dict[str, Any], outputs: Dict[str, Any]
    ) -> None:
        self.save_context(inputs, outputs)

    def clear(self) -> None:
        """Clear memory (optional - be careful!)"""
        pass  # TIMPs doesn't support bulk delete in this simple version


class TIMPsTool(BaseTool):
    """
    LangChain Tool for TIMPs operations

    Provides tools for agents to interact with TIMPs memory
    """

    name = "timps_memory"
    description = """
    Useful for storing and retrieving information from TIMPs memory.
    Use this when you need to remember facts, preferences, or patterns.
    
    Operations:
    - store: Store a new memory (type: fact, preference, goal, pattern)
    - retrieve: Retrieve relevant memories based on a query
    - check_contradictions: Check if new information contradicts existing memories
    - get_entity: Get information about a specific entity
    """

    def __init__(self, timps: TIMPs):
        super().__init__()
        self.timps = timps

    def _run(
        self,
        operation: str,
        query: Optional[str] = None,
        content: Optional[str] = None,
        memory_type: str = "fact",
        importance: float = 0.5,
        **kwargs,
    ) -> str:
        """Synchronous version"""

        if operation == "store":
            if not content:
                return "Error: content is required for store operation"

            memory_type_enum = (
                MemoryType(memory_type)
                if memory_type in [t.value for t in MemoryType]
                else MemoryType.FACT
            )

            memory = self.timps.store(
                content=content,
                memory_type=memory_type_enum,
                importance=importance,
            )
            return f"Stored memory: {memory.id}"

        elif operation == "retrieve":
            if not query:
                return "Error: query is required for retrieve operation"

            memories = self.timps.retrieve(query, limit=10)

            if not memories:
                return "No relevant memories found."

            result = "Relevant memories:\n"
            for m in memories:
                result += f"- [{m.memory_type.value}] {m.content}\n"
            return result

        elif operation == "check_contradictions":
            if not content:
                return "Error: content is required"

            memory = self.timps.store(content, MemoryType.FACT, importance)
            contradictions = self.timps.detect_contradictions(memory)

            if not contradictions:
                return "No contradictions detected."

            result = "Potential contradictions found:\n"
            for c in contradictions:
                result += f"- {c.original_claim} vs {c.new_claim} (confidence: {c.confidence:.2f})\n"
            return result

        return f"Unknown operation: {operation}"

    async def _arun(self, **kwargs) -> str:
        """Async version"""
        return self._run(**kwargs)


def create_timps_memory(
    user_id: str,
    api_key: Optional[str] = None,
    api_url: Optional[str] = None,
) -> TIMPsLangChain:
    """
    Create TIMPs LangChain memory - One line integration!

    @example
    ```python
    memory = create_timps_memory(user_id="user_123")
    ```
    """
    return TIMPsLangChain(
        user_id=user_id,
        api_key=api_key,
        api_url=api_url,
    )


def create_timps_tools(
    user_id: str,
    api_key: Optional[str] = None,
) -> List[TIMPsTool]:
    """
    Create TIMPs tools for agent use

    @example
    ```python
    from langchain.agents import initialize_agent

    tools = create_timps_tools(user_id="user_123")
    agent = initialize_agent(tools, llm, agent="conversational-react-description")
    ```
    """
    timps = TIMPs(user_id=user_id, api_key=api_key)
    return [TIMPsTool(timps=timps)]
