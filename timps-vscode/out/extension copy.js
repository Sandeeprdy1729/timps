"use strict";
// ============================================================
// TIMPS VS Code Extension v2.1 — Main Entry Point  
// Fixed bugs + 3-layer memory + skill system + sidebar
// ============================================================
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
exports.memory = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const chatPanel_1 = require("./chatPanel");
const terminalAgent_1 = require("./terminalAgent");
const contextActions_1 = require("./contextActions");
const setup_1 = require("./setup");
const sidebar_1 = require("./sidebar");
const memory_1 = require("./memory");
let statusBarItem;
let sidebarProvider;
async function activate(context) {
    console.log('[TIMPS] Activating v2.1...');
    exports.memory = new memory_1.TIMPsMemory(context.globalStoragePath);
    await exports.memory.init();
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'timps.status';
    statusBarItem.tooltip = 'TIMPS AI Agent — Click for status';
    statusBarItem.text = '$(robot) TIMPS';
    context.subscriptions.push(statusBarItem);
    sidebarProvider = new sidebar_1.TIMPsSidebarProvider(context, exports.memory);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('timps.sidebar', sidebarProvider, {
        webviewOptions: { retainContextWhenHidden: true }
    }));
    const r = (cmd, fn) => context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));
    r('timps.open', () => (0, terminalAgent_1.openTerminal)());
    r('timps.chat', () => chatPanel_1.TIMPsChatPanel.createOrShow(context.extensionUri, exports.memory));
    r('timps.sidebar', () => vscode.commands.executeCommand('timps.sidebar.focus'));
    r('timps.explain', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.explainCode)(ed, context.extensionUri, exports.memory); });
    r('timps.refactor', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.refactorCode)(ed, context.extensionUri, exports.memory); });
    r('timps.test', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.writeTests)(ed, context.extensionUri, exports.memory); });
    r('timps.fix', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.fixBug)(ed, context.extensionUri, exports.memory); });
    r('timps.review', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.reviewCode)(ed, context.extensionUri, exports.memory); });
    r('timps.generate', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.generateCode)(ed, context.extensionUri, exports.memory); });
    r('timps.docs', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.generateDocs)(ed, context.extensionUri, exports.memory); });
    r('timps.security', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.securityAudit)(ed, context.extensionUri, exports.memory); });
    r('timps.optimize', () => { const ed = vscode.window.activeTextEditor; if (ed)
        (0, contextActions_1.optimizeCode)(ed, context.extensionUri, exports.memory); });
    r('timps.auditMemory', async () => {
        const mems = await exports.memory.audit();
        const panel = chatPanel_1.TIMPsChatPanel.createOrShow(context.extensionUri, exports.memory);
        setTimeout(() => chatPanel_1.TIMPsChatPanel.postMemoryAudit(mems), 400);
    });
    r('timps.forgetMemory', async () => {
        const kw = await vscode.window.showInputBox({ prompt: '!forget — keyword to delete from memory', placeHolder: 'e.g. React' });
        if (!kw)
            return;
        const n = await exports.memory.forget(kw);
        vscode.window.showInformationMessage(`🗑️ TIMPS deleted ${n} memory item(s) matching "${kw}"`);
    });
    r('timps.blameMemory', async () => {
        const kw = await vscode.window.showInputBox({ prompt: '!blame — search memories', placeHolder: 'e.g. TypeScript' });
        if (!kw)
            return;
        const results = await exports.memory.search(kw, 10);
        chatPanel_1.TIMPsChatPanel.createOrShow(context.extensionUri, exports.memory);
        setTimeout(() => chatPanel_1.TIMPsChatPanel.postBlameResults(kw, results), 400);
    });
    r('timps.installModel', () => (0, setup_1.runSetupWizard)(context));
    r('timps.status', async () => {
        const cfg = vscode.workspace.getConfiguration('timps');
        const status = await (0, setup_1.getSetupStatus)(cfg.get('ollamaUrl', 'http://localhost:11434'), cfg.get('localModel', 'sandeeprdy1729/timps-coder'));
        updateStatusBar(status);
        const msg = `TIMPS Status\n${status.ollamaRunning ? '✅ Ollama running' : '❌ Ollama not running'}\n${status.modelAvailable ? '✅ Model: ' + status.modelName : '❌ Model not found: ' + status.modelName}`;
        vscode.window.showInformationMessage(msg, 'Setup Wizard').then(c => { if (c)
            (0, setup_1.runSetupWizard)(context); });
    });
    r('timps.setup', () => (0, setup_1.runSetupWizard)(context));
    // Auto-setup
    const cfg = vscode.workspace.getConfiguration('timps');
    if (cfg.get('autoInstall', true)) {
        (0, setup_1.getSetupStatus)(cfg.get('ollamaUrl', 'http://localhost:11434'), cfg.get('localModel', 'sandeeprdy1729/timps-coder'))
            .then(status => {
            updateStatusBar(status);
            if (!status.ollamaRunning || !status.modelAvailable)
                (0, setup_1.autoSetup)(context, status, cfg.get('localModel', 'sandeeprdy1729/timps-coder'));
        }).catch(() => { });
    }
    statusBarItem.show();
    console.log('[TIMPS] Activated!');
}
function updateStatusBar(status) {
    if (status.ollamaRunning && status.modelAvailable) {
        statusBarItem.text = '$(robot) TIMPS ✓';
        statusBarItem.backgroundColor = undefined;
    }
    else {
        statusBarItem.text = '$(robot) TIMPS ⚠';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}
function deactivate() { exports.memory?.close(); }
