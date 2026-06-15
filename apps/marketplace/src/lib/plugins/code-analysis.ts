import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as ts from 'typescript';

export class CodeAnalysisPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('code-analysis', 'Code Analysis', config);
  }

  getDescription(): string {
    return 'Advanced static analysis and code quality checks';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');
      const files: string[] = [];
      const warnings: string[] = [];

      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(full);
          } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
            files.push(full);
          }
        }
      }
      walk(cwd);

      const results: Array<{ file: string; issues: number; complexity: number }> = [];

      for (const file of files.slice(0, 50)) {
        const source = fs.readFileSync(file, 'utf-8');
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

        let issues = 0;
        let complexity = 0;

        function visit(node: ts.Node) {
          if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
            complexity++;
          }
          if (ts.isIfStatement(node)) complexity++;
          if (ts.isSwitchStatement(node)) complexity += node.caseBlock.clauses.length;
          if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) ||
              ts.isWhileStatement(node) || ts.isDoStatement(node)) complexity++;
          if (ts.isConditionalExpression(node)) complexity++;

          if (node.kind === ts.SyntaxKind.AnyKeyword) {
            warnings.push(`${file}: uses 'any' type`);
            issues++;
          }
          ts.forEachChild(node, visit);
        }
        visit(sourceFile);

        results.push({ file: path.relative(cwd, file), issues, complexity });
      }

      const totalIssues = results.reduce((s, r) => s + r.issues, 0);
      const avgComplexity = results.length > 0
        ? (results.reduce((s, r) => s + r.complexity, 0) / results.length).toFixed(1)
        : '0';

      return {
        success: true,
        output: `Analyzed ${results.length} files. Found ${totalIssues} issues. Average cyclomatic complexity: ${avgComplexity}`,
        data: { files: results, totalFiles: results.length, totalIssues, avgComplexity },
        warnings: warnings.length > 0 ? warnings.slice(0, 10) : undefined,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Analysis failed' };
    }
  }
}
