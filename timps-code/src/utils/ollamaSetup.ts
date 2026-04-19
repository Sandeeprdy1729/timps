// ── Ollama Auto-Setup ──
// Check if Ollama is installed, running, and has the required model.
// Auto-pull qwen2.5-coder if missing.

import * as childProcess from 'node:child_process';
import * as readline from 'node:readline';
import { t, icons } from '../config/theme.js';

/** Prompt the user with a yes/no question. */
async function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`  ${question} ${t.dim('(y/n)')} `, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Attempt to install Ollama on the system (macOS: brew, Linux: install script).
 */
export async function installOllama(): Promise<boolean> {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      console.log(`\n  ${t.accent(`${icons.arrow} Installing Ollama via Homebrew...`)}`);
      childProcess.execSync('brew install ollama', { stdio: 'inherit', timeout: 120_000 });
    } else {
      console.log(`\n  ${t.accent(`${icons.arrow} Installing Ollama...`)}`);
      childProcess.execSync('curl -fsSL https://ollama.ai/install.sh | sh', {
        stdio: 'inherit',
        timeout: 120_000,
      });
    }
    console.log(`  ${t.success(`${icons.success} Ollama installed!`)}`);
    return true;
  } catch (err) {
    console.log(`  ${t.error(`${icons.error} Installation failed: ${(err as Error).message}`)}`);
    return false;
  }
}

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  modelReady: boolean;
  model: string;
  availableModels: string[];
}

/**
 * Check if Ollama binary exists on the system.
 */
export function isOllamaInstalled(): boolean {
  try {
    childProcess.execSync('which ollama', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Ollama server is running and responsive.
 */
export async function isOllamaRunning(baseUrl = 'http://localhost:11434'): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of locally available models from Ollama.
 */
export async function getLocalModels(baseUrl = 'http://localhost:11434'): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json() as { models?: { name: string }[] };
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

/**
 * Check if a specific model is available locally.
 */
export async function isModelAvailable(model: string, baseUrl = 'http://localhost:11434'): Promise<boolean> {
  const models = await getLocalModels(baseUrl);
  // Match with or without tag (e.g., "qwen2.5-coder:7b" matches "qwen2.5-coder:7b")
  return models.some(m => m === model || m.startsWith(model.split(':')[0]));
}

/**
 * Pull a model from Ollama registry with live progress display.
 */
export async function pullModel(model: string, baseUrl = 'http://localhost:11434'): Promise<boolean> {
  console.log(`\n  ${t.accent(`${icons.arrow} Pulling ${model}...`)}`);
  console.log(`  ${t.dim('This may take a few minutes on first run.\n')}`);

  try {
    const res = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(`  ${t.error(`${icons.error} Pull failed: ${err}`)}`);
      return false;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastStatus = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as {
            status?: string;
            completed?: number;
            total?: number;
            digest?: string;
          };

          if (data.status && data.status !== lastStatus) {
            lastStatus = data.status;
            if (data.total && data.completed) {
              const pct = Math.round((data.completed / data.total) * 100);
              const bar = renderProgress(pct);
              process.stdout.write(`\r  ${bar} ${t.dim(data.status)} `);
            } else {
              process.stdout.write(`\r  ${t.dim(`${icons.thinking} ${data.status}`)}${' '.repeat(30)}`);
            }
          } else if (data.total && data.completed) {
            const pct = Math.round((data.completed / data.total) * 100);
            const bar = renderProgress(pct);
            process.stdout.write(`\r  ${bar} ${t.dim(`${pct}%`)} `);
          }
        } catch { /* skip */ }
      }
    }

    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    console.log(`  ${t.success(`${icons.success} ${model} ready!`)}\n`);
    return true;
  } catch (err) {
    console.log(`\n  ${t.error(`${icons.error} Pull failed: ${(err as Error).message}`)}`);
    return false;
  }
}

/**
 * Start Ollama server if not running (macOS: open app, Linux: ollama serve).
 */
export function tryStartOllama(): boolean {
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      // macOS — try opening the Ollama app
      childProcess.execSync('open -a Ollama', { stdio: 'pipe', timeout: 5000 });
    } else {
      // Linux — start ollama serve in background
      childProcess.spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Full interactive auto-setup: check Ollama → ask to install/start → check model → pull if needed.
 */
export async function ensureOllamaReady(
  model = 'qwen2.5-coder:7b',
  baseUrl = 'http://localhost:11434',
): Promise<OllamaStatus> {
  const status: OllamaStatus = {
    installed: false,
    running: false,
    modelReady: false,
    model,
    availableModels: [],
  };

  // Step 1: Check if Ollama is installed
  status.installed = isOllamaInstalled();
  if (!status.installed) {
    console.log(`\n  ${t.warning(`${icons.warning} Ollama is not installed on your system.`)}`);
    const shouldInstall = await askYesNo(`${t.brandBold('Would you like me to install Ollama?')}`);
    if (shouldInstall) {
      const ok = await installOllama();
      status.installed = ok;
      if (!ok) {
        console.log(`  ${t.dim('You can install manually from:')} ${t.accent('https://ollama.ai')}`);
        console.log(`  ${t.dim('macOS:')} ${t.code('brew install ollama')}`);
        console.log(`  ${t.dim('Linux:')} ${t.code('curl -fsSL https://ollama.ai/install.sh | sh')}\n`);
        return status;
      }
    } else {
      console.log(`\n  ${t.dim('You can install Ollama later from:')} ${t.accent('https://ollama.ai')}\n`);
      return status;
    }
  }

  // Step 2: Check if Ollama is running
  status.running = await isOllamaRunning(baseUrl);
  if (!status.running) {
    const shouldStart = await askYesNo(`${t.warning(`${icons.warning} Ollama is not running.`)} ${t.brandBold('Should I start it?')}`);
    if (shouldStart) {
      console.log(`  ${t.dim(`${icons.thinking} Starting Ollama...`)}`);
      const started = tryStartOllama();
      if (started) {
        // Wait for startup
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 1000));
          status.running = await isOllamaRunning(baseUrl);
          if (status.running) break;
        }
      }
      if (!status.running) {
        console.log(`  ${t.error(`${icons.error} Could not start Ollama`)}`);
        console.log(`  ${t.dim('Try running manually:')} ${t.code('ollama serve')}\n`);
        return status;
      }
      console.log(`  ${t.success(`${icons.success} Ollama is running!`)}`);
    } else {
      console.log(`\n  ${t.dim('Start Ollama when ready:')} ${t.code('ollama serve')}\n`);
      return status;
    }
  }

  // Step 3: Get available models
  status.availableModels = await getLocalModels(baseUrl);

  // Step 4: Check if the requested model is available
  status.modelReady = status.availableModels.some(
    m => m === model || m.startsWith(model.split(':')[0])
  );

  if (!status.modelReady) {
    console.log(`  ${t.warning(`${icons.warning} Model ${t.accent(model)} not found locally`)}`);
    console.log(`  ${t.dim(`Available: ${status.availableModels.length > 0 ? status.availableModels.join(', ') : 'none'}`)}`);

    // Auto-pull
    const pulled = await pullModel(model, baseUrl);
    status.modelReady = pulled;
  }

  return status;
}

function renderProgress(pct: number): string {
  const width = 24;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return t.brand('█'.repeat(filled)) + t.dim('░'.repeat(empty));
}
