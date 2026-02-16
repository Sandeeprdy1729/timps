import { Agent } from '../core/agent';
import { config } from '../config/env';
import { initDatabase } from '../db/postgres';
import { initVectorStore } from '../db/vector';
import * as readline from 'readline';

export interface CLIOptions {
  userId: number;
  username?: string;
  systemPrompt?: string;
  interactive?: boolean;
}

export async function runCLI(options: CLIOptions): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     Sandeep AI - CLI                                      ║
║     A persistent cognitive partner                        ║
║                                                           ║
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
    username: options.username,
    systemPrompt: options.systemPrompt,
  });
  
  if (options.interactive) {
    await runInteractiveMode(agent);
  } else {
    console.log('Non-interactive mode - use --interactive for chat mode');
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
      
      if (!input.trim()) {
        prompt();
        return;
      }
      
      try {
        const response = await agent.run(input);
        console.log('\nSandeep AI:', response.content);
        
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
  
  console.log('Type your message or "exit" to quit, "clear" to clear conversation.\n');
  prompt();
}

export function printHelp(): void {
  console.log(`
Sandeep AI - Command Line Interface

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
  npm run cli -- --user-id 1 --username "Sandeep" --interactive
  `);
}
