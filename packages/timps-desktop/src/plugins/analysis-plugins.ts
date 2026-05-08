import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class CodeAnalysisPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/code-analysis',
    name: 'Code Analysis',
    version: '1.0.0',
    description: 'Static analysis, metrics, and code quality',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['analysis', 'metrics', 'quality', 'lint'],
  };

  public capabilities: PluginCapabilities = {};

  analyze(source: string, language: string): CodeAnalysis {
    return new CodeAnalysis(source, language);
  }

  getComplexity(source: string): number {
    let complexity = 1;
    let depth = 0;

    const controlFlow = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch', 'finally', '&&', '||'];
    const nestingKeywords = ['function', 'class', 'if', 'for', 'while', 'switch'];

    for (const keyword of controlFlow) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = source.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    for (const line of source.split('\n')) {
      for (const keyword of nestingKeywords) {
        if (line.includes(keyword)) {
          depth++;
        }
      }
    }

    return complexity + Math.floor(depth / 10);
  }

  getCyclomatic(source: string): number {
    let score = 1;
    const patterns = [/\bif\b/g, /\bwhile\b/g, /\bfor\b/g, /\bcase\b/g, /\bcatch\b/g, /&&/g, /\|\|/g];

    for (const pattern of patterns) {
      const matches = source.match(pattern);
      if (matches) {
        score += matches.length;
      }
    }

    return score;
  }

  getCognitiveComplexity(source: string): number {
    let score = 0;
    let nestingLevel = 0;
    const lines = source.split('\n');

    const increaseNesting = /\b(if|for|while|switch|catch|try|class|function|arrow)\b/;
    const decreaseNesting = /\}/;
    const ignored = /\binNER\b/;

    for (const line of lines) {
      if (increaseNesting.test(line) && !ignored.test(line)) {
        nestingLevel++;
      }
      if (decreaseNesting.test(line)) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }
      score += nestingLevel;
    }

    return score;
  }

  calculateMaintainabilityIndex(source: string): number {
    const halstead = this.getHalsteadMetrics(source);
    const cyclomatic = this.getCyclomatic(source);
    const loc = this.getLinesOfCode(source).total;

    const mi = 171 - 5.2 * Math.log(halstead.volume) - 0.23 * cyclomatic - 16.2 * Math.log(loc);
    return Math.max(0, Math.min(100, mi * 100 / 171));
  }

  getHalsteadMetrics(source: string): HalsteadMetrics {
    const operators = new Set<string>();
    const operands = new Set<string>();

    const operatorPattern = /[+\-*/%=<>!&|^~?:]+|&&|\|\|/g;
    const operandPattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

    let match;
    while ((match = operatorPattern.exec(source)) !== null) {
      operators.add(match[0]);
    }

    while ((match = operandPattern.exec(source)) !== null) {
      operands.add(match[0]);
    }

    const n1 = operators.size;
    const n2 = operands.size;
    const n = n1 + n2;

    return {
      length: source.length,
      volume: n * Math.log2(n || 1),
      difficulty: n1 / 2 * (n2 || 1),
      effort: 0,
      time: 0,
      bugs: 0,
    };
  }

  getLinesOfCode(source: string): LinesOfCode {
    const lines = source.split('\n');
    let code = 0;
    let comment = 0;
    let blank = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        blank++;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
        comment++;
      } else {
        code++;
      }
    }

    return { total: lines.length, code, comment, blank };
  }

  getCoupling(source: string): CouplingMetrics {
    const imports = new Set<string>();
    const importPattern = /import\s+.*\s+from\s+['"](.+)['"]/g;
    const requirePattern = /require\s*\(\s*['"](.+)['"]\s*\)/g;

    let match;
    while ((match = importPattern.exec(source)) !== null) {
      imports.add(match[1]);
    }
    while ((match = requirePattern.exec(source)) !== null) {
      imports.add(match[1]);
    }

    return {
      imports: Array.from(imports),
      afferent: 0,
      efferent: imports.size,
      instability: 0,
    };
  }

  getCohesion(source: string): number {
    const classes = source.match(/class\s+\w+/g) || [];
    const methods = source.match(/(?:function\s+\w+|\w+\s*\()/g) || [];

    return classes.length > 0 ? methods.length / classes.length : 0;
  }

  findDeadCode(source: string): DeadCodeReport {
    const unusedFunctions: string[] = [];
    const unusedVariables: string[] = [];
    const unusedClasses: string[] = [];

    const funcPattern = /function\s+(\w+)/g;
    const varPattern = /const\s+(\w+)\s*=/g;
    const classPattern = /class\s+(\w+)/g;

    let match;
    while ((match = funcPattern.exec(source)) !== null) {
      const funcName = match[1];
      if (!source.includes(`${funcName}(`) || source.split(`${funcName}(`).length < 3) {
        unusedFunctions.push(funcName);
      }
    }

    return {
      functions: unusedFunctions,
      variables: unusedVariables,
      classes: unusedClasses,
      total: unusedFunctions.length + unusedVariables.length + unusedClasses.length,
    };
  }

  findSecurityVulnerabilities(source: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    const patterns = [
      { pattern: /eval\s*\(/g, severity: 'high', message: 'Avoid eval() - code injection risk' },
      { pattern: /innerHTML\s*=/g, severity: 'medium', message: 'Assigning to innerHTML - potential XSS' },
      { pattern: /dangerouslySetInnerHTML/g, severity: 'medium', message: 'Dangerous innerHTML usage' },
      { pattern: /exec\s*\(/g, severity: 'high', message: 'Shell command execution - injection risk' },
      { pattern: /password\s*=\s*['"][^'"]+['"]/gi, severity: 'low', message: 'Hardcoded password detected' },
      { pattern: /api[keyK]?\s*=\s*['"][^'"]+['"]/gi, severity: 'medium', message: 'Hardcoded API key detected' },
      { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, severity: 'medium', message: 'Hardcoded secret detected' },
      { pattern: /\.innerHTML\s*=/g, severity: 'medium', message: 'Direct DOM manipulation - XSS risk' },
    ];

    for (const { pattern, severity, message } of patterns) {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        issues.push({
          line: source.slice(0, match.index).split('\n').length,
          column: match.index,
          severity,
          message,
          code: match[0],
        });
      }
    }

    return issues;
  }

  generateReport(source: string): AnalysisReport {
    return {
      complexity: this.getComplexity(source),
      cyclomatic: this.getCyclomatic(source),
      maintainability: this.calculateMaintainabilityIndex(source),
      lines: this.getLinesOfCode(source),
      coupling: this.getCoupling(source),
      cohesion: this.getCohesion(source),
      halstead: this.getHalsteadMetrics(source),
    };
  }
}

export class CodeAnalysis {
  constructor(private source: string, private language: string) {}

  getAST(): unknown {
    return null;
  }

  getTokens(): Token[] {
    return [];
  }

  getSymbols(): Symbol[] {
    return [];
  }

  findReferences(symbol: string): Reference[] {
    return [];
  }

  getDefinitions(): Definition[] {
    return [];
  }

  getTypeAtPosition(line: number, column: number): string {
    return 'unknown';
  }
}

export interface HalsteadMetrics {
  length: number;
  volume: number;
  difficulty: number;
  effort: number;
  time: number;
  bugs: number;
}

export interface LinesOfCode {
  total: number;
  code: number;
  comment: number;
  blank: number;
}

export interface CouplingMetrics {
  imports: string[];
  afferent: number;
  efferent: number;
  instability: number;
}

export interface DeadCodeReport {
  functions: string[];
  variables: string[];
  classes: string[];
  total: number;
}

export interface SecurityIssue {
  line: number;
  column: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  code: string;
}

export interface AnalysisReport {
  complexity: number;
  cyclomatic: number;
  maintainability: number;
  lines: LinesOfCode;
  coupling: CouplingMetrics;
  cohesion: number;
  halstead: HalsteadMetrics;
}

export interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
}

export interface Symbol {
  name: string;
  kind: string;
  location: { line: number; column: number };
}

export interface Reference {
  file: string;
  line: number;
  column: number;
}

export interface Definition {
  name: string;
  kind: string;
  location: { line: number; column: number };
}

export class RefactoringPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/refactoring',
    name: 'Refactoring',
    version: '1.0.0',
    description: 'Code refactoring operations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['refactor', 'extract', 'rename', 'inline'],
  };

  public capabilities: PluginCapabilities = {};

  extractMethod(source: string, startLine: number, endLine: number, name: string): string {
    const lines = source.split('\n');
    const selected = lines.slice(startLine - 1, endLine).join('\n');
    return `function ${name}() {\n${selected}\n}\n\n${source}`;
  }

  extractVariable(source: string, startLine: number, endLine: number, name: string): string {
    const lines = source.split('\n');
    const selected = lines.slice(startLine - 1, endLine).join(' ');
    return `const ${name} = ${selected};\n${source}`;
  }

  inlineMethod(source: string, methodName: string): string {
    return source;
  }

  inlineVariable(source: string, variableName: string): string {
    return source;
  }

  rename(source: string, oldName: string, newName: string): string {
    const pattern = new RegExp(`\\b${oldName}\\b`, 'g');
    return source.replace(pattern, newName);
  }

  move(source: string, fromPath: string, toPath: string): RefactorResult {
    return { code: source, changes: [] };
  }

  extractInterface(source: string, typeName: string, members: string[]): string {
    const interfaceDecl = `interface I${typeName} {\n${members.map(m => `  ${m}: any;`).join('\n')}\n}`;
    return `${interfaceDecl}\n\n${source}`;
  }

  convertToArrow(source: string): string {
    return source
      .replace(/function\s+(\w+)\s*\(([^)]*)\)\s*\{/g, `const $1 = ($2) => {`)
      .replace(/const\s+(\w+)\s*=\s*function/g, 'const $1 = ');
  }

  convertToAsync(source: string): string {
    return source
      .replace(/function\s+(\w+)/g, 'async function $1')
      .replace(/const\s+(\w+)\s*=\s*(?:function)?/g, 'const $1 = async ');
  }

  addDefaultCase(switchStmt: string): string {
    return switchStmt.replace(/(\bswitch\s*\([^)]+\)\s*\{)/g, '$1\n  default:\n    break;');
  }

  removeDeadCode(source: string): string {
    return source;
  }

  introduceParameter(source: string, paramName: string, defaultValue?: string): string {
    const param = defaultValue ? `${paramName} = ${defaultValue}` : paramName;
    return source
      .replace(/function\s+(\w+)\s*\(([^)]*)\)/g, `function $1(${param}, $2)`)
      .replace(/(\w+)\s*=\s*\(([^)]*)\)\s*=>/g, `($2, ${param}) =>`);
  }

  introduceField(source: string, fieldName: string, initialValue?: string): string {
    return `private ${fieldName}${initialValue ? ` = ${initialValue}` : ''};\n${source}`;
  }

  makeMethodStatic(method: string): string {
    return method.replace(/(\s+)(function\s+\w+)/g, '$1static $2');
  }

  makeMethodFinal(method: string): string {
    return method.replace(/(\s+)(function\s+\w+)/g, '$1final $2');
  }

  convertToClass(source: string, className: string): string {
    return `class ${className} {\n${source}\n}`;
  }

  convertToModule(source: string, exports: string[]): string {
    const exportStr = exports.map(e => `export ${e}`).join('\n');
    return `${source}\n\n${exportStr}`;
  }
}

export interface RefactorResult {
  code: string;
  changes: RefactorChange[];
}

export interface RefactorChange {
  type: string;
  from: string;
  to: string;
  line: number;
}

export class CodeFormatterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/formatter',
    name: 'Code Formatter',
    version: '1.0.0',
    description: 'Format and beautify code',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['format', 'beautify', 'indent', 'prettier'],
  };

  public capabilities: PluginCapabilities = {};

  format(source: string, language: string, options?: FormatOptions): string {
    return this.formatIndentation(source, options?.indent || 2);
  }

  private formatIndentation(source: string, indentSize: number): string {
    const lines = source.split('\n');
    let result = '';
    let indentLevel = 0;
    const indent = ' '.repeat(indentSize);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        result += '\n';
        continue;
      }

      if (trimmed.startsWith('}') || trimmed.startsWith(')') || trimmed.startsWith(']')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      result += indent.repeat(indentLevel) + trimmed + '\n';

      if (trimmed.endsWith('{') || trimmed.endsWith('(') || trimmed.endsWith('[')) {
        indentLevel++;
      }
    }

    return result.trim();
  }

  trimTrailingWhitespace(source: string): string {
    return source.split('\n').map(line => line.trimEnd()).join('\n');
  }

  ensureNewlineAtEnd(source: string): string {
    return source.endsWith('\n') ? source : source + '\n';
  }

  sortImports(source: string, language: string): string {
    const importLines: string[] = [];
    const otherLines: string[] = [];
    const lines = source.split('\n');

    for (const line of lines) {
      if (line.startsWith('import ') || line.startsWith('from ')) {
        importLines.push(line);
      } else {
        otherLines.push(line);
      }
    }

    importLines.sort();
    return [...importLines, '', ...otherLines].join('\n');
  }

  removeDuplicateImports(source: string): string {
    const seen = new Set<string>();
    return source
      .split('\n')
      .filter(line => {
        if (!line.startsWith('import ')) return true;
        if (seen.has(line)) return false;
        seen.add(line);
        return true;
      })
      .join('\n');
  }

  organize(source: string, language: string): string {
    let formatted = this.format(source, language);
    formatted = this.trimTrailingWhitespace(formatted);
    formatted = this.ensureNewlineAtEnd(formatted);
    return formatted;
  }

  alignColumns(source: string): string {
    const lines = source.split('\n');
    const maxLengths: number[] = [];

    for (const line of lines) {
      const parts = line.split(/\t|={2,}/);
      parts.forEach((part, i) => {
        maxLengths[i] = Math.max(maxLengths[i] || 0, part.length);
      });
    }

    return lines
      .map(line => {
        const parts = line.split(/\t|={2,}/);
        return parts
          .map((part, i) => part.padEnd(maxLengths[i]))
          .join('  ');
      })
      .join('\n');
  }

  convertQuotes(source: string, quoteStyle: "'" | '"'): string {
    if (quoteStyle === "'") {
      return source.replace(/"([^"]*)"/g, "'$1'");
    }
    return source.replace(/'([^']*)'/g, '"$1"');
  }

  addSemicolons(source: string, language: string): string {
    if (!['javascript', 'typescript'].includes(language)) return source;

    return source
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.endsWith('{') || trimmed.endsWith('}') || trimmed.endsWith(';')) return line;
        if (trimmed.startsWith('if') || trimmed.startsWith('for') || trimmed.startsWith('while')) {
          return line;
        }
        return line + ';';
      })
      .join('\n');
  }
}

export interface FormatOptions {
  indent?: number;
  tabSize?: number;
  useTabs?: boolean;
  semi?: boolean;
  singleQuote?: boolean;
  trailingComma?: 'none' | 'es5' | 'all';
}

export class CodeGenerationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/code-gen',
    name: 'Code Generation',
    version: '1.0.0',
    description: 'Generate code from specifications',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['generate', 'boilerplate', 'scaffold', 'template'],
  };

  public capabilities: PluginCapabilities = {};

  generateClass(name: string, options?: ClassOptions): string {
    const props = (options?.properties || []).map(p => `  ${p.access}${p.static ? ' static' : ''} ${p.name}${p.init ? ` = ${p.init}` : ''};`).join('\n');
    const methods = (options?.methods || []).map(m => this.generateMethod(m.name, m.params, m.body, options.language)).join('\n\n');

    return `class ${name} {\n${props ? props + '\n' : ''}${props && methods ? '\n' : ''}${methods}\n}`;
  }

  generateMethod(name: string, params: string[], body: string, language?: string): string {
    return `  ${name}(${params.join(', ')}) {\n    ${body}\n  }`;
  }

  generateInterface(name: string, members: InterfaceMember[]): string {
    const memberStr = members.map(m => `  ${m.name}${m.optional ? '?' : ''}: ${m.type};`).join('\n');
    return `interface ${name} {\n${memberStr}\n}`;
  }

  generateType(name: string, members: InterfaceMember[]): string {
    const memberStr = members.map(m => `  ${m.name}${m.optional ? '?' : ''}: ${m.type};`).join('\n');
    return `type ${name} = {\n${memberStr}\n};`;
  }

  generateEnum(name: string, members: string[]): string {
    const memberStr = members.map(m => `  ${m},`).join('\n');
    return `enum ${name} {\n${memberStr}\n}`;
  }

  generateFunction(name: string, params: string[], body: string, returnType?: string): string {
    const returnTypeStr = returnType ? `: ${returnType}` : '';
    return `function ${name}(${params.join(', ')})${returnTypeStr} {\n  ${body}\n}`;
  }

  generateArrowFunction(name: string, params: string[], body: string, returnType?: string): string {
    const returnTypeStr = returnType ? `: ${returnType}` : '';
    return `const ${name} = (${params.join(', ')})${returnTypeStr} => {\n  ${body}\n};`;
  }

  generateAsyncFunction(name: string, params: string[], body: string): string {
    return `async function ${name}(${params.join(', ')}) {\n  ${body}\n}`;
  }

  generateConstructor(params: string[], superCall?: string): string {
    const superStr = superCall ? `  super(${superCall});\n` : '';
    return `constructor(${params.join(', ')}) {\n${superStr}}`;
  }

  generateGetter(name: string, body: string): string {
    return `  get ${name}() {\n    ${body}\n  }`;
  }

  generateSetter(name: string, param: string, body: string): string {
    return `  set ${name}(${param}) {\n    ${body}\n  }`;
  }

  generateProperty(name: string, type: string, options?: PropertyOptions): string {
    const initial = options?.init ? ` = ${options.init}` : '';
    return `${options?.readonly ? 'readonly ' : ''}${name}: ${type}${initial};`;
  }

  generateImport(specifier: string, source: string, defaultImport?: string): string {
    if (defaultImport) {
      return `import ${defaultImport}, { ${specifier} } from '${source}';`;
    }
    return `import { ${specifier} } from '${source}';`;
  }

  generateExport(specifier: string, type: 'named' | 'default' | 'all'): string {
    if (type === 'default') {
      return `export default ${specifier};`;
    }
    if (type === 'all') {
      return `export * from '${specifier}';`;
    }
    return `export { ${specifier} };`;
  }

  generateTest(description: string, testFn: TestFn): string {
    const fnBody = testFn.body || '// TODO: implement test';
    return `test('${description}', () => {\n  ${fnBody}\n});`;
  }

  generateMock(interfaceName: string, methods: MockMethod[]): string {
    const impl = methods.map(m => `${m.name}: ${m.implementation || 'jest.fn()'},`).join('\n  ');
    return `const mock${interfaceName} = {\n  ${impl}\n};`;
  }
}

export interface ClassOptions {
  properties?: ClassProperty[];
  methods?: ClassMethod[];
  extends?: string;
  implements?: string[];
  language?: string;
}

export interface ClassProperty {
  name: string;
  type?: string;
  access?: 'private' | 'protected' | 'public';
  static?: boolean;
  init?: string;
}

export interface ClassMethod {
  name: string;
  params?: string[];
  body?: string;
}

export interface InterfaceMember {
  name: string;
  type: string;
  optional?: boolean;
}

export interface PropertyOptions {
  readonly?: boolean;
  private?: boolean;
  protected?: boolean;
  init?: string;
}

export interface TestFn {
  body: string;
  skip?: boolean;
}

export interface MockMethod {
  name: string;
  implementation?: string;
}