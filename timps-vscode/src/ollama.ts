// ============================================================
// TIMPs VS Code Extension — Ollama API Client
// Direct HTTP communication with Ollama server
// ============================================================

import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import { ChatMessage, ChatOptions, GenerateOptions, OllamaModel, OllamaChatResponse, OllamaPullStatus } from './types';

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const PULL_TIMEOUT = 600000; // 10 minutes for pulling models

/**
 * Parse the Ollama URL and determine if we need http or https module
 */
function getHttpClient(targetUrl: string): { mod: typeof http; parsed: url.UrlWithStringQuery } {
    const parsed = url.parse(targetUrl);
    if (parsed.protocol === 'https:') {
        return { mod: https as any, parsed };
    }
    return { mod: http, parsed };
}

/**
 * Make an HTTP request and return the raw response
 */
function request(
    targetUrl: string,
    method: string,
    path: string,
    body?: string,
    timeout: number = DEFAULT_TIMEOUT
): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
        const { mod, parsed } = getHttpClient(targetUrl);
        const options: http.RequestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: timeout,
        };

        if (body) {
            options.headers!['Content-Length'] = Buffer.byteLength(body);
        }

        const req = mod.request(options, (res) => {
            resolve(res);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request to ${targetUrl}${path} timed out after ${timeout}ms`));
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

/**
 * Check if Ollama server is running
 */
export async function checkOllamaRunning(ollamaUrl: string): Promise<boolean> {
    try {
        const res = await request(ollamaUrl, 'GET', '/', undefined, 5000);
        // Consume response to free the socket
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        await new Promise<void>((resolve, reject) => {
            res.on('end', resolve);
            res.on('error', reject);
        });
        return res.statusCode === 200 || res.statusCode === 304;
    } catch {
        return false;
    }
}

/**
 * Check if a specific model exists in Ollama
 */
export async function checkModelExists(ollamaUrl: string, model: string): Promise<boolean> {
    try {
        const models = await listModels(ollamaUrl);
        // Ollama model names can match with or without tags
        return models.some((m) => {
            const mBase = m.split(':')[0];
            const modelBase = model.split(':')[0];
            return m === model || mBase === modelBase || m === modelBase;
        });
    } catch {
        return false;
    }
}

/**
 * List all available models
 */
export async function listModels(ollamaUrl: string): Promise<string[]> {
    const res = await request(ollamaUrl, 'GET', '/api/tags', undefined, 10000);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    await new Promise<void>((resolve, reject) => {
        res.on('end', resolve);
        res.on('error', reject);
    });

    if (res.statusCode !== 200) {
        throw new Error(`Failed to list models: HTTP ${res.statusCode}`);
    }

    const parsed = JSON.parse(data);
    if (parsed.models && Array.isArray(parsed.models)) {
        return parsed.models.map((m: OllamaModel) => m.name);
    }
    return [];
}

/**
 * Pull a model from Ollama registry with progress reporting
 */
export async function pullModel(
    ollamaUrl: string,
    model: string,
    onProgress?: (status: string) => void
): Promise<void> {
    const body = JSON.stringify({ name: model, stream: true });
    const res = await request(ollamaUrl, 'POST', '/api/pull', body, PULL_TIMEOUT);

    if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', (chunk) => { errData += chunk; });
        await new Promise<void>((resolve) => { res.on('end', resolve); });
        throw new Error(`Failed to pull model: HTTP ${res.statusCode} — ${errData}`);
    }

    return new Promise((resolve, reject) => {
        let buffer = '';
        res.on('data', (chunk) => {
            buffer += chunk.toString();
            // Process newline-delimited JSON
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const status: OllamaPullStatus = JSON.parse(line);
                        if (onProgress) {
                            let msg = status.status;
                            if (status.total && status.completed) {
                                const pct = Math.round((status.completed / status.total) * 100);
                                msg = `${status.status} (${pct}%)`;
                            }
                            onProgress(msg);
                        }
                        if (status.status === 'success') {
                            resolve();
                            return;
                        }
                    } catch {
                        // Skip malformed lines
                    }
                }
            }
        });

        res.on('end', () => {
            // If we didn't get a success status, check the last buffer
            if (buffer.trim()) {
                try {
                    const status: OllamaPullStatus = JSON.parse(buffer);
                    if (status.status === 'success') {
                        resolve();
                        return;
                    }
                } catch {
                    // ignore
                }
            }
            resolve();
        });

        res.on('error', reject);
    });
}

/**
 * Streaming chat completion with Ollama
 */
export async function* chat(
    ollamaUrl: string,
    model: string,
    messages: ChatMessage[],
    options?: ChatOptions,
    abortSignal?: AbortSignal
): AsyncGenerator<string> {
    const payload: any = {
        model: model,
        messages: messages,
        stream: true,
    };

    if (options?.temperature !== undefined) {
        payload.options = { ...payload.options, temperature: options.temperature };
    }
    if (options?.maxTokens !== undefined) {
        payload.options = { ...payload.options, num_predict: options.maxTokens };
    }

    const body = JSON.stringify(payload);
    const res = await request(ollamaUrl, 'POST', '/api/chat', body, DEFAULT_TIMEOUT);

    if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', (chunk) => { errData += chunk; });
        await new Promise<void>((resolve) => { res.on('end', resolve); });
        throw new Error(`Chat request failed: HTTP ${res.statusCode} — ${errData}`);
    }

    let buffer = '';

    try {
        while (true) {
            if (abortSignal?.aborted) {
                res.destroy();
                break;
            }

            const chunk = await new Promise<Buffer | null>((resolve, reject) => {
                res.once('data', (d: Buffer) => resolve(d));
                res.once('end', () => resolve(null));
                res.once('error', reject);
            });

            if (chunk === null) break;

            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const parsed: OllamaChatResponse = JSON.parse(line);
                        if (parsed.message && parsed.message.content) {
                            yield parsed.message.content;
                        }
                        if (parsed.done) {
                            return;
                        }
                    } catch {
                        // Skip malformed lines
                    }
                }
            }
        }
    } finally {
        res.destroy();
    }
}

/**
 * Streaming text generation with Ollama
 */
export async function* generate(
    ollamaUrl: string,
    model: string,
    prompt: string,
    options?: GenerateOptions,
    abortSignal?: AbortSignal
): AsyncGenerator<string> {
    const payload: any = {
        model: model,
        prompt: prompt,
        stream: true,
    };

    if (options?.temperature !== undefined) {
        payload.options = { ...payload.options, temperature: options.temperature };
    }
    if (options?.maxTokens !== undefined) {
        payload.options = { ...payload.options, num_predict: options.maxTokens };
    }

    const body = JSON.stringify(payload);
    const res = await request(ollamaUrl, 'POST', '/api/generate', body, DEFAULT_TIMEOUT);

    if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', (chunk) => { errData += chunk; });
        await new Promise<void>((resolve) => { res.on('end', resolve); });
        throw new Error(`Generate request failed: HTTP ${res.statusCode} — ${errData}`);
    }

    let buffer = '';

    try {
        while (true) {
            if (abortSignal?.aborted) {
                res.destroy();
                break;
            }

            const chunk = await new Promise<Buffer | null>((resolve, reject) => {
                res.once('data', (d: Buffer) => resolve(d));
                res.once('end', () => resolve(null));
                res.once('error', reject);
            });

            if (chunk === null) break;

            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.response) {
                            yield parsed.response;
                        }
                        if (parsed.done) {
                            return;
                        }
                    } catch {
                        // Skip malformed lines
                    }
                }
            }
        }
    } finally {
        res.destroy();
    }
}

/**
 * Non-streaming chat completion (for simple use cases)
 */
export async function chatOnce(
    ollamaUrl: string,
    model: string,
    messages: ChatMessage[],
    options?: ChatOptions
): Promise<string> {
    let result = '';
    for await (const chunk of chat(ollamaUrl, model, messages, options)) {
        result += chunk;
    }
    return result;
}
