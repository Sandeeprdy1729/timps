import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';

export const projectInfo: RegisteredTool = {
  definition: {
    name: 'project_info',
    description: 'Analyze the project: detect language, framework, dependencies, entry points, and test setup.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute(args, cwd) {
    const info: Record<string, string | string[]> = {};

    const checks: [string, string, string][] = [
      ['package.json', 'language', 'JavaScript/TypeScript'],
      ['Cargo.toml', 'language', 'Rust'],
      ['go.mod', 'language', 'Go'],
      ['requirements.txt', 'language', 'Python'],
      ['pyproject.toml', 'language', 'Python'],
      ['pom.xml', 'language', 'Java'],
      ['build.gradle', 'language', 'Kotlin/Java'],
      ['composer.json', 'language', 'PHP'],
      ['Gemfile', 'language', 'Ruby'],
    ];

    for (const [file, key, val] of checks) {
      if (fs.existsSync(path.join(cwd, file))) {
        info[key] = val;
        if (file === 'package.json') {
          try {
            const pkg = JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf-8'));
            info['name'] = pkg.name || '';
            info['version'] = pkg.version || '';
            const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
            const frameworks = deps.filter(d => ['react', 'vue', 'angular', 'next', 'nuxt', 'svelte', 'express', 'fastify', 'nest'].some(f => d.includes(f)));
            if (frameworks.length) info['frameworks'] = frameworks.slice(0, 5);
            const testDeps = deps.filter(d => ['jest', 'vitest', 'mocha', 'jasmine', 'cypress', 'playwright'].some(t => d.includes(t)));
            if (testDeps.length) info['testing'] = testDeps;
            if (pkg.scripts) info['scripts'] = Object.keys(pkg.scripts).slice(0, 10);
            if (pkg.main) info['entry'] = pkg.main;
          } catch { /* ignore */ }
        }
        break;
      }
    }

    const tsconfig = path.join(cwd, 'tsconfig.json');
    if (fs.existsSync(tsconfig)) info['typescript'] = 'yes';

    try {
      const branch = childProcess.execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      const remotes = childProcess.execSync('git remote -v', { cwd, encoding: 'utf-8', timeout: 5000 }).trim().split('\n')[0] || '';
      info['git_branch'] = branch;
      info['git_remote'] = remotes.split('\t')[1]?.split(' ')[0] || '';
    } catch { /* not a git repo */ }

    return {
      content: Object.entries(info).map(([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join(', ') : v}`
      ).join('\n'),
      isError: false,
    };
  },
};
