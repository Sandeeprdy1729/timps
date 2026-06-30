// ============================================================
// TIMPS Sidebar — Persistent Activity Bar Panel
// ============================================================
import * as vscode from 'vscode';
import { TIMPsMemory } from './memory';
import { TIMPS_THEME, TIMPS_GLOBAL_RESET } from './design-tokens';

const SIDEBAR_ICONS = {
  chat: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M2 2h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5l-3 3V3a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5.5" cy="6.5" r=".75" fill="currentColor"/><circle cx="8" cy="6.5" r=".75" fill="currentColor"/><circle cx="10.5" cy="6.5" r=".75" fill="currentColor"/></svg>`,
  fix: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M6 3a3 3 0 0 1 3 3v2M10 10a3 3 0 0 1-3 3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1m0 0a3 3 0 0 1 3 3v1" stroke="currentColor" stroke-width="1.2"/><path d="M12 4L9 7m0 0l-2 2" stroke="currentColor" stroke-width="1.2"/></svg>`,
  explain: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v1m0 1v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="4.5" r=".5" fill="currentColor"/></svg>`,
  refactor: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M2 4h12M5 2l1 2m5-2l-1 2M4 14h8a1 1 0 0 0 1-1V6H3v7a1 1 0 0 0 1 1z" stroke="currentColor" stroke-width="1.2"/></svg>`,
  review: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M1 4h14M1 8h14M1 12h14" stroke="currentColor" stroke-width="1.2"/><circle cx="13" cy="4" r="2.5" fill="var(--timps-accent)" stroke="#14140F" stroke-width=".5"/></svg>`,
  test: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M3 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.2"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  docs: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M4 1h8l2 2v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3l2-2z" stroke="currentColor" stroke-width="1.2"/><path d="M5 6h6M5 9h6M5 12h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  optimize: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M8 1l2 5h5l-4 3 1.5 6L8 11l-4.5 4L5 9l-4-3h5L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  security: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M8 1l5 2v5a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3l5-2z" stroke="currentColor" stroke-width="1.2"/><path d="M6 8l1.5 1.5L10 6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  generate: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M3 3l10 10m0-10L3 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  memory: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="2" y="1" width="12" height="14" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M5 4h6M5 7h6M5 10h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  status: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v4h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  setup: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 1v2m0 10v2M1 8h2m10 0h2M3.3 3.3l1.4 1.4m6.6 6.6l1.4 1.4M3.3 12.7l1.4-1.4m6.6-6.6l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
};

export class TIMPsSidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _ctx: vscode.ExtensionContext,
        private readonly _memory: TIMPsMemory
    ) {}

    resolveWebviewView(view: vscode.WebviewView) {
        this._view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this._getHtml();

        view.webview.onDidReceiveMessage(async msg => {
            switch (msg.type) {
                case 'openChat':
                    vscode.commands.executeCommand('timps.chat');
                    break;
                case 'runSkill':
                    vscode.commands.executeCommand(`timps.${msg.skill}`);
                    break;
                case 'audit':
                    vscode.commands.executeCommand('timps.auditMemory');
                    break;
                case 'setup':
                    vscode.commands.executeCommand('timps.setup');
                    break;
                case 'status':
                    vscode.commands.executeCommand('timps.status');
                    break;
            }
        });
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
${TIMPS_THEME}
${TIMPS_GLOBAL_RESET}
body {
    padding: 10px 6px;
    font-size: 12px;
}
.logo {
    font-size: 14px;
    font-weight: 700;
    color: var(--timps-accent);
    margin-bottom: 2px;
    letter-spacing: -0.3px;
}
.sub { color: var(--timps-text-muted); font-size: 10px; margin-bottom: 14px; }
.section-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--timps-text-muted);
    margin: 12px 0 5px;
}
.btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: 1px solid var(--timps-border);
    border-radius: var(--timps-radius-sm);
    color: var(--timps-text);
    font-size: 11px;
    font-family: var(--timps-font);
    cursor: pointer;
    margin-bottom: 3px;
    text-align: left;
    transition: all 0.12s;
}
.btn:hover {
    background: var(--timps-accent-light);
    border-color: var(--timps-accent);
}
.btn .icon { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--timps-text2); }
.btn:hover .icon { color: var(--timps-accent); }
.btn .label { flex: 1; }
.btn .kbd {
    font-size: 8px;
    color: var(--timps-text-muted);
    background: rgba(255,255,255,0.05);
    padding: 1px 3px;
    border-radius: var(--timps-radius-sm);
    font-family: var(--timps-font-mono);
}
.primary {
    background: var(--timps-accent-light);
    border-color: var(--timps-accent);
    color: var(--timps-accent-hover);
}
.primary:hover { background: rgba(74,140,122,0.2); }
.primary .icon { color: var(--timps-accent); }
.divider { border: none; border-top: 1px solid var(--timps-border); margin: 10px 0; }
.tip {
    font-size: 9px;
    color: var(--timps-text-muted);
    padding: 6px 8px;
    background: var(--timps-bg2);
    border-left: 2px solid var(--timps-accent);
    border-radius: 0 var(--timps-radius-sm) var(--timps-radius-sm) 0;
    line-height: 1.5;
    margin-top: 6px;
}
.tip strong { color: var(--timps-accent-hover); }
</style>
</head>
<body>
<div class="logo">TIMPS</div>
<div class="sub">AI Coding Agent v2.1</div>

<div class="section-title">Quick Actions</div>
<button class="btn primary" onclick="send('openChat')">
    <span class="icon">${SIDEBAR_ICONS.chat}</span><span class="label">Open Chat</span><span class="kbd">⌘⇧T</span>
</button>

<div class="section-title">Code Skills</div>
<button class="btn" onclick="send('runSkill','fix')">
    <span class="icon">${SIDEBAR_ICONS.fix}</span><span class="label">Fix Bug</span><span class="kbd">⌘⇧F</span>
</button>
<button class="btn" onclick="send('runSkill','explain')">
    <span class="icon">${SIDEBAR_ICONS.explain}</span><span class="label">Explain Code</span><span class="kbd">⌘⇧E</span>
</button>
<button class="btn" onclick="send('runSkill','refactor')">
    <span class="icon">${SIDEBAR_ICONS.refactor}</span><span class="label">Refactor</span><span class="kbd">⌘⇧R</span>
</button>
<button class="btn" onclick="send('runSkill','review')">
    <span class="icon">${SIDEBAR_ICONS.review}</span><span class="label">Code Review</span>
</button>
<button class="btn" onclick="send('runSkill','test')">
    <span class="icon">${SIDEBAR_ICONS.test}</span><span class="label">Write Tests</span><span class="kbd">⌘⇧U</span>
</button>
<button class="btn" onclick="send('runSkill','docs')">
    <span class="icon">${SIDEBAR_ICONS.docs}</span><span class="label">Generate Docs</span>
</button>
<button class="btn" onclick="send('runSkill','optimize')">
    <span class="icon">${SIDEBAR_ICONS.optimize}</span><span class="label">Optimize</span>
</button>
<button class="btn" onclick="send('runSkill','security')">
    <span class="icon">${SIDEBAR_ICONS.security}</span><span class="label">Security Audit</span>
</button>
<button class="btn" onclick="send('runSkill','generate')">
    <span class="icon">${SIDEBAR_ICONS.generate}</span><span class="label">Generate Code</span>
</button>

<div class="section-title">Memory (!commands)</div>
<button class="btn" onclick="send('audit')">
    <span class="icon">${SIDEBAR_ICONS.memory}</span><span class="label">!audit — View Memories</span>
</button>

<hr class="divider"/>

<div class="section-title">Settings</div>
<button class="btn" onclick="send('status')">
    <span class="icon">${SIDEBAR_ICONS.status}</span><span class="label">Check Status</span>
</button>
<button class="btn" onclick="send('setup')">
    <span class="icon">${SIDEBAR_ICONS.setup}</span><span class="label">Setup / Install Model</span>
</button>

<div class="tip">
    Select code first, then click a skill.<br/>
    Type <strong>!audit</strong>, <strong>!blame</strong>, or <strong>!forget</strong> in chat.
</div>

<script>
const vscode = acquireVsCodeApi();
function send(type, skill) {
    vscode.postMessage({ type, skill });
}
</script>
</body>
</html>`;
    }
}
