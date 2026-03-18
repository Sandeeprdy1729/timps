// extension/src/client/errorHandler.ts

import * as vscode from 'vscode';

export class TimpsErrorHandler {
  static async handleApiError(error: any, context: string) {
    console.error(`[TIMPS Error in ${context}]:`, error);

    if (error.response?.status === 401) {
      vscode.window.showErrorMessage(
        'TIMPS: Authentication failed. Please check your API key.',
      );
      vscode.commands.executeCommand('timps.openSettings');
    } else if (error.response?.status === 429) {
      vscode.window.showWarningMessage(
        'TIMPS: Rate limited. Pausing memory operations for 60 seconds.',
      );
    } else if (error.code === 'ECONNREFUSED') {
      vscode.window.showWarningMessage(
        'TIMPS: Cannot reach server. Check your connection or TIMPS backend is running.',
      );
    } else {
      vscode.window.showErrorMessage(
        `TIMPS: Unexpected error. Check the logs for details.`,
      );
    }
  }

  static logMetric(metric: string, value: any) {
    const timestamp = new Date().toISOString();
    console.log(`[TIMPS Metric ${timestamp}] ${metric}: ${value}`);
    // Later: send to analytics
  }
}