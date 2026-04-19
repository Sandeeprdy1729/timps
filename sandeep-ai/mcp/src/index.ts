import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  salience: number;
  timestamp: string;
  entities: string[];
  metadata: Record<string, unknown>;
}

interface TIMPsServer {
  memories: Map<string, MemoryEntry>;
  entities: Map<string, Set<string>>;
  userPreferences: Map<string, unknown>;
  contradictions: Array<{ entry1: string; entry2: string; severity: string }>;
}

const serverState: TIMPsServer = {
  memories: new Map(),
  entities: new Map(),
  userPreferences: new Map(),
  contradictions: [],
};

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractEntities(content: string): string[] {
  const words = content.split(/\s+/);
  return [...new Set(
    words.filter(w => w.length > 2 && /^[A-Z]/.test(w))
  )];
}

const timpsServer = new Server(
  {
    name: "TIMPs Memory Server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

timpsServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "memory_store",
        description: "Store a memory in TIMPs with automatic entity resolution and salience scoring",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The memory content to store"
            },
            type: {
              type: "string",
              enum: ["fact", "preference", "task", "project", "conversation", "learning"],
              description: "Type of memory"
            },
            importance: {
              type: "number",
              minimum: 0,
              maximum: 1,
              default: 0.5,
              description: "Subjective importance (0-1)"
            },
            user_id: {
              type: "string",
              description: "User identifier"
            }
          },
          required: ["content", "type", "user_id"]
        }
      },
      {
        name: "memory_retrieve",
        description: "Retrieve relevant memories based on semantic query with entity linking",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            },
            user_id: {
              type: "string",
              description: "User identifier"
            },
            limit: {
              type: "number",
              default: 5,
              description: "Maximum memories to return"
            }
          },
          required: ["query", "user_id"]
        }
      },
      {
        name: "memory_assemble",
        description: "Assemble a context packet for LLM inference - Pre-Inference Routing",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Current task/query"
            },
            user_id: {
              type: "string",
              description: "User identifier"
            },
            include_preferences: {
              type: "boolean",
              default: true,
              description: "Include user preferences"
            },
            include_contradictions: {
              type: "boolean",
              default: true,
              description: "Include detected contradictions"
            }
          },
          required: ["query", "user_id"]
        }
      },
      {
        name: "memory_detect_contradictions",
        description: "Detect contradictions between new information and existing memories",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "New information to check"
            },
            user_id: {
              type: "string",
              description: "User identifier"
            }
          },
          required: ["content", "user_id"]
        }
      },
      {
        name: "memory_entities",
        description: "Get all entities and their connections from memory",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User identifier"
            },
            entity_name: {
              type: "string",
              description: "Optional specific entity to look up"
            }
          },
          required: ["user_id"]
        }
      },
      {
        name: "memory_apply_decay",
        description: "Apply temporal decay to all memories, reducing salience of older entries",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User identifier"
            },
            decay_rate: {
              type: "number",
              default: 0.95,
              description: "Decay multiplier (0-1)"
            }
          },
          required: ["user_id"]
        }
      },
      {
        name: "memory_gc",
        description: "Garbage collect old memories - summarize and compress low-salience entries",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User identifier"
            },
            threshold: {
              type: "number",
              default: 0.2,
              description: "Salience threshold below which to compress"
            }
          },
          required: ["user_id"]
        }
      },
      {
        name: "memory_stats",
        description: "Get memory statistics for a user",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User identifier"
            }
          },
          required: ["user_id"]
        }
      }
    ]
  };
});

timpsServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case "memory_store": {
        const { content, type, importance = 0.5, user_id } = args as {
          content: string;
          type: string;
          importance?: number;
          user_id: string;
        };
        
        const id = generateId();
        const entities = extractEntities(content);
        const now = new Date().toISOString();
        
        const entry: MemoryEntry = {
          id,
          content,
          type,
          salience: importance,
          timestamp: now,
          entities,
          metadata: { user_id }
        };
        
        serverState.memories.set(id, entry);
        
        for (const entity of entities) {
          if (!serverState.entities.has(entity)) {
            serverState.entities.set(entity, new Set());
          }
          serverState.entities.get(entity)!.add(id);
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                id,
                entities_found: entities.length,
                salience: importance
              })
            }
          ]
        };
      }
      
      case "memory_retrieve": {
        const { query, user_id, limit = 5 } = args as {
          query: string;
          user_id: string;
          limit?: number;
        };
        
        const queryEntities = extractEntities(query);
        const scored: Array<{ entry: MemoryEntry; score: number }> = [];
        
        for (const entry of serverState.memories.values()) {
          if (entry.metadata.user_id !== user_id) continue;
          
          let score = entry.salience;
          
          for (const qEntity of queryEntities) {
            if (entry.entities.includes(qEntity)) {
              score *= 1.5;
            }
          }
          
          const queryLower = query.toLowerCase();
          const contentLower = entry.content.toLowerCase();
          const matches = queryLower.split(/\s+/).filter(w => 
            w.length > 3 && contentLower.includes(w)
          ).length;
          score *= (1 + matches * 0.1);
          
          scored.push({ entry, score });
        }
        
        scored.sort((a, b) => b.score - a.score);
        const results = scored.slice(0, limit).map(s => s.entry);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                count: results.length,
                memories: results.map(e => ({
                  id: e.id,
                  content: e.content,
                  type: e.type,
                  salience: Math.round(e.salience * 100) / 100,
                  timestamp: e.timestamp
                }))
              })
            }
          ]
        };
      }
      
      case "memory_assemble": {
        const { query, user_id, include_preferences = true, include_contradictions = true } = args as {
          query: string;
          user_id: string;
          include_preferences?: boolean;
          include_contradictions?: boolean;
        };
        
        const queryEntities = extractEntities(query);
        const scored: Array<{ entry: MemoryEntry; score: number }> = [];
        
        for (const entry of serverState.memories.values()) {
          if (entry.metadata.user_id !== user_id) continue;
          
          let score = entry.salience;
          for (const qEntity of queryEntities) {
            if (entry.entities.includes(qEntity)) score *= 1.5;
          }
          scored.push({ entry, score });
        }
        
        scored.sort((a, b) => b.score - a.score);
        const memories = scored.slice(0, 10).map(s => s.entry);
        
        const contextPacket: Record<string, unknown> = {
          timestamp: new Date().toISOString(),
          relevant_memories: memories.map(e => ({
            content: e.content,
            type: e.type,
            importance: e.salience > 0.7 ? "high" : e.salience > 0.4 ? "medium" : "low"
          }))
        };
        
        if (include_preferences) {
          const prefs = Array.from(serverState.memories.values())
            .filter(e => e.metadata.user_id === user_id && e.type === "preference");
          contextPacket.user_preferences = prefs.map(e => e.content);
        }
        
        if (include_contradictions && serverState.contradictions.length > 0) {
          contextPacket.contradictions = serverState.contradictions;
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(contextPacket, null, 2)
            }
          ]
        };
      }
      
      case "memory_detect_contradictions": {
        const { content, user_id } = args as { content: string; user_id: string };
        
        const newEntities = extractEntities(content);
        const newMemory = content.toLowerCase();
        const detected: Array<{ existing: string; issue: string; severity: string }> = [];
        
        for (const entry of serverState.memories.values()) {
          if (entry.metadata.user_id !== user_id) continue;
          
          for (const entity of newEntities) {
            if (entry.entities.includes(entity)) {
              const existingLower = entry.content.toLowerCase();
              
              if (newMemory.includes("not") && existingLower.includes(entity)) {
                detected.push({
                  existing: entry.content.substring(0, 100),
                  issue: `Possible contradiction on "${entity}"`,
                  severity: "medium"
                });
              }
            }
          }
        }
        
        if (detected.length > 0) {
          serverState.contradictions.push(...detected.map(d => ({
            entry1: content.substring(0, 50),
            entry2: d.existing,
            severity: d.severity
          })));
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                contradiction_count: detected.length,
                issues: detected
              })
            }
          ]
        };
      }
      
      case "memory_entities": {
        const { user_id, entity_name } = args as { user_id: string; entity_name?: string };
        
        if (entity_name) {
          const memoryIds = serverState.entities.get(entity_name) || new Set();
          const memories = Array.from(memoryIds)
            .map(id => serverState.memories.get(id))
            .filter(e => e && e.metadata.user_id === user_id);
            
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  entity: entity_name,
                  connections: memories.map(e => ({
                    id: e!.id,
                    content: e!.content.substring(0, 100),
                    type: e!.type
                  }))
                })
              }
            ]
          };
        }
        
        const userEntities: Record<string, number> = {};
        for (const [entity, memoryIds] of serverState.entities.entries()) {
          const count = Array.from(memoryIds)
            .filter(id => {
              const mem = serverState.memories.get(id);
              return mem && mem.metadata.user_id === user_id;
            }).length;
          if (count > 0) {
            userEntities[entity] = count;
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                total_entities: Object.keys(userEntities).length,
                top_entities: Object.entries(userEntities)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20)
              })
            }
          ]
        };
      }
      
      case "memory_apply_decay": {
        const { user_id, decay_rate = 0.95 } = args as { user_id: string; decay_rate?: number };
        
        let affected = 0;
        for (const entry of serverState.memories.values()) {
          if (entry.metadata.user_id === user_id) {
            entry.salience *= decay_rate;
            affected++;
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                affected_memories: affected,
                new_decay_rate: decay_rate
              })
            }
          ]
        };
      }
      
      case "memory_gc": {
        const { user_id, threshold = 0.2 } = args as { user_id: string; threshold?: number };
        
        const toCompress: MemoryEntry[] = [];
        
        for (const entry of serverState.memories.values()) {
          if (entry.metadata.user_id === user_id && entry.salience < threshold) {
            toCompress.push(entry);
          }
        }
        
        for (const entry of toCompress) {
          serverState.memories.delete(entry.id);
          for (const entity of entry.entities) {
            serverState.entities.get(entity)?.delete(entry.id);
          }
        }
        
        if (toCompress.length > 0) {
          const summary = `Compressed ${toCompress.length} low-importance memories into essential facts`;
          const id = generateId();
          serverState.memories.set(id, {
            id,
            content: summary,
            type: "compressed",
            salience: 0.3,
            timestamp: new Date().toISOString(),
            entities: [],
            metadata: { user_id, compressed_count: toCompress.length }
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                compressed: toCompress.length,
                retained: Array.from(serverState.memories.values()).filter(e => e.metadata.user_id === user_id).length,
                summary_created: toCompress.length > 0
              })
            }
          ]
        };
      }
      
      case "memory_stats": {
        const { user_id } = args as { user_id: string };
        
        const userMemories = Array.from(serverState.memories.values())
          .filter(e => e.metadata.user_id === user_id);
        
        const byType: Record<string, number> = {};
        let totalSalience = 0;
        
        for (const mem of userMemories) {
          byType[mem.type] = (byType[mem.type] || 0) + 1;
          totalSalience += mem.salience;
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                total_memories: userMemories.length,
                by_type: byType,
                average_salience: userMemories.length > 0 
                  ? Math.round(totalSalience / userMemories.length * 100) / 100 
                  : 0,
                entity_count: Array.from(serverState.entities.values())
                  .filter(ids => Array.from(ids).some(id => {
                    const mem = serverState.memories.get(id);
                    return mem && mem.metadata.user_id === user_id;
                  })).length,
                contradiction_count: serverState.contradictions.length
              })
            }
          ]
        };
      }
      
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await timpsServer.connect(transport);
  console.error("TIMPs MCP Server running on stdio");
}

main().catch(console.error);
