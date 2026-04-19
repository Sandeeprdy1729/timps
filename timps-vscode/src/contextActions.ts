// ============================================================
// TIMPS — Context Actions (right-click menu + commands)
// BUG FIX: extensionUri passed correctly from extension.ts
// ============================================================

import * as vscode from 'vscode';
import { TIMPsChatPanel } from './chatPanel';
import { TIMPsMemory } from './memory';
import { openTerminal, sendToTerminal } from './terminalAgent';

interface SelectionInfo {
    code: string; fullCode: string; fileName: string;
    language: string; startLine: number; endLine: number;
}

function getSelection(editor: vscode.TextEditor): SelectionInfo | null {
    const sel = editor.selection;
    const code = editor.document.getText(sel.isEmpty ? undefined : sel);
    if (!code.trim()) {
        vscode.window.showWarningMessage('TIMPS: No code selected. Select some code first or use on full file.');
    }
    return {
        code,
        fullCode: editor.document.getText(),
        fileName: editor.document.fileName,
        language: editor.document.languageId,
        startLine: sel.start.line + 1,
        endLine: sel.end.line + 1
    };
}

function prompt(skill: string, info: SelectionInfo): string {
    const code = info.code || info.fullCode;
    const lang = info.language;
    const file = info.fileName.split('/').pop() || info.fileName;

    switch (skill) {
        case 'fix':
            return `Fix the bug(s) in this ${lang} code from ${file}.\n\n**Format:**\n## 🔍 Root Cause\n[explain the bug in plain English]\n\n## ✅ Fixed Code\n\`\`\`${lang}\n[complete fixed code]\n\`\`\`\n\n## 📝 What Changed\n[explain each fix]\n\n**Code to fix:**\n\`\`\`${lang}\n${code}\n\`\`\``;

        case 'explain':
            return `Explain this ${lang} code from ${file} clearly.\n\n## 📌 What It Does\n[1-2 sentence summary]\n\n## 🔄 How It Works\n[step-by-step walkthrough]\n\n## 🧩 Key Concepts\n[patterns/algorithms used]\n\n## ⚠️ Edge Cases\n[gotchas to watch out for]\n\n\`\`\`${lang}\n${code}\n\`\`\``;

        case 'refactor':
            return `Refactor this ${lang} code for better readability, performance, and maintainability.\n\n## 🎯 Goals\n[what will be improved]\n\n## ✨ Refactored Code\n\`\`\`${lang}\n[complete refactored code]\n\`\`\`\n\n## 📝 Changes Made\n[bullet list of each improvement]\n\n**Original:**\n\`\`\`${lang}\n${code}\n\`\`\``;

        case 'test':
            const fw = lang === 'python' ? 'pytest' : lang === 'java' ? 'JUnit 5' : ['typescript','javascript'].includes(lang) ? 'Jest' : lang === 'go' ? 'testing' : lang === 'rust' ? 'cargo test' : 'appropriate framework';
            return `Write comprehensive unit tests for this ${lang} code using ${fw}.\n\nInclude: happy path, edge cases (null/empty/boundary), error scenarios, clear test names.\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\nReturn complete test file:`;

        case 'review':
            return `Review this ${lang} code (${file}).\n\n## 🔴 Critical Issues (must fix)\n[security, crashes, data loss]\n\n## 🟡 Warnings (should fix)\n[performance, bad practices, bugs]\n\n## 🟢 Suggestions (nice to have)\n[style, readability, optimization]\n\n## 📊 Score: X/10\n[brief assessment]\n\n\`\`\`${lang}\n${info.fullCode.slice(0, 4000)}\n\`\`\``;

        case 'docs':
            const docStyle = lang === 'python' ? 'Google-style docstrings' : ['typescript','javascript'].includes(lang) ? 'JSDoc' : lang === 'java' ? 'Javadoc' : lang === 'go' ? 'Go doc comments' : lang === 'rust' ? 'Rustdoc' : 'appropriate doc comments';
            return `Add ${docStyle} to all functions/classes/methods in this ${lang} code. Include inline comments for complex logic. Return fully documented version:\n\n\`\`\`${lang}\n${code}\n\`\`\``;

        case 'security':
            return `Security audit this ${lang} code. Check: SQL/command injection, XSS, insecure deserialization, hardcoded secrets, input validation, auth flaws.\n\n## 🚨 Critical Vulnerabilities\n## ⚠️ High Risk\n## ℹ️ Medium Risk\n## ✅ Secure Patterns\n## 🛡️ Hardened Version\n\`\`\`${lang}\n[secured code]\n\`\`\`\n\nCode:\n\`\`\`${lang}\n${code}\n\`\`\``;

        case 'optimize':
            return `Analyze and optimize this ${lang} code for performance.\n\n## ⚡ Performance Issues\n[current bottlenecks, complexity]\n\n## 🚀 Optimized Code\n\`\`\`${lang}\n[optimized version]\n\`\`\`\n\n## Complexity Comparison\n| | Before | After |\n|---|---|---|\n| Time | O(?) | O(?) |\n| Space | O(?) | O(?) |\n\n## Key Optimizations\n[explain each one]\n\nCode:\n\`\`\`${lang}\n${code}\n\`\`\``;

        default:
            return `${skill}: \`\`\`${lang}\n${code}\n\`\`\``;
    }
}

async function runSkill(skill: string, editor: vscode.TextEditor, extensionUri: vscode.Uri, memory: TIMPsMemory) {
    const info = getSelection(editor);
    if (!info) return;

    // Track file in working memory
    memory.trackFile(editor.document.fileName);

    const msg = prompt(skill, info);
    const cfg = vscode.workspace.getConfiguration('timps');

    if (cfg.get<string>('agentMode', 'chat') === 'terminal') {
        openTerminal();
        sendToTerminal(msg);
    } else {
        const panel = TIMPsChatPanel.createOrShow(extensionUri, memory);
        setTimeout(() => panel.sendUserMessage(msg), 300);
    }
}

export const explainCode  = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('explain', e, u, m);
export const refactorCode = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('refactor', e, u, m);
export const writeTests   = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('test', e, u, m);
export const fixBug       = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('fix', e, u, m);
export const reviewCode   = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('review', e, u, m);
export const generateDocs = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('docs', e, u, m);
export const securityAudit = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('security', e, u, m);
export const optimizeCode = (e: vscode.TextEditor, u: vscode.Uri, m: TIMPsMemory) => runSkill('optimize', e, u, m);

export async function generateCode(editor: vscode.TextEditor, extensionUri: vscode.Uri, memory: TIMPsMemory) {
    const prompt = await vscode.window.showInputBox({
        prompt: 'TIMPS: What code do you want to generate?',
        placeHolder: 'e.g. A React hook for debounced search with TypeScript'
    });
    if (!prompt) return;
    const lang = editor.document.languageId;
    const msg = `Generate clean, production-ready ${lang} code for: ${prompt}\n\nRequirements:\n- Full implementation with error handling\n- Well-commented for complex logic\n- Follows ${lang} best practices\n- Ready to use without modification\n\nProvide complete implementation:`;
    const panel = TIMPsChatPanel.createOrShow(extensionUri, memory);
    setTimeout(() => panel.sendUserMessage(msg), 300);
}
