import { createModel, BaseModel } from '../models';
import { memoryIndex } from '../memory/memoryIndex';
import { curateTier, CurationInput } from './curateTier';
import { provenForge } from './provenForge';
import { governTier, GovernanceEvent } from './governTier';
import { chronosVeil } from './chronosVeil';
import { weaveForge } from './weaveForge';
import { skillWeave } from './skillWeave';
import { atomChain } from './atomChain';
import { policyMetabol } from './policyMetabol';
import { layerForge } from './layerForge';
import { echoForge } from './echoForge';
import { nexusForge } from './nexusForge';
import { synapseMetabolon } from './synapseMetabolon';
import { veilForge } from './veilForge';
import { temporaTree } from './temporaTree';
import { bindWeave } from './bindWeave';
import { aetherWeft } from './aetherWeft';
import { apexSynapse } from './apexSynapse';
import { quaternaryForge } from './quaternaryForge';

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
    const stored = await memoryIndex.storeMemory(
      userId,
      projectId,
      memory.content,
      "reflection",
      memory.importance,
      memory.tags || [],
      "reflection-analysis",
      "llm-extracted"
    );

    // CurateTier: curate each reflected memory into hierarchical tiers
    try {
      const curationInput: CurationInput = {
        content: memory.content,
        tags: memory.tags || [],
        importance: memory.importance,
        memoryType: memory.type,
        source: 'reflection',
        memoryId: stored?.id,
      };
      await curateTier.curate(curationInput, userId);
      
      // ProvenForge: versioning
	      await provenForge.forge(
	        { content: memory.content, tags: memory.tags },
	        'reflection'
	      );
	      await this.evolveMemoryLayers(userId, projectId, memory.content, memory.tags || [], memory.importance, 'reflection');
	    } catch {
	      // Evolution layers are best-effort — never block reflection
	    }

    // GovernTier: policy-driven governance
    if (governTier.isEnabled()) {
      try {
        const event: GovernanceEvent = {
          source_module: 'reflection',
          content: memory.content,
          metadata: {
            importance: memory.importance,
            type: memory.type,
            tags: memory.tags || [],
            retrieval_count: 0,
          },
          provenance: 'llm-extracted',
          user_id: userId,
          project_id: projectId,
          event_type: 'memory_reflection',
        };
        await governTier.enforce(event, 'reflection');
      } catch {
        // GovernTier is best-effort — never block reflection
      }
    }
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
        const stored = await memoryIndex.storeMemory(
          userId,
          projectId,
          insight.content,
          "reflection",
          insight.importance || 1,
          insight.tags || [],
          "session-reflection",
          "session"
        );

        // CurateTier: curate session insights into hierarchical tiers
        try {
          const curationInput: CurationInput = {
            content: insight.content,
            tags: insight.tags || [],
            importance: insight.importance || 1,
            memoryType: insight.type || 'general',
            source: 'reflection',
            memoryId: stored?.id,
          };
          await curateTier.curate(curationInput, userId);
          
          // ProvenForge: versioning
	          await provenForge.forge(
	            { content: insight.content, tags: insight.tags },
	            'reflection_session'
	          );
	          await this.evolveMemoryLayers(
	            userId,
	            projectId,
	            insight.content,
	            insight.tags || [],
	            insight.importance || 1,
	            'reflection_session'
	          );
	        } catch {
	          // Evolution layers are best-effort
	        }
      }
    }
  } catch (error) {
    console.error('Session reflection failed:', error);
	  }
	}

	private async evolveMemoryLayers(
	  userId: number,
	  projectId: string,
	  content: string,
	  tags: string[],
	  importance: number,
	  sourceModule: string
	): Promise<void> {
	  const outcomeScore = Math.max(0.1, Math.min(1.0, importance / 5));
	  const signal = {
	    userId,
	    projectId,
	    content,
	    tags,
	    confidence: outcomeScore,
	    outcomeScore,
	    metadata: { importance, source_module: sourceModule },
	  };

	  await Promise.allSettled([
	    chronosVeil.ingestEvent(signal, sourceModule),
	    weaveForge.weaveSignal(signal, sourceModule, { userId, projectId, outcomeScore }),
	    skillWeave.evolveAndApply(signal, sourceModule, outcomeScore),
	    atomChain.executeAtomic(signal, sourceModule, importance >= 4 ? 'consolidate' : 'create', outcomeScore),
	    policyMetabol.runLoop(signal, sourceModule, outcomeScore),
	    layerForge.forgeCompress(signal, sourceModule, sourceModule),
	    echoForge.runReconstruction(signal, sourceModule, sourceModule),
	    echoForge.forgeHierarchical(signal, sourceModule),
	    nexusForge.episodicIndexer(signal, sourceModule),
	    nexusForge.evolutionOracle(signal, { projectId }),
	    synapseMetabolon.injectEvent(signal, sourceModule),
	    veilForge.projectAndForge(signal, sourceModule),
	    temporaTree.growTree(signal, sourceModule),
	    bindWeave.bindEvent(signal, sourceModule),
	    aetherWeft.weaveEntry(signal, sourceModule),
	    apexSynapse.forgeEvent(signal, sourceModule),
	    quaternaryForge.forgeTyped(signal, sourceModule),
	  ]);
	}
}
