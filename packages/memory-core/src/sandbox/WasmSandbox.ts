import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import type { Permission } from '../marketplace/types.js';

export interface WasmPlugin {
  id: string;
  name: string;
  wasmPath: string;
  permissions: Permission[];
  hooks: string[];
  tools: string[];
}

export interface WasmExecResult {
  success: boolean;
  output: string;
  durationMs: number;
  error?: string;
}

export class WasmSandbox {
  private plugins = new Map<string, WasmPlugin>();
  private pluginDir: string;

  constructor(baseDir: string) {
    this.pluginDir = path.join(baseDir, 'wasm-plugins');
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
  }

  install(wasmBuffer: Buffer, manifest: { name: string; permissions: Permission[]; hooks?: string[]; tools?: string[] }): WasmPlugin {
    const pluginDir = path.join(this.pluginDir, manifest.name);
    if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir, { recursive: true });

    const wasmPath = path.join(pluginDir, 'plugin.wasm');
    fs.writeFileSync(wasmPath, wasmBuffer);

    const plugin: WasmPlugin = {
      id: crypto.randomBytes(6).toString('hex'),
      name: manifest.name,
      wasmPath,
      permissions: manifest.permissions,
      hooks: manifest.hooks ?? [],
      tools: manifest.tools ?? [],
    };
    this.plugins.set(manifest.name, plugin);
    return plugin;
  }

  getPlugin(name: string): WasmPlugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): WasmPlugin[] {
    return Array.from(this.plugins.values());
  }

  uninstall(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    const pluginDir = path.dirname(plugin.wasmPath);
    if (fs.existsSync(pluginDir)) fs.rmSync(pluginDir, { recursive: true, force: true });
    this.plugins.delete(name);
    return true;
  }

  async executeJS(pluginName: string, toolName: string, args: Record<string, unknown>, abi: Record<string, Function>): Promise<WasmExecResult> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return { success: false, output: '', durationMs: 0, error: `Plugin not found: ${pluginName}` };

    if (!plugin.tools.includes(toolName) && toolName !== '__hook__') {
      return { success: false, output: '', durationMs: 0, error: `Tool not found: ${toolName}` };
    }

    const start = Date.now();
    const scriptPath = path.join(path.dirname(plugin.wasmPath), 'exec.js');

    const sandboxCode = `
const __permissions = ${JSON.stringify(plugin.permissions)};
const __abi = ${JSON.stringify(Object.keys(abi))};
const __pluginName = ${JSON.stringify(pluginName)};
const __toolName = ${JSON.stringify(toolName)};
const __args = ${JSON.stringify(args)};

const timps = {};
for (const fn of __abi) {
  timps[fn] = (...a) => {
    console.log(JSON.stringify({ type: 'abi_call', fn, args: a }));
    return null;
  };
}

const handler = ${plugin.permissions.includes('network') ? 'null' : 'null'};

async function main() {
  const module = { exports: {} };
  const wasmCode = require('fs').readFileSync(${JSON.stringify(plugin.wasmPath)});
  // WASM execution via WebAssembly global if available
  try {
    if (typeof WebAssembly !== 'undefined' && WebAssembly.instantiate) {
      const wasmModule = new WebAssembly.Module(wasmCode);
      const imports = { timps: createAbiProxy(__permissions) };
      const instance = new WebAssembly.Instance(wasmModule, imports);
      if (typeof instance.exports[__toolName] === 'function') {
        return instance.exports[__toolName](JSON.stringify(__args));
      }
    }
  } catch (e) {
    // WASM not available, return error
    return JSON.stringify({ error: String(e) });
  }
  return JSON.stringify({ error: 'WASM runtime not available in this environment' });
}

function createAbiProxy(perms) {
  const proxy = {};
  const methods = ['memory.recall', 'memory.store', 'network.fetch'];
  for (const m of methods) {
    proxy[m] = perms.includes(m) ? (...a) => JSON.stringify({ result: 'stub_' + m, args: a }) : () => JSON.stringify({ error: 'permission denied: ' + m });
  }
  return proxy;
}

main().then(r => process.stdout.write(String(r))).catch(e => process.stdout.write(JSON.stringify({ error: String(e) })));
`;

    fs.writeFileSync(scriptPath, sandboxCode);

    try {
      const result = await this.runNode(scriptPath);
      return {
        success: true,
        output: result.stdout,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        durationMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  private runNode(scriptPath: string): Promise<{ stdout: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['--no-warnings', scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
        env: { ...process.env, NODE_OPTIONS: '--experimental-wasm-modules' },
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0 || stdout) resolve({ stdout });
        else reject(new Error(stderr || `exit code ${code}`));
      });
      proc.on('error', reject);
    });
  }

  async executeWasm(wasmPath: string, toolName: string, input: string): Promise<WasmExecResult> {
    const start = Date.now();
    try {
      const proc = spawn('wasmtime', [wasmPath, '--invoke', toolName], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      });
      let stdout = '';
      let stderr = '';
      proc.stdin.write(input);
      proc.stdin.end();
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      await new Promise<void>((resolve, reject) => {
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(stderr || `wasmtime exit ${code}`));
        });
        proc.on('error', reject);
      });
      return { success: true, output: stdout, durationMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, output: '', durationMs: Date.now() - start, error: err.message };
    }
  }
}
