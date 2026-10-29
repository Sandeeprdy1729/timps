// ── timps-mcp CLI options ──
// Kept free of side effects so it can be unit-tested without starting a server.

export interface CliOptions {
  http: boolean;
  port: number;
  host: string;
  help: boolean;
  version: boolean;
}

const DEFAULT_PORT = 4200;
const DEFAULT_HOST = '127.0.0.1';

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliOptions {
  const flagValue = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };

  const rawPort = flagValue('--port') ?? env.TIMPS_MCP_PORT ?? String(DEFAULT_PORT);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  return {
    http: argv.includes('--http'),
    port,
    host: flagValue('--host') ?? env.TIMPS_MCP_HOST ?? DEFAULT_HOST,
    help: argv.includes('--help') || argv.includes('-h'),
    version: argv.includes('--version') || argv.includes('-v'),
  };
}

export function usage(version: string): string {
  return [
    `timps-mcp ${version} — persistent memory MCP server for coding agents`,
    '',
    'Usage: timps-mcp [--http [--port <n>] [--host <addr>]]',
    '',
    '  (no flags)       stdio transport (Claude Code, Cursor, Windsurf, ...)',
    '  --http           streamable HTTP transport on /mcp',
    `  --port <n>       HTTP port (default ${DEFAULT_PORT}, env TIMPS_MCP_PORT)`,
    `  --host <addr>    HTTP bind address (default ${DEFAULT_HOST}, env TIMPS_MCP_HOST)`,
    '  -v, --version    print the version',
    '  -h, --help       print this help',
    '',
    'HTTP security:',
    '  TIMPS_MCP_TOKEN            require "Authorization: Bearer <token>" on /mcp',
    '  TIMPS_MCP_ALLOWED_ORIGINS  comma-separated browser origins to allow (loopback is always allowed)',
    '',
    'Memory is stored under ~/.timps/memory/<project hash>; set TIMPS_PROJECT_PATH to pick the project.',
    'Set TIMPS_URL to proxy tools to a TIMPS server instead (server mode).',
  ].join('\n');
}

/** Reject API paths that could escape `/api` on the TIMPS server. */
export function validateApiPath(path: string): void {
  if (!path.startsWith('/') || path.includes('..') || /[<>"|]/.test(path)) {
    throw new Error(`Invalid API path: ${path}`);
  }
}
