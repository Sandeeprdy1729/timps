import * as vscode from 'vscode';
import { TimpsClient } from './client/timpsClient';

export class TimpsCompletionProvider implements vscode.CompletionItemProvider {
  private _client: TimpsClient;
  private _enabled: boolean = true;

  constructor() {
    this._client = new TimpsClient();
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CompletionItem[]> {
    if (!this._enabled) return [];

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return [];

    const prefix = document.getText(wordRange).toLowerCase().trim();
    if (prefix.length < 2) return [];

    // Get context: the current line and surrounding code
    const line = document.lineAt(position.line);
    const linePrefix = line.text.substring(0, position.character).toLowerCase();

    try {
      const memories = await this._client.recall(linePrefix || prefix, {
        limit: 5,
        minConfidence: 0.3,
      });

      return memories
        .filter(m => m && m.content)
        .map((m, i) => {
          const item = new vscode.CompletionItem(
            this._extractLabel(m.content, prefix),
            vscode.CompletionItemKind.Snippet,
          );
          item.detail = `🧠 TIMPS: ${m.type || 'memory'}`;
          item.documentation = new vscode.MarkdownString(
            `**${m.type || 'Memory'}** — ${m.confidence ? Math.round(m.confidence * 100) + '% confidence' : ''}\n\n${m.content.slice(0, 500)}`,
          );
          item.insertText = m.content;
          item.sortText = String.fromCharCode(97 + i); // priority after standard suggestions
          return item;
        });
    } catch {
      return [];
    }
  }

  private _extractLabel(content: string, prefix: string): string {
    // Try to extract a relevant function/variable name from the memory
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
      // Match function definitions, variable assignments, or class names
      const fnMatch = line.match(/(?:function|fn|def|func)\s+(\w+)/);
      if (fnMatch) return fnMatch[1];
      const varMatch = line.match(/(?:const|let|var|val)\s+(\w+)/);
      if (varMatch) return varMatch[1];
      const classMatch = line.match(/(?:class|struct|trait)\s+(\w+)/);
      if (classMatch) return classMatch[1];
      // Match a line starting with the prefix
      if (line.toLowerCase().startsWith(prefix)) {
        return line.slice(0, 60) + (line.length > 60 ? '...' : '');
      }
    }
    // Fall back to first line
    const first = lines[0] || content.slice(0, 60);
    return first.length > 60 ? first.slice(0, 57) + '...' : first;
  }
}
