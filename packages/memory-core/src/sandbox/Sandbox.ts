// ── @timps/memory-core — Sandbox ──
// Constitutional runtime isolation.

import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export type Runtime = 'python' | 'node' | 'bash' | 'auto';

export type NetworkPolicy = 'none' | 'allow-list' | 'full';

export interface SandboxOptions {
  runtime: Runtime;
  workspaceDir?: string;
  memoryMb?: number;
  cpuShares?: number;
  timeoutMs?: number;
  network?: NetworkPolicy;
  networkAllowList?: string[];
  env?: Record<string, string>;
  files?: { path: string; content: string }[];
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  killed: boolean;
  scriptHash: string;
}

export interface SandboxHandle {
  id: string;
  options: SandboxOptions;
  workspaceDir: string;
  exec(command: string, args: string[], opts?: { stdin?: string; timeoutMs?: number }): Promise<ExecResult>;
  writeFile(p: string, content: string): Promise<void>;
  readFile(p: string): Promise<string>;
  destroy(): Promise<void>;
}

const DEFAULT_OPTIONS: Required<Omit<SandboxOptions, 'networkAllowList' | 'env' | 'files'>> = {
  runtime: 'auto',
  workspaceDir: '',
  memoryMb: 512,
  cpuShares: 1024,
  timeoutMs: 30_000,
  network: 'none',
};

// ── SubprocessSandbox — the universal fallback ──

export class SubprocessSandbox implements SandboxHandle {
  id: string;
  options: Required<Omit<SandboxOptions, 'networkAllowList' | 'env' | 'files'>> & {
    networkAllowList: string[];
    env: Record<string, string>;
    files: { path: string; content: string }[];
  };
  workspaceDir: string;
  destroyed = false;

  constructor(opts: SandboxOptions) {
    this.id = 'sbx_' + crypto.randomBytes(6).toString('hex');
    this.options = {
      ...DEFAULT_OPTIONS,
      ...opts,
      networkAllowList: opts.networkAllowList ?? [],
      env: opts.env ?? {},
      files: opts.files ?? [],
    } as any;
    this.workspaceDir = opts.workspaceDir ?? this.createTempWorkspace();
    this.materializeFiles();
  }

  private createTempWorkspace(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'timps-sbx-'));
  }

  private materializeFiles(): void {
    for (const f of this.options.files) {
      const full = path.join(this.workspaceDir, f.path);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, f.content, 'utf-8');
    }
  }

  async exec(command: string, args: string[], opts?: { stdin?: string; timeoutMs?: number }): Promise<ExecResult> {
    if (this.destroyed) throw new Error('Sandbox destroyed');
    const start = Date.now();
    const timeoutMs = opts?.timeoutMs ?? this.options.timeoutMs;
    const scriptHash = crypto.createHash('sha256').update(command + '\n' + args.join(' ')).digest('hex').slice(0, 16);

    return new Promise<ExecResult>((resolve) => {
      const child: ChildProcess = spawn(command, args, {
        cwd: this.workspaceDir,
        env: this.buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killed = false;

      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, timeoutMs);

      child.stdout?.on('data', d => { stdout += d.toString(); });
      child.stderr?.on('data', d => { stderr += d.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code ?? -1,
          stdout: stdout.slice(0, 1_048_576),
          stderr: stderr.slice(0, 1_048_576),
          durationMs: Date.now() - start,
          timedOut,
          killed,
          scriptHash,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + (stderr ? '\n' : '') + err.message,
          durationMs: Date.now() - start,
          timedOut,
          killed,
          scriptHash,
        });
      });

      if (opts?.stdin && child.stdin) {
        child.stdin.write(opts.stdin);
        child.stdin.end();
      } else if (child.stdin) {
        child.stdin.end();
      }
    });
  }

  async writeFile(p: string, content: string): Promise<void> {
    const full = this.resolve(p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }

  async readFile(p: string): Promise<string> {
    return fs.readFileSync(this.resolve(p), 'utf-8');
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      fs.rmSync(this.workspaceDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  }

  private resolve(p: string): string {
    const full = path.isAbsolute(p) ? p : path.join(this.workspaceDir, p);
    const resolved = path.resolve(full);
    if (!resolved.startsWith(path.resolve(this.workspaceDir))) {
      throw new Error(`Path ${p} escapes sandbox workspace`);
    }
    return resolved;
  }

  private buildEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      PATH: this.safePath(),
      HOME: this.workspaceDir,
      TMPDIR: this.workspaceDir,
      TIMPS_SANDBOXED: '1',
      TIMPS_SANDBOX_ID: this.id,
      ...this.options.env,
    };

    if (this.options.network === 'none') {
      env.HTTP_PROXY = '';
      env.HTTPS_PROXY = '';
      env.NO_PROXY = '*';
      delete env.DOCKER_HOST;
      delete env.KUBECONFIG;
    }

    return env;
  }

  private safePath(): string {
    return [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      this.workspaceDir,
    ].join(path.delimiter);
  }
}

// ── PythonSandbox — uses a per-execution venv ──

export class PythonSandbox extends SubprocessSandbox {
  private venvDir: string;

  constructor(opts: SandboxOptions) {
    super({ ...opts, runtime: 'python' });
    this.venvDir = path.join(this.workspaceDir, '.venv');
    this.setupVenv();
  }

  private setupVenv(): void {
    try {
      const r = require('node:child_process').spawnSync('python3', ['-m', 'venv', this.venvDir], {
        stdio: 'pipe',
        timeout: 60_000,
      });
      if (r.status === 0) {
        const pip = this.venvDir + '/bin/pip';
        if (fs.existsSync(pip)) {
          // ok
        }
      }
    } catch {
      // venv unavailable, fall through
    }
  }

  async exec(pythonCode: string, args: string[] = [], opts?: { stdin?: string; timeoutMs?: number }): Promise<ExecResult> {
    const py = this.venvDir + '/bin/python';
    const usePy = fs.existsSync(py) ? py : 'python3';
    const code = this.options.network === 'none' ? this.injectPythonNetBlock(pythonCode) : pythonCode;
    return super.exec(usePy, ['-c', code, ...args], opts);
  }

  private injectPythonNetBlock(code: string): string {
    return [
      '# TIMPS Constitutional network block',
      'import socket as _tims_sock',
      '_tims_orig_create_connection = _tims_sock.create_connection',
      '_tims_orig_socket = _tims_sock.socket',
      'def _tims_blocked_create_connection(*a, **kw):',
      '    raise PermissionError("TIMPS Constitution: network is disabled in this sandbox. Set network=allow-list or full to enable.")',
      '_tims_sock.create_connection = _tims_blocked_create_connection',
      'class _tims_blocked_socket(_tims_orig_socket):',
      '    def connect(self, *a, **kw):',
      '        raise PermissionError("TIMPS Constitution: network is disabled in this sandbox. Set network=allow-list or full to enable.")',
      '    def connect_ex(self, *a, **kw):',
      '        raise PermissionError("TIMPS Constitution: network is disabled in this sandbox.")',
      '_tims_sock.socket = _tims_blocked_socket',
      'try:',
      '    import urllib.request as _tims_urllib',
      '    _tims_orig_urlopen = _tims_urllib.urlopen',
      '    def _tims_blocked_urlopen(*a, **kw):',
      '        raise PermissionError("TIMPS Constitution: HTTP is disabled in this sandbox.")',
      '    _tims_urllib.urlopen = _tims_blocked_urlopen',
      'except ImportError: pass',
      'del _tims_sock, _tims_orig_create_connection, _tims_orig_socket, _tims_blocked_create_connection, _tims_blocked_socket',
      'try: del _tims_urllib, _tims_orig_urlopen, _tims_blocked_urlopen',
      'except NameError: pass',
      '',
      code,
    ].join('\n');
  }
}

// ── NodeSandbox — spawns Node with restricted env ──

export class NodeSandbox extends SubprocessSandbox {
  constructor(opts: SandboxOptions) {
    super({ ...opts, runtime: 'node' });
  }

  async exec(jsCode: string, args: string[] = [], opts?: { stdin?: string; timeoutMs?: number }): Promise<ExecResult> {
    const code = this.options.network === 'none' ? this.injectNodeNetBlock(jsCode) : jsCode;
    return super.exec(process.execPath, ['-e', code, ...args], opts);
  }

  private injectNodeNetBlock(code: string): string {
    return [
      '// TIMPS Constitutional network block',
      "(function(){",
      "  const _timsBlocked = new Set(['net','http','http2','https','dgram','dns','tls']);",
      "  const _timsOrigRequire = require;",
      "  require = function(id){",
      "    const norm = String(id).replace(/^node:/, '');",
      "    if (_timsBlocked.has(norm)) {",
      "      throw new Error('TIMPS Constitution: network module \"' + id + '\" is disabled in this sandbox.');",
      "    }",
      "    return _timsOrigRequire(id);",
      "  };",
      "})();",
      code,
    ].join('\n');
  }
}

// ── BashSandbox — runs shell code ──

export class BashSandbox extends SubprocessSandbox {
  constructor(opts: SandboxOptions) {
    super({ ...opts, runtime: 'bash' });
  }

  async exec(shellCode: string, args: string[] = [], opts?: { stdin?: string; timeoutMs?: number }): Promise<ExecResult> {
    return super.exec('bash', ['-c', shellCode, ...args], opts);
  }
}

// ── SandboxRouter — auto-detect language and pick backend ──

export class SandboxRouter {
  static detect(code: string, filename?: string): Runtime {
    if (filename) {
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.py') return 'python';
      if (ext === '.js' || ext === '.mjs' || ext === '.ts') return 'node';
      if (ext === '.sh' || ext === '.bash') return 'bash';
    }
    if (/^#!.*\bpython\b/m.test(code)) return 'python';
    if (/^#!.*\bnode\b/m.test(code)) return 'node';
    if (/^#!.*\bbash\b/m.test(code) || /^#!.*\bsh\b/m.test(code)) return 'bash';
    if (/^def\s+\w+\s*\(/m.test(code) || /^import\s+\w+/m.test(code)) return 'python';
    if (/require\s*\(/.test(code) || /\bmodule\.exports\b/.test(code) || /\bconst\s+\w+\s*=\s*require\b/.test(code)) return 'node';
    return 'bash';
  }

  static create(opts: SandboxOptions): SandboxHandle {
    let runtime = opts.runtime;
    if (runtime === 'auto') {
      runtime = SandboxRouter.detect(opts.files?.[0]?.content ?? '', opts.files?.[0]?.path);
    }
    if (runtime === 'python') return new PythonSandbox(opts);
    if (runtime === 'node') return new NodeSandbox(opts);
    if (runtime === 'bash') return new BashSandbox(opts);
    return new SubprocessSandbox(opts);
  }
}
