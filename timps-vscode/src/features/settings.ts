// extension/src/features/settings.ts

import * as vscode from 'vscode';

export class TimpsSettings {
  private static readonly MEMORY_TYPES = [
    'code_pattern',
    'error_pattern',
    'architecture_decision',
    'css_utility',
    'validation_logic',
  ];

  static getEnabledMemoryTypes(): string[] {
    const config = vscode.workspace.getConfiguration('timps');
    const result: string[] = [];

    for (const type of this.MEMORY_TYPES) {
      if (config.get(`memory.${type}`, true)) {
        result.push(type);
      }
    }

    return result;
  }

  static registerSettingsPanel(context: vscode.ExtensionContext) {
    vscode.commands.registerCommand('timps.openSettings', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'timps',
      );
    });
  }
}
