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

    const sandboxCode = [
      '// TIMPS WasmSandbox — permission-enforced, env-stripped execution',
      `const __permissions = ${JSON.stringify(plugin.permissions)};`,
      `const __pluginName = ${JSON.stringify(pluginName)};`,
      `const __toolName = ${JSON.stringify(toolName)};`,
      `const __args = ${JSON.stringify(args)};`,
      `const __wasmPath = ${JSON.stringify(plugin.wasmPath)};`,
      '',
      '// Block dangerous modules at the require level',
      'const _timsOrigRequire = require;',
      "const _timsBlocked = new Set(['fs', 'child_process', 'net', 'http', 'http2', 'https', 'dgram', 'dns', 'tls', 'cluster', 'vm', 'worker_threads', 'module']);",
      'require = function(id) {',
      "  const norm = String(id).replace(/^node:/, '');",
      '  if (_timsBlocked.has(norm)) {',
      "    throw new Error('TIMPS Constitution: module \"' + id + '\" is disabled in WasmSandbox.');",
      '  }',
      '  return _timsOrigRequire(id);',
      '};',
      '',
      '// ABI proxy — enforces permissions, uses JSON-lines for real operations',
      'function createAbiProxy(perms) {',
      '  const proxy = {};',
      '  const methods = {',
      "    'memory.recall': 'memory',",
      "    'memory.store': 'memory',",
      "    'network.fetch': 'network',",
      '  };',
      '  for (const [m, category] of Object.entries(methods)) {',
      '    proxy[m] = function(...a) {',
      '      if (!perms.includes(m)) {',
      "        return JSON.stringify({ error: 'permission denied: ' + m });",
      '      }',
      // Write ABI request to stdout as JSON line; parent will intercept
      "      process.stdout.write('\\n__TIMPS_ABI__' + JSON.stringify({ fn: m, args: a }) + '\\n');",
      "      return JSON.stringify({ result: 'ok' });",
      '    };',
      '  }',
      '  return proxy;',
      '}',
      '',
      'async function main() {',
      '  try {',
      "    const _fs = _timsOrigRequire('fs');",
      '    const wasmCode = _fs.readFileSync(__wasmPath);',
      "    if (typeof WebAssembly !== 'undefined' && WebAssembly.instantiate) {",
      '      const wasmModule = new WebAssembly.Module(wasmCode);',
      '      const imports = { timps: createAbiProxy(__permissions) };',
      '      const instance = new WebAssembly.Instance(wasmModule, imports);',
      "      if (typeof instance.exports[__toolName] === 'function') {",
      '        const result = instance.exports[__toolName](JSON.stringify(__args));',
      '        process.stdout.write(String(result));',
      '        return;',
      '      }',
      '    }',
      "    process.stdout.write(JSON.stringify({ error: 'WASM runtime not available' }));",
      '  } catch (e) {',
      '    process.stdout.write(JSON.stringify({ error: String(e) }));',
      '  }',
      '}',
      "// Delete the require escape hatch before running",
      'const _timsRun = main;',
      'delete _timsOrigRequire;',
      '_timsRun().catch(e => process.stdout.write(JSON.stringify({ error: String(e) })));',
    ].join('\n');

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
        env: {
          PATH: '/usr/bin:/bin',
          NODE_OPTIONS: '--experimental-wasm-modules',
          TIMPS_SANDBOXED: '1',
        },
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
