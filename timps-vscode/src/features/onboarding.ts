// extension/src/features/onboarding.ts

import * as vscode from 'vscode';

export class Onboarding {
  static async showWelcome(context: vscode.ExtensionContext) {
    const hasSeenWelcome = context.globalState.get('timps.seenWelcome');

    if (!hasSeenWelcome) {
      const result = await vscode.window.showInformationMessage(
        'Welcome to TIMPS! 🚀',
        'Get Started',
        'Later',
      );

      if (result === 'Get Started') {
        await vscode.commands.executeCommand('timps.openSettings');
        vscode.window.showInformationMessage(
          'TIMPS will automatically save your coding patterns and suggest them when relevant.',
        );
      }

      context.globalState.update('timps.seenWelcome', true);
    }
  }
}