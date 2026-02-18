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
exports.runTUI = runTUI;
const blessed = __importStar(require("blessed"));
const agent_1 = require("../core/agent");
const postgres_1 = require("../db/postgres");
const vector_1 = require("../db/vector");
const tuiHandlers_1 = require("./tuiHandlers");
class TUI {
    agent;
    screen;
    header;
    conversation;
    memoryPanel;
    input;
    statusBar;
    userId;
    projectId;
    memoryCount = 0;
    constructor(agent, userId, projectId) {
        this.agent = agent;
        this.userId = userId;
        this.projectId = projectId;
        // Initialize screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'TIMPs - Trustworthy Interactive Memory Partner System',
            mouse: true,
        });
        // Create layout
        this.createHeader();
        this.createConversationPanel();
        this.createMemoryPanel();
        this.createInputBox();
        this.createStatusBar();
        this.attachKeyBindings();
    }
    createHeader() {
        this.header = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            tags: true,
            style: {
                fg: 'white',
                bg: 'blue',
            },
        });
        this.updateHeader();
    }
    updateHeader() {
        const modeIcon = this.agent.getMemoryMode() === 'ephemeral' ? '🚀' : '💾';
        const memoryText = `Memory: ${this.memoryCount}`;
        const privacyText = this.agent.getMemoryMode() === 'ephemeral' ? 'Privacy: ON' : 'Privacy: OFF';
        const userText = `User: ${this.userId}`;
        this.header.setContent(` {bold}TIMPs v1.0{/bold} | ${modeIcon} ${memoryText} | ${privacyText} | ${userText} `);
        this.screen.render();
    }
    createConversationPanel() {
        this.conversation = blessed.box({
            parent: this.screen,
            top: 3,
            left: 0,
            width: '70%',
            height: this.screen.height - 6,
            border: 'line',
            label: ' {blue-fg}Conversation{/blue-fg} ',
            scrollable: true,
            alwaysScroll: true,
            keys: true,
            vi: true,
            mouse: true,
            style: {
                border: {
                    fg: 'cyan',
                },
                focus: {
                    border: {
                        fg: 'green',
                    },
                },
            },
        });
    }
    createMemoryPanel() {
        this.memoryPanel = blessed.box({
            parent: this.screen,
            top: 3,
            left: '70%',
            width: '30%',
            height: this.screen.height - 6,
            border: 'line',
            label: ' {blue-fg}Memories{/blue-fg} ',
            scrollable: true,
            alwaysScroll: true,
            keys: true,
            vi: true,
            mouse: true,
            style: {
                border: {
                    fg: 'cyan',
                },
                focus: {
                    border: {
                        fg: 'green',
                    },
                },
            },
        });
        this.memoryPanel.setContent('{gray-fg}No memories yet{/gray-fg}');
    }
    createInputBox() {
        this.input = blessed.textbox({
            parent: this.screen,
            bottom: 3,
            height: 3,
            width: '100%',
            border: 'line',
            label: ' {blue-fg}Input{/blue-fg} ',
            inputOnFocus: true,
            style: {
                border: {
                    fg: 'cyan',
                },
                focus: {
                    border: {
                        fg: 'magenta',
                    },
                },
            },
        });
        this.input.key('enter', () => {
            this.handleInput();
        });
        this.input.key('escape', () => {
            this.conversation.focus();
        });
    }
    createStatusBar() {
        this.statusBar = blessed.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            tags: true,
            style: {
                fg: 'black',
                bg: 'green',
            },
        });
        this.statusBar.setContent(' {bold}[Enter]{/bold} Send  {bold}[Ctrl+L]{/bold} Audit  {bold}[Tab]{/bold} Panel  {bold}[Ctrl+C]{/bold} Exit ');
    }
    attachKeyBindings() {
        this.screen.key(['escape', 'q', 'C-c'], () => {
            return process.exit(0);
        });
        this.screen.key(['C-l'], async () => {
            await this.showAudit();
        });
        this.screen.key(['tab'], () => {
            if (this.input.focused) {
                this.conversation.focus();
            }
            else {
                this.input.focus();
            }
        });
        this.input.focus();
    }
    async handleInput() {
        const text = this.input.getValue().trim();
        if (!text) {
            this.input.focus();
            return;
        }
        this.input.clearValue();
        // Display user input
        this.addConversationLine(`{cyan-fg}You:{/cyan-fg} ${text}`);
        // Handle special commands
        if (text.startsWith('!blame ')) {
            const keyword = text.slice(7).trim();
            await this.showBlame(keyword);
            this.input.focus();
            return;
        }
        if (text.startsWith('!forget ')) {
            const keyword = text.slice(8).trim();
            await this.showForgetDialog(keyword);
            this.input.focus();
            return;
        }
        if (text === '!audit') {
            await this.showAudit();
            this.input.focus();
            return;
        }
        // Send to agent
        try {
            this.statusBar.setContent(' {bold}[thinking...]{/bold} ');
            this.screen.render();
            const response = await this.agent.run(text);
            this.addConversationLine(`{green-fg}Assistant:{/green-fg} ${response.content}`);
            // Update memory count
            await this.updateMemoryCount();
            this.updateHeader();
        }
        catch (error) {
            this.addConversationLine(`{red-fg}Error:{/red-fg} ${error.message}`);
        }
        this.statusBar.setContent(' {bold}[Enter]{/bold} Send  {bold}[Ctrl+L]{/bold} Audit  {bold}[Tab]{/bold} Panel  {bold}[Ctrl+C]{/bold} Exit ');
        this.screen.render();
        this.input.focus();
    }
    addConversationLine(text) {
        const current = this.conversation.getContent();
        const lines = current.split('\n');
        // Keep only last 100 lines
        if (lines.length > 100) {
            lines.shift();
        }
        lines.push(text);
        this.conversation.setContent(lines.join('\n'));
        // Scroll to bottom
        setTimeout(() => {
            this.conversation.setScroll(this.conversation.getScrollHeight());
            this.screen.render();
        }, 0);
    }
    async updateMemoryCount() {
        try {
            const { query } = await Promise.resolve().then(() => __importStar(require('../db/postgres')));
            const result = await query('SELECT COUNT(*) as count FROM memories WHERE user_id = $1 AND project_id = $2', [this.userId, this.projectId]);
            this.memoryCount = result[0]?.count || 0;
        }
        catch (error) {
            this.memoryCount = 0;
        }
    }
    async showBlame(keyword) {
        this.addConversationLine(`{yellow-fg}[!blame ${keyword}]{/yellow-fg}`);
        try {
            const results = await (0, tuiHandlers_1.handleBlame)(this.userId, this.projectId, keyword);
            if (results.length === 0) {
                this.addConversationLine(`{gray-fg}📭 No memories found for "${keyword}"{/gray-fg}`);
            }
            else {
                this.addConversationLine(`{green-fg}🔍 Found ${results.length} memory item(s):{/green-fg}`);
                for (const mem of results) {
                    const date = mem.created_at ? new Date(mem.created_at).toLocaleString() : 'Unknown';
                    this.addConversationLine(`  {cyan-fg}[${mem.id}]{/cyan-fg} {yellow-fg}${mem.memory_type}{/yellow-fg} ⭐${mem.importance} - ${mem.content.substring(0, 60)}...`);
                    this.addConversationLine(`    Created: ${date} | Retrieved: ${mem.retrieval_count}x`);
                }
            }
        }
        catch (error) {
            this.addConversationLine(`{red-fg}Error: ${error.message}{/red-fg}`);
        }
        this.screen.render();
        await this.updateMemoryCount();
        this.updateHeader();
    }
    async showForgetDialog(keyword) {
        this.addConversationLine(`{yellow-fg}[!forget ${keyword}]{/yellow-fg}`);
        try {
            const results = await (0, tuiHandlers_1.handleBlame)(this.userId, this.projectId, keyword);
            if (results.length === 0) {
                this.addConversationLine(`{gray-fg}🔍 No memories found for "${keyword}"{/gray-fg}`);
                return;
            }
            this.addConversationLine(`{yellow-fg}⚠️ Found ${results.length} memory item(s) - showing preview:{/yellow-fg}`);
            for (const mem of results) {
                this.addConversationLine(`  {cyan-fg}[${mem.id}]{/cyan-fg} ${mem.content.substring(0, 70)}`);
            }
            // Show confirmation dialog
            const dialog = blessed.box({
                parent: this.screen,
                top: 'center',
                left: 'center',
                width: 60,
                height: 8,
                border: 'line',
                label: ' Confirm Delete ',
                tags: true,
                style: {
                    border: {
                        fg: 'red',
                    },
                },
            });
            dialog.setContent(`{yellow-fg}Delete ${results.length} memory item(s)?{/yellow-fg}\n\n{bold}[Y]{/bold}es  {bold}[N]{/bold}o`);
            const handleConfirm = async (confirm) => {
                dialog.destroy();
                if (confirm) {
                    await (0, tuiHandlers_1.handleForget)(this.userId, this.projectId, keyword);
                    this.addConversationLine(`{green-fg}✅ Successfully deleted ${results.length} memory item(s){/green-fg}`);
                    await this.updateMemoryCount();
                    this.updateHeader();
                }
                else {
                    this.addConversationLine(`{gray-fg}❌ Deletion cancelled{/gray-fg}`);
                }
                this.screen.render();
            };
            dialog.key('y', () => handleConfirm(true));
            dialog.key('n', () => handleConfirm(false));
            dialog.key('escape', () => handleConfirm(false));
            this.screen.focus();
        }
        catch (error) {
            this.addConversationLine(`{red-fg}Error: ${error.message}{/red-fg}`);
        }
        this.screen.render();
    }
    async showAudit() {
        try {
            const { query } = await Promise.resolve().then(() => __importStar(require('../db/postgres')));
            const memories = await query(`SELECT * FROM memories 
         WHERE user_id = $1 AND project_id = $2
         ORDER BY created_at DESC 
         LIMIT 10`, [this.userId, this.projectId]);
            if (memories.length === 0) {
                this.memoryPanel.setContent('{gray-fg}No memories yet{/gray-fg}');
            }
            else {
                let content = '{bold}{blue-fg}📋 AUDIT LOG{/blue-fg}{/bold}\n\n';
                for (const mem of memories) {
                    const date = mem.created_at ? new Date(mem.created_at).toLocaleString() : 'Unknown';
                    const stars = '⭐'.repeat(mem.importance);
                    content += `{cyan-fg}[${mem.id}]{/cyan-fg} {yellow-fg}${mem.memory_type}{/yellow-fg}\n`;
                    content += `${stars} ${mem.importance}/5\n`;
                    content += `📝 ${mem.content.substring(0, 40)}...\n`;
                    content += `📅 ${date}\n`;
                    content += `🔄 Retrieved: ${mem.retrieval_count}x\n\n`;
                }
                this.memoryPanel.setContent(content);
            }
            this.memoryPanel.focus();
        }
        catch (error) {
            this.memoryPanel.setContent(`{red-fg}Error: ${error.message}{/red-fg}`);
        }
        this.screen.render();
    }
    async start() {
        this.addConversationLine(`{green-fg}🚀 TIMPs started in ${this.agent.getMemoryMode()} mode{/green-fg}`);
        this.addConversationLine(`{cyan-fg}Type your message or use commands: !blame, !forget, !audit{/cyan-fg}`);
        await this.updateMemoryCount();
        this.updateHeader();
        this.screen.render();
        this.input.focus();
    }
}
async function runTUI(options) {
    console.log('Initializing TIMPs TUI...\n');
    try {
        await (0, postgres_1.initDatabase)();
    }
    catch (error) {
        // Database setup optional
    }
    try {
        await (0, vector_1.initVectorStore)();
    }
    catch (error) {
        // Vector store optional
    }
    const agent = new agent_1.Agent({
        userId: options.userId,
        projectId: process.cwd(),
        username: options.username,
        systemPrompt: options.systemPrompt,
        memoryMode: options.memoryMode,
        modelProvider: (options.modelProvider || 'ollama'),
    });
    const tui = new TUI(agent, options.userId, process.cwd());
    await tui.start();
}
//# sourceMappingURL=tui.js.map