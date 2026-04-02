"use strict";
// extension/src/features/autoSaveOnCompletion.ts
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
exports.AutoSaveOnCompletion = void 0;
const vscode = __importStar(require("vscode"));
const timpsClient_1 = require("../client/timpsClient");
class AutoSaveOnCompletion {
    constructor() {
        this.client = new timpsClient_1.TimpsClient();
    }
    activate(context) {
        // Listen for code completions
        let disposable = vscode.languages.registerCompletionItemProvider('javascript', {
            async provideCompletionItems(document, position, token, context) {
                // This fires every time Copilot suggests something
                // Auto-save the context to TIMPS
                const linePrefix = document
                    .lineAt(position)
                    .text.substr(0, position.character);
                try {
                    await this.client.addMemory({
                        projectId: this._getProjectId(),
                        content: document.getText(), // Store the file context
                        memory_type: 'code_completion_context',
                        metadata: {
                            filename: document.fileName,
                            lineNumber: position.line,
                            lineContent: linePrefix,
                        },
                    });
                }
                catch (error) {
                    console.error('Failed to save completion context:', error);
                }
                // Return normal completions (don't block Copilot)
                return [];
            },
        });
        context.subscriptions.push(disposable);
    }
    _getProjectId() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return 'default';
    }
}
exports.AutoSaveOnCompletion = AutoSaveOnCompletion;
