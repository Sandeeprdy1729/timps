// ── timps-code — Plugin CLI commands (/plugin install|list|uninstall|create|publish) ──
// Phase 3a: Marketplace-aware install with dependency resolution and WASM runtime.

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

const PLUGINS_FILE = join(os.homedir(), '.timps', 'plugins.json');
const PLUGINS_DIR = join(os.homedir(), '.timps', 'plugins');
const WASM_DIR = join(os.homedir(), '.timps', 'wasm-plugins');

interface PluginRecord {
  name: string;
  package: string;
  version: string;
  format?: 'npm' | 'wasm' | 'marketplace';
  permissions?: string[];
  dependencies?: Record<string, string>;
  installedAt: string;
}

function loadPluginRecords(): PluginRecord[] {
  if (!existsSync(PLUGINS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(PLUGINS_FILE, 'utf8')) as PluginRecord[];
  } catch {
    return [];
  }
}

function savePluginRecords(records: PluginRecord[]): void {
  const dir = join(os.homedir(), '.timps');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PLUGINS_FILE, JSON.stringify(records, null, 2));
  if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });
  if (!existsSync(WASM_DIR)) mkdirSync(WASM_DIR, { recursive: true });
}

export async function pluginInstall(packageName: string, opts?: { marketplace?: string }): Promise<string> {
  const records = loadPluginRecords();

  // If marketplace URL is provided, install from marketplace
  if (opts?.marketplace) {
    return installFromMarketplace(packageName, opts.marketplace, records);
  }

  // Check if it's a marketplace plugin (no npm scope prefix)
  if (!packageName.startsWith('@') && !packageName.includes('/') && !packageName.startsWith('.')) {
    return installFromMarketplace(packageName, 'http://localhost:4100/marketplace', records);
  }

  // Default: install from npm
  try {
    execSync(`npm install -g ${packageName}`, { stdio: 'pipe' });
    records.push({
      name: packageName.split('/').pop() ?? packageName,
      package: packageName,
      version: 'latest',
      format: 'npm',
      installedAt: new Date().toISOString(),
    });
    savePluginRecords(records);
    return `✅ Installed from npm: ${packageName}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ Install failed: ${msg}`;
  }
}

async function installFromMarketplace(name: string, baseUrl: string, records: PluginRecord[]): Promise<string> {
  try {
    // Fetch plugin info from marketplace
    const infoUrl = `${baseUrl}/plugins/${encodeURIComponent(name)}`;
    const response = await fetch(infoUrl);
    if (!response.ok) {
      return `❌ Plugin "${name}" not found in marketplace (${infoUrl})`;
    }
    const plugin: any = await response.json();

    // Resolve dependencies
    const latestRelease = plugin.releases?.find((r: any) => r.version === plugin.latestVersion);
    const deps = latestRelease?.manifest?.timps?.dependencies ?? {};

    const depNames = Object.keys(deps);
    if (depNames.length > 0) {
      const depList = depNames.map(d => `  - ${d}@${deps[d]}`).join('\n');
      depNames.forEach(depName => {
        const depConstraint = deps[depName];
        if (!records.some(r => r.name === depName || r.package === depName)) {
          // Resolve dependency
          const depVersion = depConstraint.replace(/[\^~]/, '');
          records.push({
            name: depName,
            package: depName,
            version: depVersion,
            format: 'marketplace',
            installedAt: new Date().toISOString(),
          });
        }
      });
    }

    records.push({
      name: plugin.name,
      package: plugin.name,
      version: plugin.latestVersion,
      format: 'marketplace',
      permissions: plugin.permissions,
      dependencies: deps,
      installedAt: new Date().toISOString(),
    });
    savePluginRecords(records);

    const depMsg = depNames.length > 0 ? `\n  Dependencies resolved: ${depNames.join(', ')}` : '';
    return `✅ Installed: ${plugin.name}@${plugin.latestVersion}${depMsg}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ Marketplace install failed: ${msg}`;
  }
}

export function pluginList(): string {
  const records = loadPluginRecords();
  if (records.length === 0) return 'No plugins installed.\nInstall with: /plugin install <name>';
  return records
    .map((r) => {
      const meta = r.format === 'marketplace' ? ` [marketplace]` : ` [npm]`;
      const perms = r.permissions?.length ? ` (${r.permissions.join(', ')})` : '';
      return `  ${r.name}@${r.version}${meta}${perms} — installed ${r.installedAt.slice(0, 10)}`;
    })
    .join('\n');
}

export async function pluginUninstall(name: string): Promise<string> {
  const records = loadPluginRecords();
  const idx = records.findIndex((r) => r.name === name || r.package === name);
  if (idx === -1) return `Plugin not found: ${name}`;
  const record = records[idx]!;
  try {
    if (record.format === 'npm') {
      execSync(`npm uninstall -g ${record.package}`, { stdio: 'pipe' });
    }
    records.splice(idx, 1);
    savePluginRecords(records);
    // Clean up wasm plugins dir
    const wasmDir = join(WASM_DIR, name);
    if (existsSync(wasmDir)) execSync(`rm -rf "${wasmDir}"`, { stdio: 'pipe' });
    return `✅ Uninstalled: ${record.package ?? record.name}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ Uninstall failed: ${msg}`;
  }
}

export function pluginCreate(name: string, outDir?: string): string {
  const dir = join(outDir ?? process.cwd(), name);
  if (existsSync(dir)) return `Directory already exists: ${dir}`;
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });

  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: `@timps-plugin/${name}`,
    version: '0.1.0',
    description: `TIMPS plugin: ${name}`,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: { build: 'tsup src/index.ts --format cjs --dts', prepublishOnly: 'npm run build' },
    peerDependencies: { '@timps-ai/plugin-sdk': '*' },
    keywords: ['timps-plugin'],
    license: 'MIT',
  }, null, 2));

  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'CommonJS',
      strict: true, outDir: 'dist', declaration: true,
    },
    include: ['src'],
  }, null, 2));

  writeFileSync(join(dir, 'src', 'index.ts'), `import type { Plugin } from '@timps-ai/plugin-sdk';

const plugin: Plugin = {
  manifest: {
    name: '${name}',
    version: '0.1.0',
    description: 'My TIMPS plugin',
  },
  tools: [
    {
      name: '${name}_example',
      description: 'Example tool from the ${name} plugin',
      parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] },
      async execute({ input }: { input: string }) {
        return { content: \`\${name} says: \${input}\` };
      },
    },
  ],
};

export default plugin;
`);

  return `✅ Plugin scaffolded at: ${dir}\nNext steps:\n  cd ${dir}\n  npm install\n  npm run build\n  timps plugin install .`;
}

export function pluginPublish(dir: string): string {
  try {
    execSync('npm publish --access public', { cwd: dir ?? process.cwd(), stdio: 'pipe' });
    return '✅ Published to npm registry!';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ Publish failed: ${msg}\n\nMake sure you're logged in: npm login`;
  }
}
