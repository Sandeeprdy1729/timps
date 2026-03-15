#!/usr/bin/env node
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
const server_1 = require("./api/server");
const cli_1 = require("./interfaces/cli");
const postgres_1 = require("./db/postgres");
function parseArgs() {
    const args = process.argv.slice(2);
    const first = args[0];
    // npx timps start  OR  npx timps (no args) → start server with setup wizard
    if (!first || first === 'start') {
        return { mode: 'start', options: {} };
    }
    if (first === 'server') {
        return { mode: 'server', options: {} };
    }
    if (first === 'cli') {
        const options = { interactive: true, memoryMode: 'persistent' };
        for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--user-id' && args[i + 1]) {
                options.userId = parseInt(args[i + 1], 10);
                i++;
            }
            else if (arg === '--username' && args[i + 1]) {
                options.username = args[i + 1];
                i++;
            }
            else if (arg === '--system-prompt' && args[i + 1]) {
                options.systemPrompt = args[i + 1];
                i++;
            }
            else if (arg === '--provider' && args[i + 1]) {
                options.modelProvider = args[i + 1];
                i++;
            }
            else if (arg === '--mode' && args[i + 1]) {
                if (args[i + 1] === 'ephemeral' || args[i + 1] === 'persistent')
                    options.memoryMode = args[i + 1];
                i++;
            }
            else if (arg === '--tui') {
                options.useUI = 'tui';
            }
            else if (arg === '--interactive') {
                options.interactive = true;
            }
            else if (arg === '--help' || arg === '-h') {
                (0, cli_1.printHelp)();
                process.exit(0);
            }
        }
        if (!options.userId) {
            console.error('Error: --user-id is required for CLI mode');
            (0, cli_1.printHelp)();
            process.exit(1);
        }
        return { mode: 'cli', options };
    }
    if (first === '--help' || first === '-h') {
        printBanner();
        (0, cli_1.printHelp)();
        process.exit(0);
    }
    return { mode: 'server', options: {} };
}
function printBanner() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  ◆ TIMPs v2.0 — Trustworthy Interactive Memory Partner   ║
║  17 Intelligence Tools · Model Agnostic · Open Source    ║
╚══════════════════════════════════════════════════════════╝

Usage:
  npx timps start              Start server (default)
  npx timps server             Start server
  npx timps cli --user-id 1   Interactive CLI
  npx timps cli --tui          TUI interface

After starting:
  http://localhost:3000          → Landing page
  http://localhost:3000/chat     → Chat
  http://localhost:3000/dashboard → Intelligence dashboard

Environment (.env):
  DEFAULT_MODEL_PROVIDER=openrouter
  OPENROUTER_API_KEY=sk-or-v1-...
  POSTGRES_HOST=localhost

GitHub: https://github.com/Sandeeprdy1729/timps
`);
}
async function runStart() {
    printBanner();
    console.log('Starting TIMPs server...\n');
    await (0, server_1.startServer)();
}
async function main() {
    await (0, postgres_1.initDatabase)();
    const { mode, options } = parseArgs();
    if (mode === 'start') {
        await runStart();
    }
    else if (mode === 'cli') {
        if (options.useUI === 'tui') {
            const { runTUI } = await Promise.resolve().then(() => __importStar(require('./interfaces/tui')));
            await runTUI(options);
        }
        else {
            await (0, cli_1.runCLI)(options);
        }
    }
    else {
        await (0, server_1.startServer)();
    }
}
main().catch(console.error);
//# sourceMappingURL=main.js.map