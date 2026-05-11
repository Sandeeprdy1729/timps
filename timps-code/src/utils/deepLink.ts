// ── TIMPS Code — Deep Link Protocol Handler
// Support for cc:// and cc+unix:// URL schemes

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

export interface DeepLink {
  protocol: 'cc' | 'cc+unix';
  host: string;
  path: string;
  params: Record<string, string>;
  rawUrl: string;
}

export interface DeepLinkOptions {
  cwd?: string;
  sessionId?: string;
  agentId?: string;
  model?: string;
  provider?: string;
  command?: string;
}

export function parseDeepLink(url: string): DeepLink {
  const cleanUrl = url.trim();

  if (!cleanUrl.startsWith('cc://') && !cleanUrl.startsWith('cc+unix://')) {
    throw new Error(`Invalid protocol: ${url}. Expected cc:// or cc+unix://`);
  }

  const isUnix = cleanUrl.startsWith('cc+unix://');
  const withoutProtocol = isUnix
    ? cleanUrl.slice('cc+unix://'.length)
    : cleanUrl.slice('cc://'.length);

  const protocol = isUnix ? 'cc+unix' : 'cc';

  let host = '';
  let pathPart = '';

  // Unix sockets: path to socket
  if (isUnix && withoutProtocol.includes('/')) {
    const slashIdx = withoutProtocol.indexOf('/');
    host = withoutProtocol.slice(0, slashIdx);
    pathPart = withoutProtocol.slice(slashIdx + 1);
  }
  // Regular: host/path
  else if (withoutProtocol.includes('/')) {
    const slashIdx = withoutProtocol.indexOf('/');
    host = withoutProtocol.slice(0, slashIdx);
    pathPart = withoutProtocol.slice(slashIdx + 1);
  }
  // Just host
  else {
    host = withoutProtocol;
    pathPart = '';
  }

  // Parse query params
  const params: Record<string, string> = {};
  if (pathPart.includes('?')) {
    const [pp, query] = pathPart.split('?');
    pathPart = pp;
    for (const pair of query.split('&')) {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }

  return {
    protocol,
    host,
    path: pathPart,
    params,
    rawUrl: url,
  };
}

export async function handleDeepLinkUri(uri: string, options: DeepLinkOptions = {}): Promise<void> {
  const link = parseDeepLink(uri);

  // Determine working directory
  let cwd = options.cwd || process.cwd();
  if (link.params.cwd) {
    cwd = link.params.cwd;
  } else {
    // Check MRU (most recently used) directory
    const mruPath = path.join(os.homedir(), '.timps', 'mru.json');
    if (fs.existsSync(mruPath)) {
      try {
        const mru = JSON.parse(fs.readFileSync(mruPath, 'utf-8'));
        if (mru.directory) cwd = mru.directory;
      } catch { /* ignore */ }
    }
  }

  // Build CLI arguments
  const args: string[] = [];

  if (link.params.session) {
    args.push('--resume', link.params.session);
  }

  if (link.params.model) {
    args.push('--model', link.params.model);
  }

  if (link.params.provider) {
    args.push('--provider', link.params.provider);
  }

  if (link.params.agent) {
    args.push('--agent', link.params.agent);
  }

  // Execute TIMPS with deep link context
  await launchInTerminal(args, cwd, {
    env: {
      TIMPS_DEEP_LINK: 'true',
      TIMPS_DEEP_LINK_URL: uri,
      TIMPS_SESSION_ID: link.params.session || '',
      TIMPS_HOST: link.host,
    },
  });
}

export async function launchInTerminal(
  args: string[],
  cwd: string,
  options: { env?: Record<string, string>; detached?: boolean } = {}
): Promise<void> {
  const timpsPath = findTimpsBinary();

  if (!timpsPath) {
    throw new Error('TIMPS binary not found in PATH');
  }

  const childEnv = { ...process.env, ...options.env };

  if (options.detached) {
    const child = spawn(timpsPath, args, {
      cwd,
      env: childEnv,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } else {
    const child = spawn(timpsPath, args, {
      cwd,
      env: childEnv,
      stdio: 'inherit',
    });

    return new Promise((resolve, reject) => {
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`TIMPS exited with code ${code}`));
      });
      child.on('error', reject);
    });
  }
}

function findTimpsBinary(): string | null {
  // Check PATH for timps binary
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter);

  for (const dir of pathDirs) {
    const timpsPath = path.join(dir, 'timps');
    if (fs.existsSync(timpsPath)) {
      return timpsPath;
    }
  }

  // Check common install locations
  const commonPaths = [
    path.join(process.env.HOME || '', '.local', 'bin', 'timps'),
    '/usr/local/bin/timps',
    '/usr/bin/timps',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

// ── URL Scheme Registration ────────────────────────────────────────────────────

export function getUrlSchemeConfig(): { cc: string; ccUnix: string } {
  return {
    cc: 'timps',
    ccUnix: 'timps+unix',
  };
}

export function registerUrlScheme(): void {
  // This would typically use platform-specific APIs
  // For now, just log instructions for the user
  console.log('URL Scheme Registration');
  console.log('======================');
  console.log('To register timps:// URLs on your system:');
  console.log('');
  console.log('macOS: Create a .desktop file or use xdg-utils');
  console.log('Linux: Add to ~/.local/share/applications/');
  console.log('Windows: Use regedit to add to HKCU\\Software\\Classes');
  console.log('');
  console.log('URL formats:');
  console.log('  timps://session/<session-id>');
  console.log('  timps://model/<model-name>');
  console.log('  timps+unix://<socket-path>/<path>');
}
