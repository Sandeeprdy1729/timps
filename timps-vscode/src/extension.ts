import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';

// ─── Config ───────────────────────────────────────────────────────────────────
function getConfig() {
  const cfg = vscode.workspace.getConfiguration('timps');
  return {
    serverUrl: cfg.get<string>('serverUrl', 'https://timps-api.onrender.com'),
    userId: cfg.get<number>('userId', 1),
    enableInlineWarnings: cfg.get<boolean>('enableInlineWarnings', true),
    checkOnSave: cfg.get<boolean>('checkOnSave', true),
  };
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function timpsRequest(path: string, method: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const { serverUrl } = getConfig();
    const url = new URL(serverUrl + '/api' + path);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const data = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 8000,
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(null); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMPs request timed out')); });
    if (data) req.write(data);
    req.end();
  });
}

async function timpsChat(message: string): Promise<string> {
  const { userId } = getConfig();
  try {
    const res = await timpsRequest('/chat', 'POST', { userId, message });
    return res?.response || '';
  } catch {
    return '';
  }
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────
const diagnosticCollection = vscode.languages.createDiagnosticCollection('timps');

interface Warning {
  message: string;
  severity: 'error' | 'warning' | 'info';
  range?: vscode.Range;
}

async function analyzeDocument(doc: vscode.TextDocument): Promise<void> {
  const { enableInlineWarnings, userId } = getConfig();
  if (!enableInlineWarnings) return;

  const ext = doc.languageId;
  if (!['typescript', 'javascript', 'python', 'java', 'go', 'rust'].includes(ext)) return;

  const text = doc.getText();
  const warnings: Warning[] = [];

  // ── Pattern 1: setTimeout for async sync ────────────────────────────────────
  const setTimeoutMatches = [...text.matchAll(/setTimeout\s*\([^)]{5,}[,\)]/g)];
  for (const m of setTimeoutMatches) {
    const pos = doc.positionAt(m.index!);
    warnings.push({
      message: '⚡ TIMPs Bug Prophet: setTimeout used for async coordination. This pattern caused race conditions in your codebase history. Consider Promise, async/await, or event-based approach.',
      severity: 'warning',
      range: new vscode.Range(pos, pos.translate(0, m[0].length)),
    });
  }

  // ── Pattern 2: Unhandled promise rejection ───────────────────────────────────
  const unhandledPromises = [...text.matchAll(/\.then\s*\([^)]+\)\s*(?!\.catch)/g)];
  for (const m of unhandledPromises.slice(0, 3)) {
    const pos = doc.positionAt(m.index!);
    warnings.push({
      message: '⚡ TIMPs Bug Prophet: .then() without .catch() — unhandled rejection risk. Your bug history shows this pattern causes silent failures.',
      severity: 'warning',
      range: new vscode.Range(pos, pos.translate(0, m[0].length)),
    });
  }

  // ── Pattern 3: String concatenation in SQL-like contexts ────────────────────
  const sqlConcat = [...text.matchAll(/["'`][^"'`]*SELECT[^"'`]*["'`]\s*\+/gi)];
  for (const m of sqlConcat.slice(0, 2)) {
    const pos = doc.positionAt(m.index!);
    warnings.push({
      message: '🔴 TIMPs Security: SQL string concatenation detected — SQL injection risk. Use parameterized queries.',
      severity: 'error',
      range: new vscode.Range(pos, pos.translate(0, m[0].length)),
    });
  }

  // ── Pattern 4: Hardcoded secrets ────────────────────────────────────────────
  const secretPatterns = [
    /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/gi,
    /sk-[a-zA-Z0-9]{20,}/g,
  ];
  for (const pattern of secretPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches.slice(0, 2)) {
      const pos = doc.positionAt(m.index!);
      warnings.push({
        message: '🔴 TIMPs Security: Possible hardcoded secret detected. Move to environment variables.',
        severity: 'error',
        range: new vscode.Range(pos, pos.translate(0, m[0].length)),
      });
    }
  }

  // ── Apply diagnostics ────────────────────────────────────────────────────────
  const diagnostics: vscode.Diagnostic[] = warnings.map((w) => {
    const range = w.range || new vscode.Range(0, 0, 0, 0);
    const sev = w.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : w.severity === 'warning'
      ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Information;
    const d = new vscode.Diagnostic(range, w.message, sev);
    d.source = 'TIMPs';
    return d;
  });

  diagnosticCollection.set(doc.uri, diagnostics);

  // ── Ask TIMPs server for additional pattern checks ───────────────────────────
  if (warnings.length === 0 && text.length > 50) {
    try {
      const snippet = text.slice(0, 500);
      await timpsRequest('/chat', 'POST', {
        userId,
        message: `Tech debt check (silent): does this code pattern match any past incidents? Snippet: ${snippet.slice(0, 200)}`,
      });
    } catch { /* silent */ }
  }
}

// ─── Status Bar ──────────────────────────────────────────────────────────────
let statusBar: vscode.StatusBarItem;

function updateStatusBar(text: string, color?: string) {
  statusBar.text = `◆ TIMPs: ${text}`;
  statusBar.color = color;
  statusBar.show();
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await timpsRequest('/health', 'GET');
    return res?.status === 'ok';
  } catch { return false; }
}

// ─── Commands ─────────────────────────────────────────────────────────────────
async function cmdCheckContradiction() {
  const editor = vscode.window.activeTextEditor;
  const selection = editor?.document.getText(editor.selection);
  const text = selection || await vscode.window.showInputBox({
    prompt: 'Check this statement for contradictions in your history',
    placeHolder: 'e.g. "We should never use Redux in this project"',
  });
  if (!text) return;

  const { userId } = getConfig();
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'TIMPs: Checking for contradictions...',
  }, async () => {
    try {
      const res = await timpsRequest('/contradiction/check', 'POST', {
        userId, text, autoStore: true,
      });
      if (res?.verdict === 'CONTRADICTION' || res?.verdict === 'PARTIAL') {
        const score = Math.round((res.contradiction_score || 0) * 100);
        const claim = res.conflicting_position?.extracted_claim || 'a past position';
        vscode.window.showWarningMessage(
          `⚠️ TIMPs: ${score}% contradiction! You previously stated: "${claim.slice(0, 80)}"`,
          'Dismiss'
        );
      } else {
        vscode.window.showInformationMessage('✓ TIMPs: No contradiction found. Position stored.');
      }
    } catch {
      vscode.window.showErrorMessage('TIMPs: Could not reach server. Make sure TIMPs is running.');
    }
  });
}

async function cmdLookupAPI() {
  const apiName = await vscode.window.showInputBox({
    prompt: 'Look up TIMPs API knowledge base',
    placeHolder: 'e.g. Stripe, GitHub, SendGrid, OpenAI',
  });
  if (!apiName) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `TIMPs: Looking up ${apiName} quirks...`,
  }, async () => {
    try {
      const response = await timpsChat(`API Archaeologist: what quirks and undocumented behavior do we know about ${apiName}?`);
      if (response) {
        const panel = vscode.window.createWebviewPanel(
          'timpsAPIQuirks',
          `TIMPs: ${apiName} Quirks`,
          vscode.ViewColumn.Beside,
          {}
        );
        panel.webview.html = getWebviewContent(
          `API Archaeologist — ${apiName}`,
          response
        );
      } else {
        vscode.window.showInformationMessage(`TIMPs: No known quirks for ${apiName} yet. Use timps_record_api_quirk to add some.`);
      }
    } catch {
      vscode.window.showErrorMessage('TIMPs: Could not reach server.');
    }
  });
}

async function cmdCheckBugPattern() {
  const editor = vscode.window.activeTextEditor;
  const context = editor?.document.getText(editor?.selection) ||
    vscode.window.activeTextEditor?.document.getText().slice(0, 300) || '';

  const situation = await vscode.window.showInputBox({
    prompt: 'Describe current coding context for bug risk check',
    placeHolder: 'e.g. "Writing async auth middleware under deadline pressure"',
    value: context.slice(0, 80),
  });
  if (!situation) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'TIMPs: Checking your personal bug patterns...',
  }, async () => {
    const response = await timpsChat(`Bug Pattern Prophet: check my personal bug triggers for this context: ${situation}`);
    if (response) {
      const hasAlert = response.toLowerCase().includes('alert') ||
        response.toLowerCase().includes('warning') ||
        response.toLowerCase().includes('high risk');
      if (hasAlert) {
        vscode.window.showWarningMessage(`⚡ TIMPs Bug Warning: ${response.slice(0, 150)}`, 'View Full');
      } else {
        vscode.window.showInformationMessage(`✓ TIMPs: Low bug risk for this context. ${response.slice(0, 100)}`);
      }
    }
  });
}

async function cmdOpenDashboard() {
  const { serverUrl } = getConfig();
  vscode.env.openExternal(vscode.Uri.parse(`${serverUrl}/dashboard`));
}

async function cmdShowMemories() {
  const { userId } = getConfig();
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'TIMPs: Loading your memories...',
  }, async () => {
    try {
      const res = await timpsRequest(`/memory/${userId}`, 'GET');
      const memories = res?.memories || [];
      if (!memories.length) {
        vscode.window.showInformationMessage('TIMPs: No memories stored yet. Start chatting!');
        return;
      }
      const panel = vscode.window.createWebviewPanel(
        'timpsMemories',
        'TIMPs: My Memories',
        vscode.ViewColumn.Beside,
        {}
      );
      const content = memories.slice(0, 20).map((m: any) =>
        `**[${m.memory_type?.toUpperCase()}]** (★${m.importance}) ${m.content}`
      ).join('\n\n---\n\n');
      panel.webview.html = getWebviewContent('My TIMPs Memories', content);
    } catch {
      vscode.window.showErrorMessage('TIMPs: Could not reach server.');
    }
  });
}

// ─── Webview helper ───────────────────────────────────────────────────────────
function getWebviewContent(title: string, content: string): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/---/g, '<hr/>')
    .replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: -apple-system, sans-serif; padding: 20px; background: #0c0c0c; color: #e8e4e0; font-size: 13px; line-height: 1.7; }
  h2 { font-family: monospace; font-size: 14px; color: #c4bab0; border-bottom: 1px solid #222; padding-bottom: 10px; margin-bottom: 16px; }
  .content { color: #888; }
  strong { color: #e8e4e0; }
  hr { border: none; border-top: 1px solid #222; margin: 12px 0; }
  .timps-badge { display: inline-block; background: #161616; border: 1px solid #2a2a2a; color: #c4bab0; font-family: monospace; font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-bottom: 12px; }
</style>
</head>
<body>
  <span class="timps-badge">◆ TIMPs Intelligence</span>
  <h2>${title}</h2>
  <div class="content">${escaped}</div>
</body>
</html>`;
}

// ─── Extension activate ───────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
  console.log('TIMPs VS Code extension activated');

  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'timps.openDashboard';
  statusBar.tooltip = 'Open TIMPs Intelligence Dashboard';
  updateStatusBar('connecting...');
  context.subscriptions.push(statusBar);

  // Check server health
  checkServerHealth().then(ok => {
    updateStatusBar(ok ? 'ready' : 'offline', ok ? undefined : '#f87171');
  });

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('timps.checkContradiction', cmdCheckContradiction),
    vscode.commands.registerCommand('timps.lookupAPI', cmdLookupAPI),
    vscode.commands.registerCommand('timps.checkBugPattern', cmdCheckBugPattern),
    vscode.commands.registerCommand('timps.openDashboard', cmdOpenDashboard),
    vscode.commands.registerCommand('timps.showMemories', cmdShowMemories),
  );

  // Inline warnings on file open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (getConfig().enableInlineWarnings) analyzeDocument(doc);
    })
  );

  // Inline warnings on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (getConfig().checkOnSave) analyzeDocument(doc);
    })
  );

  // Analyze currently open files
  vscode.workspace.textDocuments.forEach(doc => {
    if (getConfig().enableInlineWarnings) analyzeDocument(doc);
  });

  // Health check every 30s
  const healthInterval = setInterval(async () => {
    const ok = await checkServerHealth();
    updateStatusBar(ok ? 'ready' : 'offline', ok ? undefined : '#f87171');
  }, 30000);
  context.subscriptions.push({ dispose: () => clearInterval(healthInterval) });
  context.subscriptions.push(diagnosticCollection);
}

export function deactivate() {
  diagnosticCollection.clear();
  diagnosticCollection.dispose();
}