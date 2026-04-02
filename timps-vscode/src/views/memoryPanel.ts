// extension/src/views/memoryPanel.ts

import * as vscode from 'vscode';
import { TimpsClient } from '../client/timpsClient';

export class MemoryPanelProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private client: TimpsClient;

  constructor(private context: vscode.ExtensionContext) {
    this.client = new TimpsClient();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent();
    this._setupWebviewListeners();
  }

  private _setupWebviewListeners() {
    this._view?.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'refresh') {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

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
        } catch (error) {
          console.error('Failed to retrieve memories:', error);
          this._view?.webview.postMessage({
            command: 'error',
            message: 'Failed to load memories',
          });
        }
      }
    });
  }

  private _getHtmlContent(): string {
    const styleUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css'),
    );

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

  private _getProjectId(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath; // Use folder path as project ID
    }
    return 'default';
  }
}
