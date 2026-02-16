import { startServer } from './api/server';
import { runCLI, printHelp } from './interfaces/cli';
import { config } from './config/env';

function parseArgs(): { mode: 'server' | 'cli'; options: any } {
  const args = process.argv.slice(2);
  const mode = args[0] === 'cli' ? 'cli' : 'server';
  
  if (mode === 'cli') {
    const options: any = {
      interactive: true,
    };
    
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--user-id' && args[i + 1]) {
        options.userId = parseInt(args[i + 1], 10);
        i++;
      } else if (arg === '--username' && args[i + 1]) {
        options.username = args[i + 1];
        i++;
      } else if (arg === '--system-prompt' && args[i + 1]) {
        options.systemPrompt = args[i + 1];
        i++;
      } else if (arg === '--provider' && args[i + 1]) {
        options.modelProvider = args[i + 1];
        i++;
      } else if (arg === '--interactive') {
        options.interactive = true;
      } else if (arg === '--help' || arg === '-h') {
        printHelp();
        process.exit(0);
      }
    } 
    
    if (!options.userId) {
      console.error('Error: --user-id is required for CLI mode');
      printHelp();
      process.exit(1);
    }
    
    return { mode: 'cli', options };
  }
  
  return { mode: 'server', options: {} };
}

async function main(): Promise<void> {
  const { mode, options } = parseArgs();
  
  if (mode === 'cli') {
    await runCLI(options);
  } else {
    await startServer();
  }
}

main().catch(console.error);
