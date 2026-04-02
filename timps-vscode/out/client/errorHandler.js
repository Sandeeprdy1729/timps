"use strict";
// extension/src/client/errorHandler.ts
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
exports.TimpsErrorHandler = void 0;
const vscode = __importStar(require("vscode"));
class TimpsErrorHandler {
    static async handleApiError(error, context) {
        console.error(`[TIMPS Error in ${context}]:`, error);
        if (error.response?.status === 401) {
            vscode.window.showErrorMessage('TIMPS: Authentication failed. Please check your API key.');
            vscode.commands.executeCommand('timps.openSettings');
        }
        else if (error.response?.status === 429) {
            vscode.window.showWarningMessage('TIMPS: Rate limited. Pausing memory operations for 60 seconds.');
        }
        else if (error.code === 'ECONNREFUSED') {
            vscode.window.showWarningMessage('TIMPS: Cannot reach server. Check your connection or TIMPS backend is running.');
        }
        else {
            vscode.window.showErrorMessage(`TIMPS: Unexpected error. Check the logs for details.`);
        }
    }
    static logMetric(metric, value) {
        const timestamp = new Date().toISOString();
        console.log(`[TIMPS Metric ${timestamp}] ${metric}: ${value}`);
        // Later: send to analytics
    }
}
exports.TimpsErrorHandler = TimpsErrorHandler;
