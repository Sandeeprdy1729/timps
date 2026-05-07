// ── timps-code — Plugin CLI commands (/plugin install|list|uninstall|create|publish) ──
// Extends the existing /plugin commands in app.ts with marketplace features.

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

const PLUGINS_FILE = join(os.homedir(), '.timps', 'plugins.json');

interface PluginRecord {
  name: string;
  package: string;
  version: string;
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
}

export async function pluginInstall(packageName: string): Promise<string> {
  try {
    execSync(`npm install -g ${packageName}`, { stdio: 'pipe' });
    const records = loadPluginRecords();
    records.push({
      name: packageName.split('/').pop() ?? packageName,
      package: packageName,
      version: 'latest',
      installedAt: new Date().toISOString(),
    });
    savePluginRecords(records);
    return `✅ Installed: ${packageName}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ Install failed: ${msg}`;
  }
}

export function pluginList(): string {
  const records = loadPluginRecords();
  if (records.length === 0) return 'No plugins installed.\nInstall with: /plugin install <package>';
  return records
    .map((r) => `  ${r.name}  (${r.package}@${r.version}) — installed ${r.installedAt.slice(0, 10)}`)
    .join('\n');
}

export async function pluginUninstall(name: string): Promise<string> {
  const records = loadPluginRecords();
  const idx = records.findIndex((r) => r.name === name || r.package === name);
  if (idx === -1) return `Plugin not found: ${name}`;
  const record = records[idx]!;
  try {
    execSync(`npm uninstall -g ${record.package}`, { stdio: 'pipe' });
    records.splice(idx, 1);
    savePluginRecords(records);
    return `✅ Uninstalled: ${record.package}`;
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
    peerDependencies: { '@timps/plugin-sdk': '*' },
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

  writeFileSync(join(dir, 'src', 'index.ts'), `import type { Plugin } from '@timps/plugin-sdk';

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
