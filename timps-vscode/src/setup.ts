// ============================================================
// TIMPS Auto-Setup — checks Ollama + pulls TIMPS-Coder
// ============================================================
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { checkOllamaRunning, checkModelExists, pullModel } from './ollama';
import { SetupStatus } from './types';

const execAsync = promisify(exec);

async function isOllamaInstalled(): Promise<boolean> {
    try { await execAsync('which ollama'); return true; } catch {}
    try { await execAsync('where ollama'); return true; } catch {}
    return false;
}

export async function getSetupStatus(ollamaUrl: string, modelName: string): Promise<SetupStatus> {
    const installed = await isOllamaInstalled();
    let running = false, modelAvailable = false;
    if (installed) running = await checkOllamaRunning(ollamaUrl).catch(() => false);
    if (running) modelAvailable = await checkModelExists(ollamaUrl, modelName).catch(() => false);
    return { ollamaInstalled: installed, ollamaRunning: running, modelAvailable, modelName };
}

export async function autoSetup(context: vscode.ExtensionContext, status: SetupStatus, modelName: string) {
    if (!status.ollamaInstalled) {
        const choice = await vscode.window.showInformationMessage(
            '⚡ TIMPS needs Ollama to run TIMPS-Coder locally (free, no API key).',
            'Download Ollama', 'Dismiss'
        );
        if (choice === 'Download Ollama') vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
        return;
    }
    if (!status.ollamaRunning) {
        const choice = await vscode.window.showWarningMessage(
            '⚡ TIMPS: Ollama not running. Start it to use TIMPS-Coder.',
            'Start Ollama', 'Dismiss'
        );
        if (choice === 'Start Ollama') {
            const t = vscode.window.createTerminal({ name: 'Ollama' });
            t.show(); t.sendText('ollama serve');
        }
        return;
    }
    if (!status.modelAvailable) {
        const choice = await vscode.window.showInformationMessage(
            `⚡ TIMPS: Model "${modelName}" not found. Pull it now? (~500MB)`,
            'Pull TIMPS-Coder', 'Later'
        );
        if (choice === 'Pull TIMPS-Coder') await _pullWithProgress(modelName);
    }
}

async function _pullWithProgress(modelName: string) {
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: '⬇️ Installing TIMPS-Coder...', cancellable: false },
        async (progress) => {
            const cfg = vscode.workspace.getConfiguration('timps');
            const url = cfg.get<string>('ollamaUrl', 'http://localhost:11434');
            try {
                progress.report({ message: 'Pulling from Ollama registry...' });
                await pullModel(url, modelName, (status) => progress.report({ message: status }));
                vscode.window.showInformationMessage('✅ TIMPS-Coder installed! Reload VS Code to activate.');
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to pull model: ${err.message}. Try manually: ollama pull ${modelName}`);
            }
        }
    );
}

export async function runSetupWizard(context: vscode.ExtensionContext) {
    const cfg = vscode.workspace.getConfiguration('timps');
    const url = cfg.get<string>('ollamaUrl', 'http://localhost:11434');
    const model = cfg.get<string>('localModel', 'sandeeprdy1729/timps-coder');
    const status = await getSetupStatus(url, model);

    const panel = vscode.window.createWebviewPanel('timpsSetup', '⚡ TIMPS Setup', vscode.ViewColumn.One, { enableScripts: false });
    panel.webview.html = _setupHtml(status, model);

    if (status.ollamaRunning && !status.modelAvailable) {
        const ch = await vscode.window.showInformationMessage(`Pull ${model}?`, 'Yes, Pull Now', 'No');
        if (ch === 'Yes, Pull Now') { panel.dispose(); await _pullWithProgress(model); }
    }
}

function _setupHtml(status: SetupStatus, model: string): string {
    const ok  = (s: string) => `<span style="color:#4ade80">✅ ${s}</span>`;
    const bad = (s: string) => `<span style="color:#f87171">❌ ${s}</span>`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:system-ui,sans-serif;padding:32px;max-width:680px;margin:0 auto;background:#1a1a2e;color:#e0e0ff}
h1{background:linear-gradient(135deg,#7c6af7,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:22px;margin-bottom:4px}
h2{color:#a78bfa;margin-top:22px;font-size:15px}
pre{background:#0d1117;padding:14px;border-radius:7px;border-left:3px solid #7c6af7;color:#a78bfa;font-family:monospace;font-size:13px}
.status{background:rgba(124,106,247,0.07);border:1px solid rgba(124,106,247,0.2);padding:14px;border-radius:8px;margin:14px 0}
.step{background:rgba(255,255,255,0.03);border:1px solid #2a2a4a;padding:14px;border-radius:8px;margin:10px 0}
a{color:#a78bfa}
</style></head><body>
<h1>⚡ TIMPS Setup Guide</h1>
<div class="status">
  <div>${status.ollamaInstalled ? ok('Ollama installed') : bad('Ollama not installed')}</div>
  <div style="margin-top:6px">${status.ollamaRunning ? ok('Ollama running') : bad('Ollama not running — run: ollama serve')}</div>
  <div style="margin-top:6px">${status.modelAvailable ? ok('TIMPS-Coder ready: ' + model) : bad('Model not found: ' + model)}</div>
</div>
<h2>Quick Setup (3 steps)</h2>
<div class="step"><strong>1. Install Ollama</strong><br><br>
  <a href="https://ollama.com/download">ollama.com/download</a> or:<br>
  <pre>curl -fsSL https://ollama.com/install.sh | sh</pre>
</div>
<div class="step"><strong>2. Pull TIMPS-Coder</strong>
  <pre>ollama pull ${model}</pre>
  <em style="font-size:11px;color:#888">~500MB, one-time download. Fine-tuned by Sandeep Reddy on Mac M2 Air.</em>
</div>
<div class="step"><strong>3. Start Ollama + Reload VS Code</strong>
  <pre>ollama serve</pre>
  Then press <code style="background:#0d1117;padding:2px 6px;border-radius:3px">Ctrl+Shift+P</code> → Reload Window
</div>
<h2>Alternative Models (OpenAI / Gemini)</h2>
<p style="font-size:12px">Set <code style="background:#0d1117;padding:1px 5px;border-radius:3px">timps.provider = openai</code> and <code style="background:#0d1117;padding:1px 5px;border-radius:3px">timps.openaiApiKey</code> in VS Code settings.</p>
<h2>Memory Commands</h2>
<p style="font-size:12px">Type in chat: <code style="background:#0d1117;padding:1px 5px;border-radius:3px">!audit</code> · <code style="background:#0d1117;padding:1px 5px;border-radius:3px">!blame keyword</code> · <code style="background:#0d1117;padding:1px 5px;border-radius:3px">!forget keyword</code></p>
</body></html>`;
}
