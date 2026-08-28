import * as vscode from 'vscode';
import { TimpsClient } from './client/timpsClient';

export class MemoryWatcher {
  private _client: TimpsClient;
  private _disposable: vscode.Disposable;
  private _enabled: boolean = true;
  private _lastEdit = new Map<string, { content: string; time: number }>();
  private _debounceMs: number;

  constructor(debounceMs: number = 3000) {
    this._client = new TimpsClient();
    this._debounceMs = debounceMs;

    this._disposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (!this._enabled) return;
      void this._onEdit(e);
    });
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  private async _onEdit(event: vscode.TextDocumentChangeEvent): Promise<void> {
    if (event.document.uri.scheme !== 'file') return;
    if (event.contentChanges.length === 0) return;

    const doc = event.document;
    const filePath = doc.uri.fsPath;
    const now = Date.now();

    const lastEdit = this._lastEdit.get(filePath);
    if (lastEdit && (now - lastEdit.time) < this._debounceMs) return;

    this._lastEdit.set(filePath, { content: doc.getText(), time: now });

    // Clean up old entries after 100
    if (this._lastEdit.size > 100) {
      const keys = [...this._lastEdit.keys()].slice(0, 50);
      for (const k of keys) this._lastEdit.delete(k);
    }

    try {
      await this._client.recordEdit({
        filePath,
        content: doc.getText(),
        language: doc.languageId,
      });
    } catch {
      // Non-critical — don't bother user with edit recording failures
    }
  }

  dispose(): void {
    this._disposable.dispose();
  }
}
