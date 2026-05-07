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
exports.getSetupStatus = getSetupStatus;
exports.autoSetup = autoSetup;
exports.runSetupWizard = runSetupWizard;
// ============================================================
// TIMPS Auto-Setup — checks Ollama + pulls TIMPS-Coder
// ============================================================
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const ollama_1 = require("./ollama");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function isOllamaInstalled() {
    try {
        await execAsync('which ollama');
        return true;
    }
    catch { }
    try {
        await execAsync('where ollama');
        return true;
    }
    catch { }
    return false;
}
async function getSetupStatus(ollamaUrl, modelName) {
    const installed = await isOllamaInstalled();
    let running = false, modelAvailable = false;
    if (installed)
        running = await (0, ollama_1.checkOllamaRunning)(ollamaUrl).catch(() => false);
    if (running)
        modelAvailable = await (0, ollama_1.checkModelExists)(ollamaUrl, modelName).catch(() => false);
    return { ollamaInstalled: installed, ollamaRunning: running, modelAvailable, modelName };
}
async function autoSetup(context, status, modelName) {
    if (!status.ollamaInstalled) {
        const choice = await vscode.window.showInformationMessage('⚡ TIMPS needs Ollama to run TIMPS-Coder locally (free, no API key).', 'Download Ollama', 'Dismiss');
        if (choice === 'Download Ollama')
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
        return;
    }
    if (!status.ollamaRunning) {
        const choice = await vscode.window.showWarningMessage('⚡ TIMPS: Ollama not running. Start it to use TIMPS-Coder.', 'Start Ollama', 'Dismiss');
        if (choice === 'Start Ollama') {
            const t = vscode.window.createTerminal({ name: 'Ollama' });
            t.show();
            t.sendText('ollama serve');
        }
        return;
    }
    if (!status.modelAvailable) {
        const choice = await vscode.window.showInformationMessage(`⚡ TIMPS: Model "${modelName}" not found. Pull it now? (~500MB)`, 'Pull TIMPS-Coder', 'Later');
        if (choice === 'Pull TIMPS-Coder')
            await _pullWithProgress(modelName);
    }
}
async function _pullWithProgress(modelName) {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: '⬇️ Installing TIMPS-Coder...', cancellable: false }, async (progress) => {
        const cfg = vscode.workspace.getConfiguration('timps');
        const url = cfg.get('ollamaUrl', 'http://localhost:11434');
        try {
            progress.report({ message: 'Pulling from Ollama registry...' });
            await (0, ollama_1.pullModel)(url, modelName, (status) => progress.report({ message: status }));
            vscode.window.showInformationMessage('✅ TIMPS-Coder installed! Reload VS Code to activate.');
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to pull model: ${err.message}. Try manually: ollama pull ${modelName}`);
        }
    });
}
async function runSetupWizard(context) {
    const cfg = vscode.workspace.getConfiguration('timps');
    const url = cfg.get('ollamaUrl', 'http://localhost:11434');
    const model = cfg.get('localModel', 'sandeeprdy1729/timps-coder');
    const status = await getSetupStatus(url, model);
    const panel = vscode.window.createWebviewPanel('timpsSetup', '⚡ TIMPS Setup', vscode.ViewColumn.One, { enableScripts: false });
    panel.webview.html = _setupHtml(status, model);
    if (status.ollamaRunning && !status.modelAvailable) {
        const ch = await vscode.window.showInformationMessage(`Pull ${model}?`, 'Yes, Pull Now', 'No');
        if (ch === 'Yes, Pull Now') {
            panel.dispose();
            await _pullWithProgress(model);
        }
    }
}
function _setupHtml(status, model) {
    const ok = (s) => `<span style="color:#4ade80">✅ ${s}</span>`;
    const bad = (s) => `<span style="color:#f87171">❌ ${s}</span>`;
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
