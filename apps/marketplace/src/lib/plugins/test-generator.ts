import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as ts from 'typescript';

export class TestGeneratorPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('test-generator', 'Test Generator', config);
  }

  getDescription(): string {
    return 'Generate unit tests from code automatically';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const srcDir = path.join(cwd, 'src');
      if (!fs.existsSync(srcDir)) {
        return { success: false, error: 'No src/ directory found' };
      }

      const testDir = path.join(cwd, 'src', '__tests__');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const sourceFiles: string[] = [];
      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '__tests__' && entry.name !== 'node_modules') {
            walk(full);
          } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.spec.ts')) {
            sourceFiles.push(full);
          }
        }
      }
      walk(srcDir);

      let generated = 0;
      const warnings: string[] = [];

      for (const file of sourceFiles.slice(0, 10)) {
        const source = fs.readFileSync(file, 'utf-8');
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
        const functions: string[] = [];

        function visit(node: ts.Node) {
          if (ts.isFunctionDeclaration(node) && node.name) {
            functions.push(node.name.text);
          }
          if (ts.isMethodDeclaration(node) && node.name) {
            functions.push(ts.isIdentifier(node.name) ? node.name.text : 'method');
          }
          if (ts.isExportAssignment(node)) {
            functions.push('defaultExport');
          }
          ts.forEachChild(node, visit);
        }
        visit(sourceFile);

        if (functions.length === 0) continue;

        const relPath = path.relative(srcDir, file);
        const testName = relPath.replace(/\.(ts|tsx)$/, '.test.ts');
        const testFilePath = path.join(testDir, testName);
        const testDirPath = path.dirname(testFilePath);

        if (!fs.existsSync(testDirPath)) {
          fs.mkdirSync(testDirPath, { recursive: true });
        }

        const importPath = `../${relPath.replace(/\.(ts|tsx)$/, '')}`;
        const testContent = `import { describe, it, expect } from '@jest/globals';\nimport { ${functions.join(', ')} } from '${importPath}';\n\ndescribe('${path.basename(file, path.extname(file))}', () => {\n${functions.map((fn) => `  describe('${fn}', () => {\n    it('should work correctly', () => {\n      // TODO: implement test for ${fn}\n      expect(true).toBe(true);\n    });\n  });`).join('\n\n')}\n});\n`;

        fs.writeFileSync(testFilePath, testContent, 'utf-8');
        generated++;
        warnings.push(`Generated test for ${relPath}`);
      }

      return {
        success: true,
        output: `Generated ${generated} test files in src/__tests__/`,
        data: { generated, total: sourceFiles.length },
        warnings,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Test generation failed' };
    }
  }
}
