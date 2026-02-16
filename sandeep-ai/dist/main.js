"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./api/server");
const cli_1 = require("./interfaces/cli");
function parseArgs() {
    const args = process.argv.slice(2);
    const mode = args[0] === 'cli' ? 'cli' : 'server';
    if (mode === 'cli') {
        const options = {
            interactive: true,
        };
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
    return { mode: 'server', options: {} };
}
async function main() {
    const { mode, options } = parseArgs();
    if (mode === 'cli') {
        await (0, cli_1.runCLI)(options);
    }
    else {
        await (0, server_1.startServer)();
    }
}
main().catch(console.error);
//# sourceMappingURL=main.js.map