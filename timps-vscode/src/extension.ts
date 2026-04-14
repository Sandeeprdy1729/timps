// extension.ts - TIMPs VS Code Extension (Claude Code / OpenCode style)
// Full AI coding agent with terminal, chat, inline edits, and project context

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess, execSync } from 'child_process';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TIMPsConfig {
  useLocalAgent: boolean;
  localModel: string;
  ollamaUrl: string;
  autoInstall: boolean;
  enableDiagnostics: boolean;
  agentMode: 'terminal' | 'chat' | 'inline';
}

function getConfig(): TIMPsConfig {
  const cfg = vscode.workspace.getConfiguration('timps');
  return {
    useLocalAgent: cfg.get<boolean>('useLocalAgent', true),
    localModel: cfg.get<string>('localModel', 'sandeeprdy1729/timps-coder'),
    ollamaUrl: cfg.get<string>('ollamaUrl', 'http://localhost:11434'),
    autoInstall: cfg.get<boolean>('autoInstall', true),
    enableDiagnostics: cfg.get<boolean>('enableDiagnostics', true),
    agentMode: cfg.get<'terminal' | 'chat' | 'inline'>('agentMode', 'terminal'),
  };
}

// ─── Terminal Manager ─────────────────────────────────────────────────────────
let timpsTerminal: vscode.Terminal | undefined;
let timpsProcess: ChildProcess | undefined;

function createTIMPsEnvironment(): { cwd: string; env: NodeJS.ProcessEnv } {
  const config = getConfig();
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  
  return {
    cwd,
    env: {
      ...process.env,
      OLLAMA_BASE_URL: config.ollamaUrl,
      DEFAULT_MODEL: config.localModel,
      TIMPS_USE_LOCAL: config.useLocalAgent ? '1' : '0',
      TIMPS_MODEL: config.localModel,
    }
  };
}

function getTIMPsTerminal(): vscode.Terminal {
  if (timpsTerminal && !timpsTerminal.exitStatus) {
    timpsTerminal.show();
    return timpsTerminal;
  }
  
  const { cwd, env } = createTIMPsEnvironment();
  
  timpsTerminal = vscode.window.createTerminal({
    name: 'TIMPs',
    iconPath: vscode.Uri.parse('https://timps.ai/icon.png'),
    cwd,
    env,
  });
  
  timpsTerminal.show();
  return timpsTerminal;
}

function findTIMPsExecutable(): string | null {
  const searchPaths = [
    // Local paths
    path.join(process.cwd(), 'node_modules', '.bin', 'timps'),
    path.join(process.cwd(), 'node_modules', '.bin', 'timps.cmd'),
    // Global npm
    path.join(os.homedir(), '.npm', 'timps', 'bin', 'timps.js'),
    path.join(os.homedir(), '.nvm', 'versions', 'node', '*', 'bin', 'timps'),
    // Global npx
    'npx',
    // Direct npm
    'npm',
    // Common global paths
    path.join(os.homedir(), '.local', 'bin', 'timps'),
    '/usr/local/bin/timps',
    '/usr/bin/timps',
  ];
  
  // Check if npx/npm is available
  try {
    execSync('npx --version', { stdio: 'pipe' });
    return 'npx';
  } catch {
    // Check for direct npm
    try {
      execSync('npm --version', { stdio: 'pipe' });
      return 'npm';
    } catch {
      return null;
    }
  }
}

function buildTIMPsCommand(): string[] {
  const config = getConfig();
  const cmd: string[] = [];
  const executable = findTIMPsExecutable();
  
  if (executable === 'npx') {
    cmd.push('npx', '-y', 'timps-ai');
  } else if (executable === 'npm') {
    cmd.push('npx', '-y', 'timps-ai');
  } else {
    cmd.push(executable);
  }
  
  if (config.useLocalAgent) {
    cmd.push('--provider', 'ollama');
    cmd.push('--model', config.localModel);
  }
  
  return cmd;
}

function runTIMPsInteractive(): void {
  const terminal = getTIMPsTerminal();
  const { cwd } = createTIMPsEnvironment();
  
  // Update terminal cwd
  terminal.sendText(`cd "${cwd}"${os.EOL}`);
  
  // Build command
  const cmd = buildTIMPsCommand();
  
  // Show startup message
  terminal.sendText(`echo "Starting TIMPs with ${getConfig().localModel}..."${os.EOL}`);
  terminal.sendText(`${cmd.join(' ')}${os.EOL}`);
}

function runTIMPsCommand(command: string): void {
  const terminal = getTIMPsTerminal();
  const cmd = buildTIMPsCommand();
  
  if (command.trim()) {
    terminal.sendText(`${cmd.join(' ')} --one-line "${command.replace(/"/g, '\\"')}"${os.EOL}`);
  } else {
    terminal.sendText(`${cmd.join(' ')}${os.EOL}`);
  }
}

// ─── Chat Panel (like Claude Code) ───────────────────────────────────────────
class TIMPsChatView {
  private panel: vscode.WebviewPanel | undefined;
  private messages: Array<{role: string; content: string}> = [];

  constructor() {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'timpsChat',
      'TIMPs Chat',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, localResourceRoots: [] }
    );

    this.panel.webview.html = this.getWebviewContent();
    
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'send') {
        await this.handleMessage(msg.text);
      } else if (msg.command === 'clear') {
        this.messages = [];
        this.updateWebview();
      } else if (msg.command === 'openFile') {
        const doc = await vscode.workspace.openTextDocument(msg.path);
        vscode.window.showTextDocument(doc);
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async handleMessage(text: string): Promise<void> {
    this.messages.push({ role: 'user', content: text });
    this.updateWebview();

    // Show typing indicator
    this.messages.push({ role: 'assistant', content: '...' });
    this.updateWebview();

    try {
      const response = await this.callTIMPsAPI(text);
      this.messages.pop(); // Remove typing indicator
      this.messages.push({ role: 'assistant', content: response });
    } catch (e: any) {
      this.messages.pop();
      this.messages.push({ role: 'assistant', content: `Error: ${e.message}` });
    }
    
    this.updateWebview();
  }

  private async callTIMPsAPI(message: string): Promise<string> {
    const config = getConfig();
    
    if (config.useLocalAgent) {
      // Call TIMPs CLI
      return new Promise((resolve) => {
        const cmd = buildTIMPsCommand();
        const proc = spawn(cmd[0], [...cmd.slice(1), '--one-line', message], {
          cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
          env: createTIMPsEnvironment().env,
        });
        
        let output = '';
        proc.stdout?.on('data', (d) => { output += d.toString(); });
        proc.stderr?.on('data', (d) => { output += d.toString(); });
        proc.on('close', () => resolve(output.trim() || 'TIMPs completed.'));
        proc.on('error', () => resolve('TIMPs not available.'));
        
        setTimeout(() => {
          proc.kill();
          resolve('TIMPs timed out.');
        }, 60000);
      });
    }
    
    return 'Configure TIMPs to use local agent mode.';
  }

  private updateWebview(): void {
    if (!this.panel) return;
    
    this.panel.webview.postMessage({
      command: 'update',
      messages: this.messages,
    });
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #ccc; height: 100vh; display: flex; flex-direction: column; }
.header { background: #2d2d2d; padding: 12px 16px; border-bottom: 1px solid #3e3e42; display: flex; justify-content: space-between; align-items: center; }
.header h1 { color: #4ec9b0; font-size: 14px; }
.header .controls { display: flex; gap: 8px; }
.header button { background: #3e3e42; border: none; color: #ccc; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.header button:hover { background: #4e4e4e; }
.messages { flex: 1; overflow-y: auto; padding: 16px; }
.msg { margin-bottom: 12px; padding: 10px 12px; border-radius: 8px; max-width: 90%; }
.msg.user { background: #0e639c; color: white; margin-left: auto; }
.msg.assistant { background: #2d2d2d; border: 1px solid #3e3e42; }
.msg .role { font-size: 10px; text-transform: uppercase; margin-bottom: 4px; opacity: 0.7; }
.msg .content { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
.msg pre { background: #1e1e1e; padding: 8px; border-radius: 4px; overflow-x: auto; margin: 8px 0; }
.input-area { background: #2d2d2d; padding: 12px 16px; border-top: 1px solid #3e3e42; }
.input-row { display: flex; gap: 8px; }
input { flex: 1; background: #3e3e42; border: 1px solid #3e3e42; color: white; padding: 10px 12px; border-radius: 6px; font-size: 13px; }
input:focus { outline: none; border-color: #4ec9b0; }
button.send { background: #4ec9b0; border: none; color: #1e1e1e; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
button.send:hover { background: #5fd9c0; }
.typing { animation: pulse 1s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
</head>
<body>
<div class="header">
  <h1>TIMPs AI Assistant</h1>
  <div class="controls">
    <button onclick="clearChat()">Clear</button>
    <button onclick="openTerminal()">Terminal</button>
  </div>
</div>
<div class="messages" id="messages"></div>
<div class="input-area">
  <div class="input-row">
    <input type="text" id="input" placeholder="Ask TIMPs to help with your code..." onkeypress="if(event.key==='Enter')send()">
    <button class="send" onclick="send()">Send</button>
  </div>
</div>
<script>
const vscode = acquireVsCodeApi();
let messages = [];

function send() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  vscode.postMessage({ command: 'send', text });
}

function clearChat() {
  vscode.postMessage({ command: 'clear' });
}

function openTerminal() {
  vscode.postMessage({ command: 'openTerminal' });
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render() {
  const el = document.getElementById('messages');
  el.innerHTML = messages.map(m => {
    const isTyping = m.content === '...' && m.role === 'assistant';
    return '<div class="msg ' + m.role + '">' +
      '<div class="role">' + (m.role === 'user' ? 'You' : 'TIMPs') + '</div>' +
      '<div class="content' + (isTyping ? ' typing' : '') + '">' + escapeHtml(m.content) + '</div>' +
    '</div>';
  }).join('');
  el.scrollTop = el.scrollHeight;
}

window.addEventListener('message', e => {
  if (e.data.command === 'update') {
    messages = e.data.messages;
    render();
  }
});

document.getElementById('input').focus();
</script>
</body>
</html>`;
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}

const chatView = new TIMPsChatView();

// ─── Inline Edit Provider (like Claude Code) ──────────────────────────────────
class TIMPsInlineEditProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {
    return null; // TIMPs doesn't use inline completion, uses chat/terminal instead
  }
}

// ─── Setup & Installation ──────────────────────────────────────────────────────
async function checkOllamaInstalled(): Promise<boolean> {
  try {
    execSync('ollama --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function checkModelInstalled(model: string): Promise<boolean> {
  try {
    const output = execSync('ollama list', { encoding: 'utf-8' });
    const shortName = model.includes('/') ? model.split('/').pop() : model;
    return output.includes(shortName || model);
  } catch {
    return false;
  }
}

async function installOllama(): Promise<boolean> {
  const platform = os.platform();
  const installCmd = platform === 'darwin' 
    ? 'brew install ollama'
    : 'curl -fsSL https://ollama.com/install.sh | sh';

  const choice = await vscode.window.showInformationMessage(
    'TIMPs requires Ollama for local AI. Install it now?',
    'Install Ollama', 'Use Cloud API', 'Cancel'
  );

  if (choice === 'Install Ollama') {
    const terminal = vscode.window.createTerminal({ name: 'Install Ollama' });
    terminal.show();
    terminal.sendText(installCmd + os.EOL);
    return true;
  } else if (choice === 'Use Cloud API') {
    const config = vscode.workspace.getConfiguration('timps');
    await config.update('useLocalAgent', false, true);
    return false;
  }
  return false;
}

async function installModel(model: string): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    `Download "${model}" for local AI? This takes a few minutes.`,
    'Download', 'Cancel'
  );

  if (choice === 'Download') {
    vscode.window.showInformationMessage(`Downloading ${model}... Check terminal.`);
    const terminal = vscode.window.createTerminal({ name: 'Pull Model' });
    terminal.show();
    terminal.sendText(`ollama pull ${model}${os.EOL}`);
  }
}

async function ensureSetup(): Promise<void> {
  const config = getConfig();
  if (!config.autoInstall) return;

  // Check Ollama
  const ollamaOk = await checkOllamaInstalled();
  if (!ollamaOk) {
    const installed = await installOllama();
    if (!installed) return;
  }

  // Check model
  if (config.useLocalAgent) {
    const modelOk = await checkModelInstalled(config.localModel);
    if (!modelOk) {
      await installModel(config.localModel);
    }
  }
}

// ─── Command Handlers ─────────────────────────────────────────────────────────
function openTIMPs(): void {
  runTIMPsInteractive();
}

function newTIMPsSession(): void {
  if (timpsTerminal) {
    timpsTerminal.dispose();
    timpsTerminal = undefined;
  }
  runTIMPsInteractive();
}

function openTIMPsChat(): void {
  chatView.show();
}

function shareSelection(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const fileName = path.basename(editor.document.fileName);

  if (selectedText) {
    vscode.env.clipboard.writeText(selectedText);
    const terminal = getTIMPsTerminal();
    terminal.show();
    terminal.sendText(`# File: ${fileName} (lines ${selection.start.line + 1}-${selection.end.line + 1})${os.EOL}`);
  } else {
    // Share entire file
    const terminal = getTIMPsTerminal();
    terminal.show();
    terminal.sendText(`# Reading: ${fileName}${os.EOL}`);
    terminal.sendText(`cat "${editor.document.fileName}"${os.EOL}`);
  }
}

function insertFileRef(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const fileName = path.basename(editor.document.fileName);
  const line = editor.selection.active.line + 1;
  const ref = `@${fileName}#L${line}`;

  editor.edit(editBuilder => {
    editBuilder.insert(editor.selection.active, ref);
  });
}

function explainCode(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const fileName = path.basename(editor.document.fileName);

  if (selectedText) {
    runTIMPsCommand(`/explain This code from ${fileName}: ${selectedText}`);
  } else {
    vscode.window.showInformationMessage('Select code to explain');
  }
}

function refactorCode(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const fileName = path.basename(editor.document.fileName);

  if (selectedText) {
    runTIMPsCommand(`/refactor Refactor this code from ${fileName}: ${selectedText}`);
  } else {
    vscode.window.showInformationMessage('Select code to refactor');
  }
}

function writeTests(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const fileName = path.basename(editor.document.fileName);

  if (selectedText) {
    runTIMPsCommand(`/test Write tests for ${fileName}: ${selectedText}`);
  } else {
    vscode.window.showInformationMessage('Select code to test');
  }
}

function fixBug(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  const fileName = path.basename(editor.document.fileName);

  if (selectedText) {
    runTIMPsCommand(`/fix Fix bugs in ${fileName}: ${selectedText}`);
  } else {
    vscode.window.showInformationMessage('Select code with bugs');
  }
}

async function showStatus(): Promise<void> {
  const config = getConfig();
  const ollamaOk = await checkOllamaInstalled();
  const modelOk = await checkModelInstalled(config.localModel);

  const status = [
    `TIMPs Configuration:`,
    ``,
    `Mode: ${config.useLocalAgent ? 'Local Agent' : 'Cloud API'}`,
    `Model: ${config.localModel}`,
    `Ollama: ${ollamaOk ? 'Installed' : 'Not installed'}`,
    `Model: ${modelOk ? 'Available' : 'Not downloaded'}`,
  ].join('\n');

  vscode.window.showInformationMessage(status);
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
const diagnosticCollection = vscode.languages.createDiagnosticCollection('timps');

function analyzeDocument(doc: vscode.TextDocument): void {
  const config = getConfig();
  if (!config.enableDiagnostics) return;

  const text = doc.getText();
  const warnings: vscode.Diagnostic[] = [];

  // Simple pattern matching for common issues
  const patterns = [
    { regex: /\.then\s*\([^)]+\)\s*(?!\.catch)/g, msg: 'TIMPs: Unhandled promise - add .catch()' },
    { regex: /console\.log\s*\(\s*\w+\s*\)/g, msg: 'TIMPs: Console.log found - remove before commit' },
    { regex: /debugger\s*;/g, msg: 'TIMPs: Debugger statement found' },
    { regex: /(api[_-]?key|password|secret|token)\s*[=:]\s*["'][^"']+["']/gi, msg: 'TIMPs: Potential secret - use environment variable' },
    { regex: /TODO\s*:/gi, msg: 'TIMPs: TODO comment found' },
  ];

  for (const p of patterns) {
    let match;
    const regex = new RegExp(p.regex.source, p.regex.flags);
    while ((match = regex.exec(text)) !== null) {
      const pos = doc.positionAt(match.index);
      warnings.push({
        message: p.msg,
        range: new vscode.Range(pos, pos.translate(0, match[0].length)),
        severity: vscode.DiagnosticSeverity.Information,
        source: 'TIMPs',
      });
    }
  }

  diagnosticCollection.set(doc.uri, warnings);
}

// ─── Status Bar ───────────────────────────────────────────────────────────────
let statusBar: vscode.StatusBarItem;

function updateStatusBar(): void {
  const config = getConfig();
  statusBar.text = `$(ai) TIMPs: ${config.useLocalAgent ? config.localModel.split('/').pop() : 'API'}`;
  statusBar.tooltip = `TIMPs ${config.useLocalAgent ? 'Local' : 'Cloud'}\nClick to open`;
  statusBar.command = 'timps.open';
}

// ─── Extension Activation ─────────────────────────────────────────────────────
export async function activate(context: vscode.ExtensionContext) {
  console.log('TIMPs activating...');

  // Register commands
  const commands = [
    { cmd: 'timps.open', name: 'Open TIMPs', handler: openTIMPs },
    { cmd: 'timps.newSession', name: 'New TIMPs Session', handler: newTIMPsSession },
    { cmd: 'timps.chat', name: 'Open TIMPs Chat', handler: openTIMPsChat },
    { cmd: 'timps.share', name: 'Share with TIMPs', handler: shareSelection },
    { cmd: 'timps.ref', name: 'Insert File Reference', handler: insertFileRef },
    { cmd: 'timps.explain', name: 'TIMPs: Explain Code', handler: explainCode },
    { cmd: 'timps.refactor', name: 'TIMPs: Refactor Code', handler: refactorCode },
    { cmd: 'timps.test', name: 'TIMPs: Write Tests', handler: writeTests },
    { cmd: 'timps.fix', name: 'TIMPs: Fix Bug', handler: fixBug },
    { cmd: 'timps.status', name: 'TIMPs: Status', handler: showStatus },
    { cmd: 'timps.setup', name: 'TIMPs: Setup', handler: ensureSetup },
  ];

  for (const { cmd, name, handler } of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(cmd, handler)
    );
  }

  // Status bar
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = '$(ai) TIMPs';
  statusBar.command = 'timps.open';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Setup check
  ensureSetup();

  // Analyze open documents
  vscode.workspace.textDocuments.forEach(analyzeDocument);

  // Watch for changes
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(analyzeDocument),
    vscode.workspace.onDidOpenTextDocument(analyzeDocument)
  );

  // Config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('timps')) {
        updateStatusBar();
      }
    })
  );

  // Welcome message
  const action = await vscode.window.showInformationMessage(
    'TIMPs AI Agent ready! Press Cmd+Esc to start coding with AI.',
    'Open TIMPs', 'Setup Now'
  );

  if (action === 'Open TIMPs') openTIMPs();
  if (action === 'Setup Now') ensureSetup();

  // Register inline completion provider
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**/*' },
      new TIMPsInlineEditProvider()
    )
  );

  console.log('TIMPs activated!');
}

export function deactivate() {
  chatView.dispose();
  if (timpsTerminal) timpsTerminal.dispose();
  if (timpsProcess) timpsProcess.kill();
  diagnosticCollection.clear();
  diagnosticCollection.dispose();
}
