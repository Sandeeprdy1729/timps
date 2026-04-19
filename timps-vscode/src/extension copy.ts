// ============================================================
// TIMPS VS Code Extension v2.1 — Main Entry Point  
// Fixed bugs + 3-layer memory + skill system + sidebar
// ============================================================

import * as vscode from 'vscode';
import { TIMPsChatPanel } from './chatPanel';
import { openTerminal } from './terminalAgent';
import { explainCode, refactorCode, writeTests, fixBug, reviewCode, generateCode, generateDocs, securityAudit, optimizeCode } from './contextActions';
import { autoSetup, getSetupStatus, runSetupWizard } from './setup';
import { TIMPsSidebarProvider } from './sidebar';
import { TIMPsMemory } from './memory';
import { SetupStatus } from './types';

let statusBarItem: vscode.StatusBarItem;
export let memory: TIMPsMemory;
let sidebarProvider: TIMPsSidebarProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('[TIMPS] Activating v2.1...');

    memory = new TIMPsMemory(context.globalStoragePath);
    await memory.init();

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'timps.status';
    statusBarItem.tooltip = 'TIMPS AI Agent — Click for status';
    statusBarItem.text = '$(robot) TIMPS';
    context.subscriptions.push(statusBarItem);

    sidebarProvider = new TIMPsSidebarProvider(context, memory);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('timps.sidebar', sidebarProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    const r = (cmd: string, fn: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));

    r('timps.open', () => openTerminal());
    r('timps.chat', () => TIMPsChatPanel.createOrShow(context.extensionUri, memory));
    r('timps.sidebar', () => vscode.commands.executeCommand('timps.sidebar.focus'));

    r('timps.explain', () => { const ed = vscode.window.activeTextEditor; if (ed) explainCode(ed, context.extensionUri, memory); });
    r('timps.refactor', () => { const ed = vscode.window.activeTextEditor; if (ed) refactorCode(ed, context.extensionUri, memory); });
    r('timps.test', () => { const ed = vscode.window.activeTextEditor; if (ed) writeTests(ed, context.extensionUri, memory); });
    r('timps.fix', () => { const ed = vscode.window.activeTextEditor; if (ed) fixBug(ed, context.extensionUri, memory); });
    r('timps.review', () => { const ed = vscode.window.activeTextEditor; if (ed) reviewCode(ed, context.extensionUri, memory); });
    r('timps.generate', () => { const ed = vscode.window.activeTextEditor; if (ed) generateCode(ed, context.extensionUri, memory); });
    r('timps.docs', () => { const ed = vscode.window.activeTextEditor; if (ed) generateDocs(ed, context.extensionUri, memory); });
    r('timps.security', () => { const ed = vscode.window.activeTextEditor; if (ed) securityAudit(ed, context.extensionUri, memory); });
    r('timps.optimize', () => { const ed = vscode.window.activeTextEditor; if (ed) optimizeCode(ed, context.extensionUri, memory); });

    r('timps.auditMemory', async () => {
        const mems = await memory.audit();
        const panel = TIMPsChatPanel.createOrShow(context.extensionUri, memory);
        setTimeout(() => TIMPsChatPanel.postMemoryAudit(mems), 400);
    });

    r('timps.forgetMemory', async () => {
        const kw = await vscode.window.showInputBox({ prompt: '!forget — keyword to delete from memory', placeHolder: 'e.g. React' });
        if (!kw) return;
        const n = await memory.forget(kw);
        vscode.window.showInformationMessage(`🗑️ TIMPS deleted ${n} memory item(s) matching "${kw}"`);
    });

    r('timps.blameMemory', async () => {
        const kw = await vscode.window.showInputBox({ prompt: '!blame — search memories', placeHolder: 'e.g. TypeScript' });
        if (!kw) return;
        const results = await memory.search(kw, 10);
        TIMPsChatPanel.createOrShow(context.extensionUri, memory);
        setTimeout(() => TIMPsChatPanel.postBlameResults(kw, results), 400);
    });

    r('timps.installModel', () => runSetupWizard(context));

    r('timps.status', async () => {
        const cfg = vscode.workspace.getConfiguration('timps');
        const status = await getSetupStatus(cfg.get('ollamaUrl', 'http://localhost:11434'), cfg.get('localModel', 'sandeeprdy1729/timps-coder'));
        updateStatusBar(status);
        const msg = `TIMPS Status\n${status.ollamaRunning ? '✅ Ollama running' : '❌ Ollama not running'}\n${status.modelAvailable ? '✅ Model: ' + status.modelName : '❌ Model not found: ' + status.modelName}`;
        vscode.window.showInformationMessage(msg, 'Setup Wizard').then(c => { if (c) runSetupWizard(context); });
    });

    r('timps.setup', () => runSetupWizard(context));

    // Auto-setup
    const cfg = vscode.workspace.getConfiguration('timps');
    if (cfg.get<boolean>('autoInstall', true)) {
        getSetupStatus(cfg.get('ollamaUrl', 'http://localhost:11434'), cfg.get('localModel', 'sandeeprdy1729/timps-coder'))
            .then(status => {
                updateStatusBar(status);
                if (!status.ollamaRunning || !status.modelAvailable) autoSetup(context, status, cfg.get('localModel', 'sandeeprdy1729/timps-coder'));
            }).catch(() => {});
    }

    statusBarItem.show();
    console.log('[TIMPS] Activated!');
}

function updateStatusBar(status: SetupStatus) {
    if (status.ollamaRunning && status.modelAvailable) {
        statusBarItem.text = '$(robot) TIMPS ✓';
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(robot) TIMPS ⚠';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

export function deactivate() { memory?.close(); }
