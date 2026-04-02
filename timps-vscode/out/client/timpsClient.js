"use strict";
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
exports.TimpsClient = void 0;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
function getConfig() {
    const cfg = vscode.workspace.getConfiguration('timps');
    return {
        serverUrl: cfg.get('serverUrl', 'https://timps-api.onrender.com'),
        userId: cfg.get('userId', 1),
    };
}
class TimpsClient {
    request(path, method, body) {
        return new Promise((resolve, reject) => {
            const { serverUrl } = getConfig();
            const url = new URL(serverUrl + '/api' + path);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            const data = body ? JSON.stringify(body) : undefined;
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                },
                timeout: 8000,
            };
            const req = lib.request(options, (res) => {
                let raw = '';
                res.on('data', (chunk) => (raw += chunk));
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(raw));
                    }
                    catch {
                        resolve(null);
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('TIMPs request timed out')); });
            if (data)
                req.write(data);
            req.end();
        });
    }
    async addMemory(params) {
        const { userId } = getConfig();
        return this.request('/chat', 'POST', {
            userId,
            message: `Store memory [${params.memory_type}]: ${params.content.slice(0, 300)}`,
        });
    }
    async retrieveMemories(params) {
        const { userId } = getConfig();
        const res = await this.request(`/memory/${userId}`, 'GET');
        return res?.memories || [];
    }
}
exports.TimpsClient = TimpsClient;
