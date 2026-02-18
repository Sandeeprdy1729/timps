import { createModel, BaseModel } from '../models';
import { memoryIndex } from '../memory/memoryIndex';
import { getToolDefinitions, getToolByName, ToolResult } from '../tools';
import { Message, ToolCall, ToolDefinition, GenerateOptions } from '../models/baseModel';
import { config } from '../config/env';

export interface AgentConfig {
  userId: number;
  projectId?: string;
  username?: string;
  systemPrompt?: string;
  maxIterations?: number;
  modelProvider?: 'openai' | 'gemini' | 'ollama';
  memoryMode?: 'persistent' | 'ephemeral';
}

export interface AgentResponse {
  content: string;
  toolResults?: ToolResult[];
  iterations: number;
  memoryStored: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `You are TIMPs – A persistent cognitive partner that remembers, evolves, and builds with your user.

You have access to the following tools:
- file_operations: Read, write, list, create, and delete files on the filesystem
- web_search: Search the web for current information
- web_fetch: Fetch content from specific URLs

Use these tools whenever you need to:
- Access or modify files
- Get up-to-date information
- Fetch content from websites

After each conversation, reflect on what you learned about the user and store important information in your memory.`;

export class Agent {
  private userId: number;
  private projectId: string;
  private memoryMode: 'persistent' | 'ephemeral';
  private username?: string;
  private systemPrompt: string;
  private model: BaseModel;
  private maxIterations: number;
  private toolDefinitions: ToolDefinition[];
  
  constructor(config: AgentConfig) {
    this.userId = config.userId;
    this.projectId = config.projectId || 'default';
    this.memoryMode = config.memoryMode || 'persistent';
    this.username = config.username;
    this.systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.model = createModel(config.modelProvider || 'ollama');
    this.maxIterations = config.maxIterations || 10;
    
    const internalTools = getToolDefinitions();

  this.toolDefinitions = internalTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
  }
  
  async run(userMessage: string): Promise<AgentResponse> {
    memoryIndex.addToShortTerm(this.userId, this.projectId, {
      role: 'user',
      content: userMessage,
    });
    
    const context = await memoryIndex.retrieveContext(this.userId, this.projectId, userMessage);
    const contextString = memoryIndex.formatContextForPrompt(context);
    
    let messages = this.buildMessages(userMessage, contextString);
    
    let iterations = 0;
    let toolResults: ToolResult[] = [];
    
    while (iterations < this.maxIterations) {
      iterations++;
      
      const response = await this.model.generate(messages, {
        tools: this.toolDefinitions,
      });
      
      memoryIndex.addToShortTerm(this.userId, this.projectId, {
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      });
      
      if (!response.toolCalls || response.toolCalls.length === 0) {
        await this.reflectAndStore(userMessage, response.content);
        
        return {
          content: response.content,
          iterations,
          memoryStored: true,
        };
      }
      
      for (const toolCall of response.toolCalls) {
        const result = await this.executeToolCall(toolCall);
        toolResults.push(result);
        
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        });
        
        messages.push({
          role: 'tool',
          content: result.result,
          tool_call_id: toolCall.id,
        });
      }
    }
    
    return {
      content: 'I reached the maximum number of iterations. Let me summarize what I found:',
      toolResults,
      iterations,
      memoryStored: false,
    };
  }
  
  private buildMessages(userMessage: string, contextString: string): Message[] {
    const systemContent = this.systemPrompt +
      (contextString ? `\n\n### User Context\n${contextString}` : '') +
      `\n\n### Recent Conversation\n${memoryIndex.getShortTermContext(this.userId, this.projectId)}`;

    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userMessage },
    ];
  }
  
  private async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const tool = getToolByName(toolCall.function.name);
    
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        result: '',
        error: `Unknown tool: ${toolCall.function.name}`,
      };
    }
    
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await tool.execute(args);
      return {
        toolCallId: toolCall.id,
        result,
      };
    } catch (error: any) {
      return {
        toolCallId: toolCall.id,
        result: '',
        error: error.message,
      };
    }
  }
  
  private async reflectAndStore(userMessage: string, assistantResponse: string): Promise<void> {
    // Skip memory storage in ephemeral mode
    if (this.memoryMode === 'ephemeral') {
      return;
    }
    
    const reflection = await this.extractMemories(userMessage, assistantResponse);
    const projectId = "default";
    const conversationId = "conv_" + Date.now();
    const messageId = "msg_" + Date.now();
    for (const memory of reflection.memories) {
      await memoryIndex.storeMemory(
        this.userId,
        projectId,
        memory.content,
        memory.type === "reflection" ? "reflection" : "explicit",
        memory.importance,
        memory.tags || [],
        conversationId,
        messageId
      );
    }
    
    for (const goal of reflection.goals) {
      await memoryIndex.storeGoal(
        this.userId,
        goal.title,
        goal.description,
        goal.priority
      );
    }
    
    for (const pref of reflection.preferences) {
      await memoryIndex.storePreference(
        this.userId,
        pref.key,
        pref.value,
        pref.category
      );
    }
    
    for (const project of reflection.projects) {
      await memoryIndex.storeProject(
        this.userId,
        project.name,
        project.description,
        project.techStack
      );
    }
  }
  
  private async extractMemories(
    userMessage: string,
    assistantResponse: string
  ): Promise<{
    memories: Array<{ content: string; type: string; importance: number; tags: string[] }>;
    goals: Array<{ title: string; description?: string; priority: number }>;
    preferences: Array<{ key: string; value: string; category?: string }>;
    projects: Array<{ name: string; description?: string; techStack?: string[] }>;
  }> {
    const extractionPrompt = `Analyze this conversation and extract structured information. Return a JSON object with the following structure:

{
  "memories": [{"content": "...", "type": "fact|preference|goal|project|general", "importance": 1-5, "tags": ["tag1", "tag2"]}],
  "goals": [{"title": "...", "description": "...", "priority": 1-5}],
  "preferences": [{"key": "...", "value": "...", "category": "..."}],
  "projects": [{"name": "...", "description": "...", "techStack": ["..."]}]
}

Only include entries if they contain meaningful information. Focus on:
- Facts about the user (name, interests, skills)
- User preferences and likes/dislikes
- Goals the user mentions
- Projects the user is working on
- Any important information worth remembering

Conversation:
User: ${userMessage}
Assistant: ${assistantResponse}`;

    try {
      const response = await this.model.generate(
        [{ role: 'user', content: extractionPrompt }],
        { max_tokens: 2000 }
      );
      
      // Better JSON extraction
      const content = response.content.trim();
      if (content.startsWith('{')) {
        let braceCount = 0;
        let endIdx = -1;
        for (let i = 0; i < content.length; i++) {
          if (content[i] === '{') braceCount++;
          if (content[i] === '}') braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
        if (endIdx > 0) {
          const jsonStr = content.substring(0, endIdx + 1);
          return JSON.parse(jsonStr);
        }
      }
    } catch (error) {
      // Silent fail - return empty knowledge
    }
    
    return {
      memories: [],
      goals: [],
      preferences: [],
      projects: [],
    };
  }
  
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }
  
  getProjectId(): string {
    return this.projectId;
  }
  
  getUserId(): number {
    return this.userId;
  }
  
  getMemoryMode(): string {
    return this.memoryMode;
  }
  
  clearConversation(): void {
    memoryIndex.clearShortTerm(this.userId, this.projectId);
  }
}
