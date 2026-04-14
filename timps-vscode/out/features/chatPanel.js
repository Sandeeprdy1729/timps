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
exports.TIMPsChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
function getConfig() {
    const cfg = vscode.workspace.getConfiguration('timps');
    return {
        serverUrl: cfg.get('serverUrl', 'https://timps-api.onrender.com'),
        userId: cfg.get('userId', 1),
        enableInlineWarnings: cfg.get('enableInlineWarnings', true),
        checkOnSave: cfg.get('checkOnSave', true),
        useLocalAgent: cfg.get('useLocalAgent', false),
        localModel: cfg.get('localModel', 'sandeeprdy1729/timps-coder'),
        ollamaUrl: cfg.get('ollamaUrl', 'http://localhost:11434'),
    };
}
class TIMPsChatPanel {
    static createOrShow() {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (TIMPsChatPanel.currentPanel) {
            TIMPsChatPanel.currentPanel._panel.reveal(column);
            return TIMPsChatPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('timpsChat', 'TIMPs AI Assistant', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        TIMPsChatPanel.currentPanel = new TIMPsChatPanel(panel);
        return TIMPsChatPanel.currentPanel;
    }
    constructor(panel) {
        this._messages = [];
        this._disposables = [];
        this._cliProcess = null;
        this._panel = panel;
        this._messages = [];
        this._update();
        this._panel.webview.html = this._getHtmlForWebview();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this._handleUserMessage(message.text);
                    break;
                case 'clearChat':
                    this._messages = [];
                    this._update();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'timps');
                    break;
                case 'runCommand':
                    await vscode.commands.executeCommand(message.cmd);
                    break;
            }
        }, null, this._disposables);
    }
    async _handleUserMessage(text) {
        const config = getConfig();
        // Add user message
        this._messages.push({
            role: 'user',
            content: text,
            timestamp: new Date(),
        });
        this._update();
        // Add assistant "typing" indicator
        this._messages.push({
            role: 'assistant',
            content: '...',
            timestamp: new Date(),
        });
        this._update();
        let response;
        if (config.useLocalAgent) {
            // Use TIMPs CLI agent
            response = await this._runCLIAgent(text, config);
        }
        else {
            // Use API
            response = await this._callAPI(text, config);
        }
        // Replace typing indicator with actual response
        this._messages.pop();
        this._messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date(),
        });
        this._update();
    }
    async _runCLIAgent(message, config) {
        // Try to find TIMPs CLI
        const possiblePaths = [
            path.join(process.cwd(), '../timps-code/bin/timps.js'),
            path.join(process.cwd(), 'timps-code/bin/timps.js'),
            '/usr/local/bin/timps',
            'timps',
        ];
        const cliPath = possiblePaths.find(p => fs.existsSync(p));
        if (!cliPath) {
            return 'TIMPs CLI not found. Please ensure TIMPs is installed or use the API mode.';
        }
        return new Promise((resolve) => {
            // Kill existing process
            if (this._cliProcess) {
                this._cliProcess.kill();
            }
            // Start TIMPs CLI with the message
            this._cliProcess = (0, child_process_1.spawn)('node', [cliPath, '--one-line', message], {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                env: {
                    ...process.env,
                    OLLAMA_BASE_URL: config.ollamaUrl,
                    DEFAULT_MODEL: config.localModel,
                },
            });
            let output = '';
            this._cliProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });
            this._cliProcess.stderr?.on('data', (data) => {
                console.error('TIMPs CLI error:', data.toString());
            });
            this._cliProcess.on('close', () => {
                resolve(output.trim() || 'TIMPs completed.');
            });
            this._cliProcess.on('error', () => {
                resolve('Failed to run TIMPs CLI. Using API instead.');
            });
            // Timeout after 60 seconds
            setTimeout(() => {
                if (this._cliProcess) {
                    this._cliProcess.kill();
                    resolve('TIMPs timed out. Please try again.');
                }
            }, 60000);
        });
    }
    async _callAPI(message, config) {
        try {
            const response = await vscode.commands.executeCommand('vscode.executeTestProviderCommand', undefined, 'timps.apiCall', { endpoint: '/chat', method: 'POST', body: { userId: config.userId, message } });
            if (response?.response) {
                return response.response;
            }
        }
        catch {
            // Ignore and fall through to HTTP request
        }
        // Fallback HTTP request
        const url = new URL(`${config.serverUrl}/api/chat`);
        const body = JSON.stringify({ userId: config.userId, message });
        const httpModule = url.protocol === 'https:' ? require('https') : require('http');
        return new Promise((resolve) => {
            const req = httpModule.request({
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
                timeout: 30000,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.response || 'TIMPs is thinking...');
                    }
                    catch {
                        resolve('TIMPs encountered an issue. Please try again.');
                    }
                });
            });
            req.on('error', () => resolve('TIMPs is offline. Check your connection.'));
            req.on('timeout', () => { req.destroy(); resolve('Request timed out.'); });
            req.write(body);
            req.end();
        });
    }
    _update() {
        this._panel.webview.postMessage({
            command: 'updateMessages',
            messages: this._messages,
        });
    }
    _getHtmlForWebview() {
        return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #d4d4d4; height: 100vh; display: flex; flex-direction: column; }
        .header { background: #252526; padding: 12px 16px; border-bottom: 1px solid #3e3e42; display: flex; align-items: center; justify-content: space-between; }
        .header h1 { font-size: 14px; color: #3794ff; }
        .header .model { font-size: 11px; color: #808080; }
        .messages { flex: 1; overflow-y: auto; padding: 16px; }
        .message { margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; max-width: 85%; }
        .message.user { background: #3794ff; color: white; margin-left: auto; }
        .message.assistant { background: #2d2d30; border: 1px solid #3e3e42; }
        .message .role { font-size: 10px; text-transform: uppercase; margin-bottom: 4px; opacity: 0.7; }
        .message.user .role { text-align: right; }
        .message .content { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
        .message.typing .content { animation: pulse 1s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .input-area { background: #252526; padding: 12px 16px; border-top: 1px solid #3e3e42; }
        .input-row { display: flex; gap: 8px; }
        input { flex: 1; background: #3c3c3c; border: 1px solid #3e3e42; color: #d4d4d4; padding: 8px 12px; border-radius: 4px; font-size: 13px; }
        input:focus { outline: none; border-color: #3794ff; }
        button { background: #3794ff; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        button:hover { background: #4184e4; }
        button:disabled { background: #3e3e42; cursor: not-allowed; }
        .toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
        .toolbar button { background: #3c3c3c; font-size: 11px; padding: 4px 8px; }
        .toolbar button:hover { background: #4c4c4c; }
        .status { font-size: 11px; color: #808080; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>TIMPs AI Assistant</h1>
          <div class="model">Using: <span id="modelName">Loading...</span></div>
        </div>
      </div>
      <div class="messages" id="messages"></div>
      <div class="input-area">
        <div class="toolbar">
          <button onclick="runCommand('timps.openDashboard')">Dashboard</button>
          <button onclick="runCommand('workbench.action.findInFiles')">Search</button>
          <button onclick="clearChat()">Clear</button>
          <button onclick="openSettings()">Settings</button>
        </div>
        <div class="input-row">
          <input type="text" id="messageInput" placeholder="Ask TIMPs..." onkeypress="if(event.key==='Enter')sendMessage()">
          <button onclick="sendMessage()" id="sendBtn">Send</button>
        </div>
        <div class="status" id="status">Ready</div>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        let messages = [];
        
        function updateModel() {
          // This will be updated from extension
        }
        
        function sendMessage() {
          const input = document.getElementById('messageInput');
          const text = input.value.trim();
          if (!text) return;
          input.value = '';
          vscode.postMessage({ command: 'sendMessage', text });
        }
        
        function clearChat() {
          vscode.postMessage({ command: 'clearChat' });
        }
        
        function openSettings() {
          vscode.postMessage({ command: 'openSettings' });
        }
        
        function runCommand(cmd) {
          vscode.postMessage({ command: 'runCommand', cmd });
        }
        
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'updateMessages') {
            messages = message.messages;
            renderMessages();
          }
        });
        
        function renderMessages() {
          const container = document.getElementById('messages');
          container.innerHTML = messages.map(m => {
            const isTyping = m.content === '...' && m.role === 'assistant';
            return '<div class="message ' + m.role + (isTyping ? ' typing' : '') + '">' +
                   '<div class="role">' + (m.role === 'user' ? 'You' : 'TIMPs') + '</div>' +
                   '<div class="content">' + escapeHtml(m.content) + '</div></div>';
          }).join('');
          container.scrollTop = container.scrollHeight;
        }
        
        function escapeHtml(text) {
          return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        
        document.getElementById('messageInput').focus();
      </script>
    </body>
    </html>`;
    }
    dispose() {
        TIMPsChatPanel.currentPanel = undefined;
        if (this._cliProcess) {
            this._cliProcess.kill();
        }
        this._disposables.forEach(d => d.dispose());
    }
}
exports.TIMPsChatPanel = TIMPsChatPanel;
