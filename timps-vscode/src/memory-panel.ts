import * as vscode from 'vscode';
import { TimpsClient } from './client/timpsClient';

export class TimpsMemoryPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'timps.memoryPanel';
  private _view?: vscode.WebviewView;
  private _client: TimpsClient;
  private _disposables: vscode.Disposable[] = [];
  private _debounceTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._client = new TimpsClient();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    webviewView.onDidDispose(() => this._dispose(), null, this._disposables);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'recall':
          vscode.commands.executeCommand('timps.recall', message.query);
          break;
        case 'openMemory':
          vscode.commands.executeCommand('timps.nexusForgeExplorer.focus');
          break;
      }
    });

    this._updateContext();

    // Watch for editor changes to update context
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this._debouncedUpdate()),
      vscode.window.onDidChangeTextEditorSelection(() => this._debouncedUpdate()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === vscode.window.activeTextEditor?.document) {
          this._debouncedUpdate();
        }
      }),
    );
  }

  private _debouncedUpdate(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._updateContext(), 500);
  }

  private async _updateContext(): Promise<void> {
    if (!this._view) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view.webview.postMessage({
        command: 'setContext',
        memories: [],
        filePath: '',
        cursorLine: 0,
      });
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const cursorLine = editor.selection.active.line;
    const memories = await this._client.getContext(filePath, cursorLine);

    this._view.webview.postMessage({
      command: 'setContext',
      memories,
      filePath,
      cursorLine,
    });
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: var(--vscode-editor-font-family); font-size: 13px; padding: 8px; color: var(--vscode-editor-foreground); background: transparent; }
.memory-card { background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-widget-border); border-radius: 6px; padding: 8px; margin-bottom: 8px; }
.memory-card:hover { border-color: var(--vscode-focusBorder); }
.memory-content { margin: 0 0 4px 0; line-height: 1.4; }
.memory-meta { font-size: 11px; color: var(--vscode-descriptionForeground); display: flex; gap: 8px; flex-wrap: wrap; }
.tag { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 3px; font-size: 10px; }
.contradiction-warning { border-left: 3px solid var(--vscode-editorWarning-foreground); padding-left: 8px; }
.empty-state { text-align: center; padding: 24px 8px; color: var(--vscode-descriptionForeground); }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.search-bar { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 4px 8px; margin-bottom: 8px; box-sizing: border-box; }
.hidden { display: none; }
</style>
</head>
<body>
<div class="header">
  <span><strong>🧠 Context</strong></span>
  <span class="badge" id="countBadge">0</span>
</div>
<input type="text" class="search-bar" id="searchInput" placeholder="Search memories..." />
<div id="memoryList">
  <div class="empty-state">Open a file to see relevant memories</div>
</div>
<script>
(function() {
  const vscodeApi = acquireVsCodeApi();
  const memoryList = document.getElementById('memoryList');
  const countBadge = document.getElementById('countBadge');
  const searchInput = document.getElementById('searchInput');

  let allMemories = [];

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { renderMemories(allMemories); return; }
    const filtered = allMemories.filter(m =>
      m.content.toLowerCase().includes(q) ||
      (m.tags || []).some(t => t.toLowerCase().includes(q))
    );
    renderMemories(filtered);
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.command === 'setContext') {
      allMemories = msg.memories || [];
      renderMemories(allMemories);
    }
  });

  function renderMemories(memories) {
    if (!memories || memories.length === 0) {
      memoryList.innerHTML = '<div class="empty-state">No relevant memories for this context</div>';
      countBadge.textContent = '0';
      return;
    }

    countBadge.textContent = memories.length;

    memoryList.innerHTML = memories.map(m => {
      const hasContradiction = m.confidence && m.confidence < 0.4;
      const cardClass = hasContradiction ? 'memory-card contradiction-warning' : 'memory-card';
      const tags = (m.tags || []).map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join(' ');
      const confidence = m.confidence ? Math.round(m.confidence * 100) + '%' : '';
      const typeLabel = m.type || 'memory';

      return '<div class="' + cardClass + '">' +
        '<div class="memory-content">' + escapeHtml(m.content) + '</div>' +
        '<div class="memory-meta">' +
          '<span>' + escapeHtml(typeLabel) + '</span>' +
          (confidence ? '<span>' + confidence + '</span>' : '') +
          tags +
        '</div>' +
        '</div>';
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
</script>
</body>
</html>`;
  }

  private _dispose(): void {
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }
}
