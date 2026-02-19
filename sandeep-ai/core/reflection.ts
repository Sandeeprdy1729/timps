import { createModel, BaseModel } from '../models';
import { memoryIndex } from '../memory/memoryIndex';

export interface ExtractedKnowledge {
  memories: Array<{
    content: string;
    type: 'fact' | 'preference' | 'goal' | 'project' | 'general';
    importance: number;
    tags: string[];
  }>;
  goals: Array<{
    title: string;
    description?: string;
    priority: number;
    status: 'active' | 'completed' | 'cancelled';
  }>;
  preferences: Array<{
    key: string;
    value: string;
    category?: string;
  }>;
  projects: Array<{
    name: string;
    description?: string;
    status: 'active' | 'completed' | 'archived';
    techStack?: string[];
  }>;
}

export class Reflection {
  private model: BaseModel;
  
  constructor() {
    this.model = createModel();
  }
  
  async analyzeConversation(
    userId: number,
    userMessage: string,
    assistantMessage: string
  ): Promise<ExtractedKnowledge> {
    const prompt = `Analyze this conversation and extract structured knowledge to store in memory.

User: ${userMessage}
Assistant: ${assistantMessage}

Extract and return ONLY a JSON object with this exact structure (no other text):

{
  "memories": [
    {"content": "fact or information to remember", "type": "fact|preference|goal|project|general", "importance": 1-5, "tags": ["tag1"]}
  ],
  "goals": [
    {"title": "goal title", "description": "optional description", "priority": 1-5, "status": "active|completed|cancelled"}
  ],
  "preferences": [
    {"key": "preference_key", "value": "preference_value", "category": "optional category"}
  ],
  "projects": [
    {"name": "project name", "description": "optional description", "status": "active|completed|archived", "techStack": ["tech1", "tech2"]}
  ]
}

Only include entries if there is meaningful information to extract. Be concise but specific.`;

    try {
      const response = await this.model.generate(
        [{ role: 'user', content: prompt }],
        { max_tokens: 2000 }
      );
      
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to analyze conversation:', error);
    }
    
    return {
      memories: [],
      goals: [],
      preferences: [],
      projects: [],
    };
  }
  
  async storeExtractedKnowledge(
  userId: number,
  projectId: string,
  knowledge: ExtractedKnowledge
): Promise<void> {

  for (const memory of knowledge.memories) {
    await memoryIndex.storeMemory(
      userId,
      projectId,
      memory.content,
      "reflection",
      memory.importance,
      memory.tags || [],
      "reflection-analysis",
      "llm-extracted"
    );
  }

  for (const goal of knowledge.goals) {
    await memoryIndex.storeGoal(
      userId,
      goal.title,
      goal.description,
      goal.priority
    );
  }

  for (const pref of knowledge.preferences) {
    await memoryIndex.storePreference(
      userId,
      pref.key,
      pref.value,
      pref.category
    );
  }

  for (const proj of knowledge.projects) {
    await memoryIndex.storeProject(
      userId,
      proj.name,
      proj.description,
      proj.techStack || [],
      undefined
    );
  }
}
  
async reflectOnSession(
  userId: number,
  projectId: string,
  messages: Array<{ role: string; content: string }>
): Promise<void> {

  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const sessionPrompt = `Review this conversation session and extract important insights to remember:

${conversationText}

Return JSON array:

[{"content": "...", "type": "fact|preference|general", "importance": 1-5, "tags": ["session"]}]
`;

  try {
    const response = await this.model.generate(
      [{ role: 'user', content: sessionPrompt }],
      { max_tokens: 1000 }
    );

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);

      for (const insight of insights) {
        await memoryIndex.storeMemory(
          userId,
          projectId,
          insight.content,
          "reflection",
          insight.importance || 1,
          insight.tags || [],
          "session-reflection",
          "session"
        );
      }
    }
  } catch (error) {
    console.error('Session reflection failed:', error);
  }
}
}
