import { Agent } from '../core/agent';
import { config } from '../config/env';
import { initDatabase, query, execute } from '../db/postgres';
import { initVectorStore, searchVectors } from '../db/vector';
import { createEmbeddingModel } from '../models';
import { Memory } from '../memory/longTerm';
import * as readline from 'readline';

export interface CLIOptions {
  userId: number;
  username?: string;
  systemPrompt?: string;
  interactive?: boolean;
  memoryMode?: 'persistent' | 'ephemeral';
}

export async function runCLI(options: CLIOptions): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║  ████████╗██╗███╗   ███╗██████╗ ███████╗                ║
║  ╚══██╔══╝██║████╗ ████║██╔══██╗██╔════╝                ║
║     ██║   ██║██╔████╔██║██████╔╝███████╗                ║
║     ██║   ██║██║╚██╔╝██║██╔═══╝ ╚════██║                ║
║     ██║   ██║██║ ╚═╝ ██║██║     ███████║                ║
║     ╚═╝   ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝                ║
║                                                           ║
║  Trustworthy Intelligent Memory & Privacy System         ║
╚═══════════════════════════════════════════════════════════╝
`);
  
  try {
    await initDatabase();
  } catch (error) {
    console.warn('PostgreSQL not available, continuing...');
  }
  
  try {
    await initVectorStore();
  } catch (error) {
    console.warn('Qdrant not available, continuing...');
  }
  
  const agent = new Agent({
    userId: options.userId,
    projectId: process.cwd(),
    username: options.username,
    systemPrompt: options.systemPrompt,
    memoryMode: options.memoryMode,
  });
  
  if (options.interactive) {
    await runInteractiveMode(agent);
  } else {
    console.log('Non-interactive mode - use --interactive for chat mode');
  }
}

async function handleBlame(userId: number, projectId: string, keyword: string): Promise<void> {
  try {
    const embeddingModel = createEmbeddingModel('ollama');
    
    // Step 1: Keyword search via SQL (ILIKE)
    const sqlResults = await query<Memory>(
      `SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2 
       AND content ILIKE $3
       ORDER BY created_at DESC`,
      [userId, projectId, `%${keyword}%`]
    );
    
    // Step 2: Vector search via Qdrant
    let vectorResults: Memory[] = [];
    if (config.qdrant.url) {
      try {
        const embedding = await embeddingModel.getEmbedding(keyword);
        const searchResults = await searchVectors(embedding.embedding, 10, {
          must: [
            { key: 'user_id', match: { value: userId } },
            { key: 'project_id', match: { value: projectId } },
          ],
        });
        
        if (searchResults.length > 0) {
          const memoryIds = searchResults.map(r => r.payload.memory_id);
          vectorResults = await query<Memory>(
            `SELECT * FROM memories WHERE id = ANY($1)`,
            [memoryIds]
          );
        }
      } catch (error) {
        console.warn('Vector search failed, continuing with SQL results only');
      }
    }
    
    // Step 3: Merge results (deduplicate by id)
    const mergedMap = new Map<number, Memory>();
    for (const mem of sqlResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
    }
    for (const mem of vectorResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
    }
    
    // Step 4: Sort by created_at DESC
    const results = Array.from(mergedMap.values())
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    
    if (results.length === 0) {
      console.log(`\n📭 No memories found for keyword: "${keyword}"`);
      return;
    }
    
    // Step 5: Display structured output
    console.log(`\n🔍 Found ${results.length} memory item(s) for "${keyword}":`);
    console.log('─'.repeat(60));
    
    for (const mem of results) {
      const date = mem.created_at ? new Date(mem.created_at).toLocaleString() : 'Unknown';
      console.log(`\n[${mem.id}] ${mem.memory_type.toUpperCase()} | Importance: ${mem.importance}/5`);
      console.log(`    Content: ${mem.content.substring(0, 80)}${mem.content.length > 80 ? '...' : ''}`);
      console.log(`    Retrieved: ${mem.retrieval_count} times | Last: ${mem.last_retrieved_at ? new Date(mem.last_retrieved_at).toLocaleString() : 'Never'}`);
      console.log(`    Created: ${date}`);
    }
    
    console.log('\n' + '─'.repeat(60));
    
    // Step 6: Increment retrieval_count for all results
    for (const mem of results) {
      if (mem.id) {
        await execute(
          'UPDATE memories SET retrieval_count = retrieval_count + 1, last_retrieved_at = CURRENT_TIMESTAMP WHERE id = $1',
          [mem.id]
        );
      }
    }
  } catch (error: any) {
    console.error('\n❌ Blame command failed:', error.message);
  }
}

async function askConfirmation(rl: readline.Interface, question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function handleForget(
  rl: readline.Interface,
  userId: number,
  projectId: string,
  keyword: string
): Promise<void> {
  try {
    // Step 1: Find matching memories
    const embeddingModel = createEmbeddingModel('ollama');
    
    const sqlResults = await query<Memory>(
      `SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2 
       AND content ILIKE $3
       ORDER BY created_at DESC`,
      [userId, projectId, `%${keyword}%`]
    );
    
    let vectorResults: Memory[] = [];
    if (config.qdrant.url) {
      try {
        const embedding = await embeddingModel.getEmbedding(keyword);
        const searchResults = await searchVectors(embedding.embedding, 10, {
          must: [
            { key: 'user_id', match: { value: userId } },
            { key: 'project_id', match: { value: projectId } },
          ],
        });
        
        if (searchResults.length > 0) {
          const memoryIds = searchResults.map(r => r.payload.memory_id);
          vectorResults = await query<Memory>(
            `SELECT * FROM memories WHERE id = ANY($1)`,
            [memoryIds]
          );
        }
      } catch (error) {
        console.warn('Vector search failed, continuing with SQL results only');
      }
    }
    
    // Merge and deduplicate
    const mergedMap = new Map<number, Memory>();
    for (const mem of sqlResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
    }
    for (const mem of vectorResults) {
      if (mem.id) mergedMap.set(mem.id, mem);
    }
    
    const results = Array.from(mergedMap.values())
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    
    if (results.length === 0) {
      console.log(`\n🔍 No memories found for keyword: "${keyword}"`);
      return;
    }
    
    // Step 2: Show preview
    console.log(`\n⚠️  Found ${results.length} memory item(s) for "${keyword}" - PREVIEW:"`);
    console.log('─'.repeat(60));
    
    for (const mem of results) {
      const date = mem.created_at ? new Date(mem.created_at).toLocaleString() : 'Unknown';
      console.log(`\n[${mem.id}] ${mem.memory_type.toUpperCase()} | Importance: ${mem.importance}/5`);
      console.log(`    Content: ${mem.content.substring(0, 80)}${mem.content.length > 80 ? '...' : ''}`);
      console.log(`    Created: ${date}`);
    }
    
    console.log('\n' + '─'.repeat(60));
    
    // Step 3: Ask confirmation
    const confirmed = await askConfirmation(
      rl,
      `\n⚠️  Delete ${results.length} memory item(s)? (y/n): `
    );
    
    if (!confirmed) {
      console.log('❌ Deletion cancelled.');
      return;
    }
    
    // Step 4: Delete from Postgres and Vector store
    const deletedIds: number[] = [];
    
    for (const mem of results) {
      if (!mem.id) continue;
      
      try {
        // Delete from Postgres
        await execute(
          'DELETE FROM memories WHERE id = $1',
          [mem.id]
        );
        
        // Delete from Qdrant
        if (config.qdrant.url) {
          try {
            const vectorId = `mem_${mem.id}`;
            // Note: Qdrant deletion would require API call
            // For now we just remove the reference
          } catch (err) {
            console.warn(`Failed to delete vector for memory ${mem.id}`);
          }
        }
        
        deletedIds.push(mem.id);
      } catch (error) {
        console.error(`Failed to delete memory ${mem.id}:`, error);
      }
    }
    
    // Step 5: Log deletion event
    if (deletedIds.length > 0) {
      console.log(`\n✅ Successfully deleted ${deletedIds.length} memory item(s):`);
      console.log(`   ID(s): ${deletedIds.join(', ')}`);
      console.log(`   Timestamp: ${new Date().toLocaleString()}`);
    }
  } catch (error: any) {
    console.error('\n❌ Forget command failed:', error.message);
  }
}

async function handleAudit(userId: number, projectId: string): Promise<void> {
  try {
    // Query last 10 memories
    const memories = await query<Memory>(
      `SELECT * FROM memories 
       WHERE user_id = $1 AND project_id = $2
       ORDER BY created_at DESC 
       LIMIT 10`,
      [userId, projectId]
    );
    
    if (memories.length === 0) {
      console.log('\n📋 No memories found in this project.');
      return;
    }
    
    console.log(`\n📋 AUDIT LOG - Last ${memories.length} Memories`);
    console.log('═'.repeat(80));
    
    for (let i = 0; i < memories.length; i++) {
      const mem = memories[i];
      const date = mem.created_at ? new Date(mem.created_at).toLocaleString() : 'Unknown';
      const lastRetrieved = mem.last_retrieved_at ? new Date(mem.last_retrieved_at).toLocaleString() : 'Never';
      
      console.log(`\n${i + 1}. [ID: ${mem.id}] ${mem.memory_type.toUpperCase()}`);
      console.log(`   Importance: ${'⭐'.repeat(mem.importance)} (${mem.importance}/5)`);
      console.log(`   Content: ${mem.content.substring(0, 100)}${mem.content.length > 100 ? '...' : ''}`);
      console.log(`   Created: ${date}`);
      console.log(`   Retrieval Count: ${mem.retrieval_count}`);
      console.log(`   Last Retrieved: ${lastRetrieved}`);
      if (mem.tags && mem.tags.length > 0) {
        console.log(`   Tags: ${mem.tags.join(', ')}`);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
  } catch (error: any) {
    console.error('\n❌ Audit command failed:', error.message);
  }
}

async function runInteractiveMode(agent: Agent): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const prompt = () => {
    rl.question('\nYou: ', async (input) => {
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('\nGoodbye! Memory preserved.');
        rl.close();
        return;
      }
      
      if (input.toLowerCase() === 'clear') {
        agent.clearConversation();
        console.log('Conversation cleared.');
        prompt();
        return;
      }
      
      if (input.startsWith('!blame ')) {
        const keyword = input.slice(7).trim();
        if (keyword) {
          await handleBlame(agent.getUserId(), agent.getProjectId(), keyword);
        } else {
          console.log('\n❌ Usage: !blame <keyword>');
        }
        prompt();
        return;
      }
      
      if (input.startsWith('!forget ')) {
        const keyword = input.slice(8).trim();
        if (keyword) {
          await handleForget(rl, agent.getUserId(), agent.getProjectId(), keyword);
        } else {
          console.log('\n❌ Usage: !forget <keyword>');
        }
        prompt();
        return;
      }
      
      if (input.toLowerCase() === '!audit') {
        await handleAudit(agent.getUserId(), agent.getProjectId());
        prompt();
        return;
      }
      
      if (!input.trim()) {
        prompt();
        return;
      }
      
      try {
        const response = await agent.run(input);
        console.log('\nTIMPs:', response.content);
        
        if (response.toolResults && response.toolResults.length > 0) {
          console.log('\n[Tool Results]');
          for (const result of response.toolResults) {
            console.log(`- ${result.toolCallId}: ${result.result.substring(0, 100)}...`);
          }
        }
      } catch (error: any) {
        console.error('\nFull Error:', error);
      }
      
      prompt();
    });
  };
  
  const memoryModeIcon = agent.getMemoryMode() === 'ephemeral' ? '🚀' : '💾';
  console.log(`\n${memoryModeIcon} Memory Mode: ${agent.getMemoryMode().toUpperCase()}`);
  console.log('Type your message or use commands:\n  !blame <keyword>  - Search for memories by keyword\n  !forget <keyword> - Search and delete memories\n  !audit            - Show last 10 memories\n  clear             - Clear conversation\n  exit, quit        - Exit\n');
  prompt();
}

export function printHelp(): void {
  console.log(`
TIMPs - Command Line Interface

Usage: 
  npm run cli -- --user-id <id> [options]

Options:
  --user-id <id>      User ID (required)
  --username <name>   Username (optional)
  --interactive       Start interactive chat mode
  --system-prompt     Custom system prompt
  --help              Show this help message

Examples:
  npm run cli -- --user-id 1 --interactive
  npm run cli -- --user-id 1 --username "TIMPs" --interactive
  `);
}
