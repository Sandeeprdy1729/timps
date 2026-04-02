// extension/src/features/autoSaveOnCompletion.ts

import * as vscode from 'vscode';
import { TimpsClient } from '../client/timpsClient';

export class AutoSaveOnCompletion {
  private client: TimpsClient;

  constructor() {
    this.client = new TimpsClient();
  }

  public activate(context: vscode.ExtensionContext) {
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
        } catch (error) {
          console.error('Failed to save completion context:', error);
        }

        // Return normal completions (don't block Copilot)
        return [];
      },
    });

    context.subscriptions.push(disposable);
  }

  private _getProjectId(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return 'default';
  }
}