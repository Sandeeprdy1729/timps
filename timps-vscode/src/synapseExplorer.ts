// ── SynapseMetabolon Explorer ──
// Visual spreading activation graph explorer for the TIMPS VSCode extension

import * as vscode from 'vscode';
import { getSynapseStats, getSynapseGraph, querySynapseMetabolon, runConsolidationCycle } from './synapseClient';
import { TIMPS_THEME, TIMPS_GLOBAL_RESET, TIMPS_ANIMATIONS } from './design-tokens';

export class SynapseMetabolonExplorerProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'timps.synapseMetabolonExplorer';
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
        case 'consolidate':
          this._handleConsolidate();
          break;
      }
    });
  }

  private async _loadData() {
    const [stats, graph] = await Promise.all([
      getSynapseStats(this._userId),
      getSynapseGraph(this._userId, 50),
    ]);
    this._view?.webview.postMessage({
      type: 'data',
      stats: stats || { totalNodes: 0, totalEdges: 0, layers: {}, avgActivation: 0 },
      graph: graph || { nodes: [], edges: [] },
    });
  }

  private async _handleQuery(query: string) {
    const result = await querySynapseMetabolon(query, this._userId);
    this._view?.webview.postMessage({
      type: 'queryResult',
      summary: result.summary || '',
      nodes: result.activatedNodes || [],
      confidence: result.confidence || 0,
      refusal: result.refusal,
      auditLog: result.auditLog || [],
    });
  }

  private async _handleConsolidate() {
    const result = await runConsolidationCycle(this._userId);
    this._view?.webview.postMessage({
      type: 'consolidateResult',
      result: result || { consolidated: 0, audited: 0, refreshed: 0, decayed: 0 },
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
<title>SynapseMetabolon Explorer</title>
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
.query-btn:hover { background: var(--timps-accent-hover); }
.layers { margin-bottom: 10px; }
.layer-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0; font-size: 11px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.layer-name { font-weight: 600; }
.layer-name.interaction { color: var(--timps-accent); }
.layer-name.reasoning { color: var(--timps-accent-hover); }
.layer-name.audit { color: var(--timps-text2); }
.layer-count { color: var(--timps-text-muted); }
.results { max-height: 300px; overflow-y: auto; }
.result-item {
  background: var(--timps-bg2);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  padding: 8px; margin-bottom: 6px;
  transition: border-color 0.15s;
}
.result-item:hover { border-color: var(--timps-border-light); }
.result-content { font-size: 11px; color: var(--timps-text); line-height: 1.4; }
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
.graph-node.interaction { border-color: var(--timps-accent); color: var(--timps-accent-hover); }
.graph-node.reasoning { border-color: var(--timps-accent-hover); color: var(--timps-accent); }
.graph-node.audit { border-color: var(--timps-text2); color: var(--timps-text2); }
.consolidate-btn {
  background: none; border: 1px solid var(--timps-border);
  color: var(--timps-text-muted); cursor: pointer;
  padding: 3px 8px; border-radius: var(--timps-radius-sm); font-size: 10px;
  font-family: var(--timps-font-mono);
  transition: all 0.15s;
}
.consolidate-btn:hover { color: var(--timps-text); border-color: var(--timps-accent); }
.refresh-btn {
  background: none; border: 1px solid var(--timps-border);
  color: var(--timps-text-muted); cursor: pointer;
  padding: 3px 8px; border-radius: var(--timps-radius-sm); font-size: 10px;
  margin-left: auto;
  font-family: var(--timps-font-mono);
  transition: all 0.15s;
}
.refresh-btn:hover { color: var(--timps-text); border-color: var(--timps-accent); }
.audit-log { font-size: 10px; color: var(--timps-text-muted); margin-top: 8px; padding: 6px; background: var(--timps-bg3); border-radius: var(--timps-radius-sm); font-family: var(--timps-font-mono); }
</style>
</head>
<body>
<div class="header">
  <div class="header-logo">S</div>
  <span class="header-title">SynapseMetabolon Explorer</span>
  <button class="consolidate-btn" onclick="consolidate()">Run Cycle</button>
  <button class="refresh-btn" onclick="refresh()">↻ Refresh</button>
</div>
<div class="stats-row" id="statsRow">
  <div class="stat"><div class="stat-val" id="nodeCount">0</div><div class="stat-label">Metabolic Nodes</div></div>
  <div class="stat"><div class="stat-val" id="edgeCount">0</div><div class="stat-label">Relational Edges</div></div>
  <div class="stat"><div class="stat-val" id="avgAct">0</div><div class="stat-label">Avg Activation</div></div>
</div>
<div class="layers" id="layersSection"></div>
<div class="query-box">
  <input class="query-input" id="queryInput" placeholder="Query metabolic graph…" />
  <button class="query-btn" onclick="doQuery()">Search</button>
</div>
<div class="graph-section" id="graphSection"></div>
<div class="results" id="resultsSection"></div>
<div class="audit-log" id="auditLog" style="display:none"></div>
<script>
const vscode = acquireVsCodeApi();
window.addEventListener('message', ({ data }) => {
  if (data.type === 'data') {
    const s = data.stats || {};
    document.getElementById('nodeCount').textContent = s.totalNodes || 0;
    document.getElementById('edgeCount').textContent = s.totalEdges || 0;
    document.getElementById('avgAct').textContent = (s.avgActivation || 0).toFixed(2);
    const layers = s.layers || {};
    const layerHtml = Object.entries(layers).map(([k, v]) => {
      const c = v.count || 0;
      const a = (v.avgActivation || 0).toFixed(2);
      return '<div class="layer-row"><span class="layer-name ' + k + '">' + k + '</span><span class="layer-count">' + c + ' nodes (act: ' + a + ')</span></div>';
    }).join('');
    document.getElementById('layersSection').innerHTML = layerHtml ? layerHtml : '';
    const g = data.graph || {};
    const nodes = (g.nodes || []).slice(0, 20);
    const graphHtml = nodes.map(n =>
      '<span class="graph-node ' + (n.isCoding ? 'coding' : n.layer) + '">' + esc((n.content || '').slice(0, 30)) + ' [act:' + (n.activation || 0).toFixed(2) + ']</span>'
    ).join('');
    document.getElementById('graphSection').innerHTML = graphHtml ? '<div style="margin-bottom:10px"><div style="font-size:10px;color:#8B86A0;margin-bottom:4px">Active Nodes:</div>' + graphHtml + '</div>' : '';
  }
  if (data.type === 'queryResult') {
    const nodes = data.nodes || [];
    const el = document.getElementById('resultsSection');
    const auditEl = document.getElementById('auditLog');
    if (data.refusal) {
      el.innerHTML = '<div class="refusal">No metabolic matches found</div>';
      auditEl.style.display = 'none';
      return;
    }
    if (nodes.length === 0) {
      el.innerHTML = '<div class="refusal">No results</div>';
      auditEl.style.display = 'none';
      return;
    }
    el.innerHTML = nodes.map(n =>
      '<div class="result-item"><div class="result-content">' + esc((n.content || '').slice(0, 160)) + '</div><div class="result-meta"><span>[' + esc(n.layer || 'unknown') + ']</span><span>act: ' + (n.activation || 0).toFixed(2) + '</span><span>' + esc(n.sourceModule || '') + '</span></div></div>'
    ).join('');
    if (data.auditLog && data.auditLog.length > 0) {
      auditEl.style.display = 'block';
      auditEl.textContent = 'Path: ' + data.auditLog.join(' → ');
    } else {
      auditEl.style.display = 'none';
    }
  }
  if (data.type === 'consolidateResult') {
    const r = data.result || {};
    const el = document.getElementById('resultsSection');
    el.innerHTML = '<div class="result-item"><div class="result-content">Consolidation complete: ' + r.consolidated + ' consolidated, ' + r.audited + ' audited, ' + r.refreshed + ' refreshed, ' + r.decayed + ' decayed</div></div>';
    setTimeout(refresh, 1000);
  }
});
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function doQuery() {
  const q = document.getElementById('queryInput').value.trim();
  if (q) vscode.postMessage({ type: 'query', query: q });
}
function refresh() { vscode.postMessage({ type: 'refresh' }); }
function consolidate() { vscode.postMessage({ type: 'consolidate' }); }
document.getElementById('queryInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doQuery();
});
vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}
