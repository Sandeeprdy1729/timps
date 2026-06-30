// ── NexusForge Explorer ──
// Visual episodic memory explorer for the TIMPS VSCode extension

import * as vscode from 'vscode';
import { getNexusForgeStats, getNexusForgeGraph, queryNexusForge } from './nexusClient';
import { TIMPS_THEME, TIMPS_GLOBAL_RESET, TIMPS_ANIMATIONS } from './design-tokens';

export class NexusForgeExplorerProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'timps.nexusForgeExplorer';
  private _view?: vscode.WebviewView;
  private _userId: number;
  private _apiBase: string;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    userId: number = 1,
    apiBase: string = 'http://localhost:3000'
  ) {
    this._userId = userId;
    this._apiBase = apiBase;
  }

  updateConfig(userId: number, apiBase: string) {
    this._userId = userId;
    this._apiBase = apiBase;
    this._refreshView();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml();
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'ready':
          this._loadData();
          break;
        case 'query':
          this._handleQuery(msg.query);
          break;
        case 'refresh':
          this._loadData();
          break;
      }
    });
  }

  private async _loadData() {
    const [stats, graph] = await Promise.all([
      getNexusForgeStats(this._userId),
      getNexusForgeGraph(this._userId, 50),
    ]);
    this._view?.webview.postMessage({
      type: 'data',
      stats: stats || { totalNodes: 0, totalEdges: 0, sources: {} },
      graph: graph || { nodes: [], edges: [] },
    });
  }

  private async _handleQuery(query: string) {
    const result = await queryNexusForge(query, this._userId);
    this._view?.webview.postMessage({
      type: 'queryResult',
      results: result.results || [],
      refusal: result.refusal,
      confidence: result.confidence,
    });
  }

  private _refreshView() {
    if (this._view) {
      this._view.webview.html = this._getHtml();
    }
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NexusForge Explorer</title>
<style>
${TIMPS_THEME}
${TIMPS_GLOBAL_RESET}
${TIMPS_ANIMATIONS}
body {
  font-size: 12px;
  padding: 8px;
}
.header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 0 10px;
  border-bottom: 1px solid var(--timps-border);
  margin-bottom: 10px;
}
.header-logo {
  width: 18px; height: 18px;
  background: var(--timps-accent);
  border-radius: var(--timps-radius-sm);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 9px; color: var(--timps-bg);
}
.header-title { font-size: 12px; font-weight: 700; }
.stats-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
  margin-bottom: 10px;
}
.stat {
  background: var(--timps-bg2);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  padding: 8px;
  text-align: center;
}
.stat-val { font-size: 18px; font-weight: 700; color: var(--timps-text); }
.stat-label { font-size: 9px; color: var(--timps-text-muted); margin-top: 2px; }
.query-box {
  display: flex; gap: 4px; margin-bottom: 10px;
}
.query-input {
  flex: 1; background: var(--timps-bg3);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  color: var(--timps-text);
  padding: 6px 8px; font-size: 11px;
  font-family: var(--timps-font-mono);
  outline: none;
}
.query-input:focus { border-color: var(--timps-accent); }
.query-btn {
  background: var(--timps-accent);
  border: 1px solid var(--timps-border-light);
  color: var(--timps-bg);
  padding: 6px 10px; border-radius: var(--timps-radius-sm);
  cursor: pointer; font-size: 11px;
  font-weight: 600;
}
.query-btn:hover { background: var(--timps-accent-hover); color: var(--timps-bg); }
.sources { margin-bottom: 10px; }
.source-row {
  display: flex; justify-content: space-between;
  padding: 4px 0; font-size: 11px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.source-name { color: var(--timps-text-muted); }
.source-count { color: var(--timps-accent); font-weight: 600; }
.results { max-height: 300px; overflow-y: auto; }
.result-item {
  background: var(--timps-bg2);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  padding: 8px; margin-bottom: 6px;
  transition: border-color 0.15s;
}
.result-item:hover { border-color: var(--timps-border-light); }
.result-gist { font-size: 11px; color: var(--timps-text); line-height: 1.4; }
.result-meta { font-size: 9px; color: var(--timps-text-muted); margin-top: 4px; display: flex; gap: 8px; font-family: var(--timps-font-mono); }
.refusal { text-align: center; padding: 12px; color: var(--timps-text-muted); font-style: italic; }
.graph-section { margin-top: 10px; }
.graph-node {
  display: inline-block;
  background: var(--timps-bg3);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  padding: 3px 6px;
  font-size: 10px;
  font-family: var(--timps-font-mono);
  margin: 2px;
  color: var(--timps-text-muted);
}
.graph-node.coding { border-color: var(--timps-accent); color: var(--timps-accent-hover); }
.refresh-btn {
  background: none; border: 1px solid var(--timps-border);
  color: var(--timps-text-muted); cursor: pointer;
  padding: 3px 8px; border-radius: var(--timps-radius-sm); font-size: 10px;
  margin-left: auto;
  font-family: var(--timps-font-mono);
  transition: all 0.15s;
}
.refresh-btn:hover { color: var(--timps-text); border-color: var(--timps-accent); }
</style>
</head>
<body>
<div class="header">
  <div class="header-logo">N</div>
  <span class="header-title">NexusForge Explorer</span>
  <button class="refresh-btn" onclick="refresh()">↻ Refresh</button>
</div>
<div class="stats-row" id="statsRow">
  <div class="stat"><div class="stat-val" id="nodeCount">0</div><div class="stat-label">Episodic Nodes</div></div>
  <div class="stat"><div class="stat-val" id="edgeCount">0</div><div class="stat-label">Temporal Edges</div></div>
  <div class="stat"><div class="stat-val" id="sourceCount">0</div><div class="stat-label">Sources</div></div>
</div>
<div class="query-box">
  <input class="query-input" id="queryInput" placeholder="Query episodic memory…" />
  <button class="query-btn" onclick="doQuery()">Search</button>
</div>
<div class="sources" id="sourcesSection"></div>
<div class="graph-section" id="graphSection"></div>
<div class="results" id="resultsSection"></div>
<script>
const vscode = acquireVsCodeApi();
window.addEventListener('message', ({ data }) => {
  if (data.type === 'data') {
    const s = data.stats || {};
    document.getElementById('nodeCount').textContent = s.totalNodes || 0;
    document.getElementById('edgeCount').textContent = s.totalEdges || 0;
    const srcs = s.sources || {};
    document.getElementById('sourceCount').textContent = Object.keys(srcs).length;
    const srcHtml = Object.entries(srcs).map(([k, v]) =>
      '<div class="source-row"><span class="source-name">' + esc(k) + '</span><span class="source-count">' + v + '</span></div>'
    ).join('');
    document.getElementById('sourcesSection').innerHTML = srcHtml ? '<div class="sources">' + srcHtml + '</div>' : '';
    const g = data.graph || {};
    const nodes = (g.nodes || []).slice(0, 20);
    const graphHtml = nodes.map(n =>
      '<span class="graph-node' + (n.isCoding ? ' coding' : '') + '">' + esc((n.gist || '').slice(0, 40)) + '</span>'
    ).join('');
    document.getElementById('graphSection').innerHTML = graphHtml ? '<div style="margin-bottom:10px"><div style="font-size:10px;color:#8B86A0;margin-bottom:4px">Recent Nodes:</div>' + graphHtml + '</div>' : '';
  }
  if (data.type === 'queryResult') {
    const r = data.results || [];
    const el = document.getElementById('resultsSection');
    if (data.refusal) {
      el.innerHTML = '<div class="refusal">No episodic matches found</div>';
      return;
    }
    if (r.length === 0) {
      el.innerHTML = '<div class="refusal">No results</div>';
      return;
    }
    el.innerHTML = r.map(r =>
      '<div class="result-item"><div class="result-gist">' + esc(r.gist || r.content || '').slice(0, 200) + '</div><div class="result-meta"><span>[' + esc(r.source_module || 'unknown') + ']</span><span>' + new Date(r.created_at || Date.now()).toLocaleDateString() + '</span><span>conf: ' + (r.confidence || 0.5).toFixed(2) + '</span></div></div>'
    ).join('');
  }
});
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function doQuery() {
  const q = document.getElementById('queryInput').value.trim();
  if (q) vscode.postMessage({ type: 'query', query: q });
}
function refresh() { vscode.postMessage({ type: 'refresh' }); }
document.getElementById('queryInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doQuery();
});
vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}
