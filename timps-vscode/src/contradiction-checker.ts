import * as vscode from 'vscode';
import { TimpsClient } from './client/timpsClient';

export class ContradictionChecker {
  private _client: TimpsClient;
  private _diagnostics: vscode.DiagnosticCollection;
  private _enabled: boolean = true;
  private _debounceTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this._client = new TimpsClient();
    this._diagnostics = vscode.languages.createDiagnosticCollection('timps-contradictions');

    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!this._enabled) return;
      this._debouncedCheck(e.document);
    });

    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (!this._enabled || !e) return;
      this._debouncedCheck(e.document);
    });
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) this._diagnostics.clear();
  }

  private _debouncedCheck(document: vscode.TextDocument): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => void this._checkDocument(document), 2000);
  }

  private async _checkDocument(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') return;

    const uri = document.uri;
    const text = document.getText();

    // Only check small sections — last 50 lines or selection
    const editor = vscode.window.activeTextEditor;
    const checkText = editor?.document.uri.fsPath === uri.fsPath && editor.selection
      ? document.getText(editor.selection)
      : text.split('\n').slice(-50).join('\n');

    if (!checkText || checkText.length < 20) return;

    try {
      const result = await this._client.checkContradiction(checkText.slice(0, 500));

      if (!result || !result.hasContradiction) {
        this._diagnostics.delete(uri);
        return;
      }

      const diagnostics: vscode.Diagnostic[] = [];
      const lines = text.split('\n');

      // Check each line for contradiction markers
      if (result.evidence) {
        for (const evidence of result.evidence) {
          for (let i = 0; i < lines.length; i++) {
            const col = lines[i].toLowerCase().indexOf(evidence.toLowerCase());
            if (col !== -1) {
              const range = new vscode.Range(
                new vscode.Position(i, col),
                new vscode.Position(i, col + evidence.length),
              );
              diagnostics.push(new vscode.Diagnostic(
                range,
                `⚠️ Contradicts existing memory: ${evidence.slice(0, 80)}`,
                vscode.DiagnosticSeverity.Warning,
              ));
            }
          }
        }
      }

      // If no specific evidence matched, add a general file-level warning
      if (diagnostics.length === 0) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          `⚠️ TIMPS: This code contradicts stored memories (${(result.entries || []).length} related entries)`,
          vscode.DiagnosticSeverity.Warning,
        ));
      }

      this._diagnostics.set(uri, diagnostics);
    } catch {
      // Non-critical
    }
  }

  dispose(): void {
    this._diagnostics.dispose();
  }
}
