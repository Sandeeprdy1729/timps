"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCLI = runCLI;
exports.printHelp = printHelp;
const agent_1 = require("../core/agent");
const postgres_1 = require("../db/postgres");
const vector_1 = require("../db/vector");
const readline = __importStar(require("readline"));
async function runCLI(options) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     Sandeep AI - CLI                                      ║
║     A persistent cognitive partner                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
    try {
        await (0, postgres_1.initDatabase)();
    }
    catch (error) {
        console.warn('PostgreSQL not available, continuing...');
    }
    try {
        await (0, vector_1.initVectorStore)();
    }
    catch (error) {
        console.warn('Qdrant not available, continuing...');
    }
    const agent = new agent_1.Agent({
        userId: options.userId,
        username: options.username,
        systemPrompt: options.systemPrompt,
    });
    if (options.interactive) {
        await runInteractiveMode(agent);
    }
    else {
        console.log('Non-interactive mode - use --interactive for chat mode');
    }
}
async function runInteractiveMode(agent) {
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
            }
            catch (error) {
                console.error('\nFull Error:', error);
            }
            prompt();
        });
    };
    console.log('Type your message or "exit" to quit, "clear" to clear conversation.\n');
    prompt();
}
function printHelp() {
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
//# sourceMappingURL=cli.js.map