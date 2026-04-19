// ============================================================
// TIMPs VS Code Extension — OpenCode-Style Terminal Agent
// REPL loop in a VS Code terminal with streaming responses
// ============================================================

import * as vscode from 'vscode';
import { chat } from './ollama';
import { getSystemPrompt } from './systemPrompt';
import { ChatMessage } from './types';

const ESCAPE = '\x1b[';
const RESET = `${ESCAPE}0m`;
const BOLD = `${ESCAPE}1m`;
const DIM = `${ESCAPE}2m`;
const GREEN = `${ESCAPE}32m`;
const CYAN = `${ESCAPE}36m`;
const YELLOW = `${ESCAPE}33m`;
const RED = `${ESCAPE}31m`;
const GRAY = `${ESCAPE}90m`;
const TEAL = `${ESCAPE}38;2;78;201;176m`; // #4ec9b0

let activeTerminal: vscode.Terminal | undefined;
let isProcessing = false;
let abortController: AbortController | null = null;

/**
 * ANSI escape helper — wrap text in color codes
 */
function color(text: string, ...codes: string[]): string {
    return codes.join('') + text + RESET;
}

/**
 * Show the TIMPs banner in the terminal
 */
function showBanner(terminal: vscode.Terminal, model: string) {
    const lines = [
        '',
        color('  ╔══════════════════════════════════════╗', BOLD, TEAL),
        color('  ║', BOLD, TEAL) + color('        T I M P s   A I', BOLD, TEAL) + color('           ║', BOLD, TEAL),
        color('  ║', BOLD, TEAL) + color('   Total Intelligence Memory Partner', DIM, TEAL) + color('  ║', BOLD, TEAL),
        color('  ╚══════════════════════════════════════╝', BOLD, TEAL),
        '',
        color(`  Model: ${model}`, GRAY),
        color('  Type your message and press Enter.', GRAY),
        color('  Use /clear to reset, /exit to close.', GRAY),
        color('  Press Ctrl+C to cancel a response.', GRAY),
        '',
    ];
    terminal.sendText(lines.map(l => `echo "${l}"`).join(' && '));
}

/**
 * Open or reveal the TIMPs terminal
 */
export function openTerminal() {
    if (activeTerminal) {
        activeTerminal.show();
        return;
    }

    const config = vscode.workspace.getConfiguration('timps');
    const model = config.get<string>('localModel', 'sandeeprdy1729/timps-coder');

    activeTerminal = vscode.window.createTerminal({
        name: 'TIMPs',
        hideFromUser: false,
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    });

    activeTerminal.show(true);

    // Show banner
    showBanner(activeTerminal, model);

    // Show initial prompt
    activeTerminal.sendText(`echo ""`);
    activeTerminal.sendText(`read -p "$(echo -e '${color("TIMPs> ", BOLD, TEAL)}')" TIMPS_INPUT && echo "$TIMPS_INPUT" > /tmp/timps_input`);

    // Listen for terminal close
    vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal === activeTerminal) {
            activeTerminal = undefined;
            if (abortController) {
                abortController.abort();
                abortController = null;
            }
            isProcessing = false;
        }
    });
}

/**
 * Process a user message in the terminal
 */
export async function processTerminalMessage(text: string) {
    if (isProcessing) {
        return;
    }

    if (!activeTerminal) {
        openTerminal();
        return;
    }

    const trimmed = text.trim();

    // Handle commands
    if (trimmed === '/exit' || trimmed === '/quit') {
        activeTerminal.dispose();
        return;
    }

    if (trimmed === '/clear') {
        terminalMessageHistory = [];
        activeTerminal.sendText(`clear`);
        activeTerminal.sendText(`echo ""`);
        activeTerminal.sendText(`read -p "$(echo -e '${color("TIMPs> ", BOLD, TEAL)}')" TIMPS_INPUT && echo "$TIMPS_INPUT" > /tmp/timps_input`);
        return;
    }

    if (!trimmed) {
        activeTerminal.sendText(`read -p "$(echo -e '${color("TIMPs> ", BOLD, TEAL)}')" TIMPS_INPUT && echo "$TIMPS_INPUT" > /tmp/timps_input`);
        return;
    }

    // Process the message with Ollama
    isProcessing = true;
    abortController = new AbortController();

    try {
        const config = vscode.workspace.getConfiguration('timps');
        const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');
        const model = config.get<string>('localModel', 'sandeeprdy1729/timps-coder');
        const maxTokens = config.get<number>('maxTokens', 4096);
        const temperature = config.get<number>('temperature', 0.7);
        const customPrompt = config.get<string>('systemPrompt', '');

        const systemPrompt = getSystemPrompt(customPrompt || undefined);

        // Add user message to history
        terminalMessageHistory.push({ role: 'user', content: trimmed });

        // Build messages
        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...terminalMessageHistory,
        ];

        // Show "thinking" indicator
        activeTerminal.sendText(`echo -e "${color('Thinking...', DIM, GRAY)}"`);

        // Stream the response
        let fullResponse = '';
        let buffer = '';
        const CHUNK_SIZE = 8; // Characters to buffer before sending to terminal

        for await (const chunk of chat(ollamaUrl, model, messages, { temperature, maxTokens }, abortController.signal)) {
            fullResponse += chunk;
            buffer += chunk;

            // Send to terminal periodically
            if (buffer.length >= CHUNK_SIZE) {
                const escaped = buffer.replace(/"/g, '\\"').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '\\n');
                activeTerminal.sendText(`echo -n "${escaped}"`);
                buffer = '';
            }
        }

        // Send remaining buffer
        if (buffer) {
            const escaped = buffer.replace(/"/g, '\\"').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '\\n');
            activeTerminal.sendText(`echo -n "${escaped}"`);
        }

        // Newline after response
        activeTerminal.sendText(`echo ""`);

        // Store assistant response in history
        if (fullResponse) {
            terminalMessageHistory.push({ role: 'assistant', content: fullResponse });
        }

    } catch (err: any) {
        if (err.name === 'AbortError') {
            activeTerminal.sendText(`echo -e "\\n${color('[Cancelled]', YELLOW)}"`);
        } else {
            activeTerminal.sendText(`echo -e "${color('Error: ' + err.message, RED)}"`);
        }
    } finally {
        isProcessing = false;
        abortController = null;
        // Show next prompt
        activeTerminal.sendText(`read -p "$(echo -e '${color("TIMPs> ", BOLD, TEAL)}')" TIMPS_INPUT && echo "$TIMPS_INPUT" > /tmp/timps_input`);
    }
}

// Terminal message history
let terminalMessageHistory: ChatMessage[] = [];

/**
 * Get the active terminal instance
 */
export function getActiveTerminal(): vscode.Terminal | undefined {
    return activeTerminal;
}

/**
 * Send a message directly to the terminal (used by context actions)
 */
export function sendToTerminal(text: string) {
    if (!activeTerminal) {
        openTerminal();
    }
    activeTerminal!.show();
    processTerminalMessage(text);
}
