"use strict";
// extension/src/views/memoryPanel.ts
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
exports.MemoryPanelProvider = void 0;
const vscode = __importStar(require("vscode"));
const timpsClient_1 = require("../client/timpsClient");
class MemoryPanelProvider {
    constructor(context) {
        this.context = context;
        this.client = new timpsClient_1.TimpsClient();
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };
        webviewView.webview.html = this._getHtmlContent();
        this._setupWebviewListeners();
    }
    _setupWebviewListeners() {
        this._view?.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'refresh') {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor)
                    return;
                // Get memories relevant to current file
                const projectId = this._getProjectId();
                const fileContext = activeEditor.document.fileName;
                try {
                    const memories = await this.client.retrieveMemories({
                        projectId,
                        query: fileContext,
                        limit: 5,
                    });
                    this._view?.webview.postMessage({
                        command: 'updateMemories',
                        memories: memories,
                    });
                }
                catch (error) {
                    console.error('Failed to retrieve memories:', error);
                    this._view?.webview.postMessage({
                        command: 'error',
                        message: 'Failed to load memories',
                    });
                }
            }
        });
    }
    _getHtmlContent() {
        const styleUri = this._view?.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css'));
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
          <div class="memory-panel">
            <div class="header">
              <h2>Relevant Memories</h2>
              <button id="refresh-btn">Refresh</button>
            </div>
            <div id="memories-list" class="memories-list">
              <p class="loading">Loading memories...</p>
            </div>
          </div>
          <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('refresh-btn').addEventListener('click', () => {
              vscode.postMessage({ command: 'refresh' });
            });

            window.addEventListener('message', event => {
              const message = event.data;
              if (message.command === 'updateMemories') {
                const list = document.getElementById('memories-list');
                list.innerHTML = '';
                
                if (message.memories.length === 0) {
                  list.innerHTML = '<p class="empty">No relevant memories found</p>';
                  return;
                }

                message.memories.forEach((memory, idx) => {
                  const item = document.createElement('div');
                  item.className = 'memory-item';
                  item.innerHTML = \`
                    <div class="memory-type">\${memory.memory_type}</div>
                    <div class="memory-content">\${memory.content.substring(0, 100)}...</div>
                    <div class="memory-score">Score: \${memory.reflection_score.toFixed(1)}</div>
                    <button class="use-btn" data-id="\${memory.id}">Use This</button>
                  \`;
                  item.querySelector('.use-btn').addEventListener('click', () => {
                    vscode.postMessage({ 
                      command: 'insertMemory', 
                      memoryId: memory.id,
                      content: memory.content 
                    });
                  });
                  list.appendChild(item);
                });
              }
            });

            vscode.postMessage({ command: 'refresh' });
          </script>
        </body>
      </html>
    `;
    }
    _getProjectId() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath; // Use folder path as project ID
        }
        return 'default';
    }
}
exports.MemoryPanelProvider = MemoryPanelProvider;
