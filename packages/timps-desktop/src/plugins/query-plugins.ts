import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class SearchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/search',
    name: 'Search Engine',
    version: '1.0.0',
    description: 'Full-text search engine',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['search', 'full-text', 'index'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private index: Map<string, Array<{ id: string; text: string; score: number }>> = new Map();
  private documents: Map<string, Record<string, unknown>> = new Map();

  indexDocument(id: string, document: Record<string, unknown>, textFields: string[]): void {
    this.documents.set(id, document);
    
    let fullText = '';
    for (const field of textFields) {
      const value = document[field];
      if (typeof value === 'string') {
        fullText += ' ' + value;
      }
    }

    const tokens = this.tokenize(fullText);
    for (const token of tokens) {
      if (!this.index.has(token)) {
        this.index.set(token, []);
      }
      this.index.get(token)!.push({ id, text: fullText, score: this.calculateScore(fullText, token) });
    }
  }

  search(query: string, options?: { limit?: number; threshold?: number }): Array<{ id: string; score: number }> {
    const tokens = this.tokenize(query);
    const scores = new Map<string, number>();

    for (const token of tokens) {
      const matches = this.index.get(token) || [];
      for (const match of matches) {
        scores.set(match.id, (scores.get(match.id) || 0) + match.score);
      }
    }

    const results = Array.from(scores.entries())
      .map(([id, score]) => ({ id, score }))
      .filter(r => r.score > (options?.threshold || 0));

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, options?.limit || 10);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  private calculateScore(text: string, token: string): number {
    const index = text.toLowerCase().indexOf(token);
    if (index === -1) return 0;
    
    const occurrences = text.toLowerCase().split(token).length - 1;
    const position = text.length - index;
    
    return occurrences * (1 / position);
  }

  removeDocument(id: string): void {
    this.documents.delete(id);
  }

  getDocument(id: string): Record<string, unknown> | undefined {
    return this.documents.get(id);
  }

  getIndexSize(): number {
    return this.index.size;
  }

  clearIndex(): void {
    this.index.clear();
    this.documents.clear();
  }
}

export class FuzzySearchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/fuzzy-search',
    name: 'Fuzzy Search',
    version: '1.0.0',
    description: 'Fuzzy string matching',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['fuzzy', 'search', 'match'],
  };

  public capabilities: PluginCapabilities = {};

  search(pattern: string, candidates: string[], threshold = 0.3): Array<{ value: string; score: number }> {
    const results: Array<{ value: string; score: number }> = [];

    for (const candidate of candidates) {
      const score = this.calculateFuzzyScore(pattern, candidate);
      if (score >= threshold) {
        results.push({ value: candidate, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private calculateFuzzyScore(pattern: string, candidate: string): number {
    const patternLower = pattern.toLowerCase();
    const candidateLower = candidate.toLowerCase();

    if (candidateLower === patternLower) return 1;
    if (candidateLower.startsWith(patternLower)) return 0.9;
    if (candidateLower.includes(patternLower)) return 0.7;

    let patternIndex = 0;
    let score = 0;
    let consecutiveMatches = 0;

    for (let i = 0; i < candidateLower.length && patternIndex < patternLower.length; i++) {
      if (candidateLower[i] === patternLower[patternIndex]) {
        patternIndex++;
        consecutiveMatches++;
        score += 0.1 + (consecutiveMatches * 0.05);
      } else {
        consecutiveMatches = 0;
      }
    }

    if (patternIndex < patternLower.length) return 0;

    return Math.min(1, score / patternLower.length);
  }

  highlight(text: string, query: string): string {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}

export class AutoCompletePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/autocomplete',
    name: 'Auto Complete',
    version: '1.0.0',
    description: 'Autocomplete suggestions',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['autocomplete', 'suggestions', 'completion'],
  };

  public capabilities: PluginCapabilities = {};

  private suggestions: Map<string, Array<{ value: string; weight: number }>> = new Map();

  addSuggestions(category: string, suggestions: Array<{ value: string; weight?: number }>): void {
    this.suggestions.set(category, suggestions.map(s => ({
      value: s.value,
      weight: s.weight || 1,
    })));
  }

  getSuggestions(input: string, category: string, limit = 5): Array<{ value: string; score: number }> {
    const categorySuggestions = this.suggestions.get(category) || [];
    const inputLower = input.toLowerCase();

    const matched = categorySuggestions
      .map(s => ({
        value: s.value,
        score: this.calculateMatchScore(inputLower, s.value.toLowerCase()) * s.weight,
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    return matched.slice(0, limit);
  }

  private calculateMatchScore(input: string, candidate: string): number {
    if (candidate === input) return 1;
    if (candidate.startsWith(input)) return 0.9;
    if (candidate.includes(input)) return 0.7;

    let inputIndex = 0;
    let score = 0;

    for (let i = 0; i < candidate.length && inputIndex < input.length; i++) {
      if (candidate[i] === input[inputIndex]) {
        inputIndex++;
        score += 0.1;
      }
    }

    return inputIndex === input.length ? score / input.length : 0;
  }
}

export class FilterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/filter',
    name: 'Data Filter',
    version: '1.0.0',
    description: 'Advanced data filtering',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['filter', 'data', 'where'],
  };

  public capabilities: PluginCapabilities = {};

  filter<T extends Record<string, unknown>>(
    data: T[],
    conditions: Array<{ field: string; operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith' | 'between'; value: unknown }>
  ): T[] {
    return data.filter(item => {
      return conditions.every(condition => this.evaluateCondition(item, condition));
    });
  }

  private evaluateCondition<T extends Record<string, unknown>>(
    item: T,
    condition: { field: string; operator: string; value: unknown }
  ): boolean {
    const value = item[condition.field];

    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return (value as number) > (condition.value as number);
      case 'gte': return (value as number) >= (condition.value as number);
      case 'lt': return (value as number) < (condition.value as number);
      case 'lte': return (value as number) <= (condition.value as number);
      case 'in': return (condition.value as unknown[]).includes(value);
      case 'contains': return String(value).includes(String(condition.value));
      case 'startsWith': return String(value).startsWith(String(condition.value));
      case 'endsWith': return String(value).endsWith(String(condition.value));
      case 'between': {
        const range = condition.value as [number, number];
        return (value as number) >= range[0] && (value as number) <= range[1];
      }
      default: return true;
    }
  }

  sort<T extends Record<string, unknown>>(
    data: T[],
    field: string,
    direction: 'asc' | 'desc' = 'asc'
  ): T[] {
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  paginate<T>(data: T[], page: number, pageSize: number): { data: T[]; total: number; page: number; pageSize: number } {
    const start = (page - 1) * pageSize;
    return {
      data: data.slice(start, start + pageSize),
      total: data.length,
      page,
      pageSize,
    };
  }
}

export class QueryBuilderPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/query-builder',
    name: 'Query Builder',
    version: '1.0.0',
    description: 'Build complex queries',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['query', 'builder', 'filter'],
  };

  public capabilities: PluginCapabilities = {};

  private conditions: Array<{ field: string; operator: string; value: unknown }> = [];
  private orders: Array<{ field: string; direction: string }> = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;

  where(field: string, operator: string, value: unknown): this {
    this.conditions.push({ field, operator, value });
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orders.push({ field, direction });
    return this;
  }

  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  build(): { where: Array<{ field: string; operator: string; value: unknown }>; orderBy: Array<{ field: string; direction: string }>; limit: number | null; offset: number | null } {
    return {
      where: [...this.conditions],
      orderBy: [...this.orders],
      limit: this.limitValue,
      offset: this.offsetValue,
    };
  }

  clone(): QueryBuilderPlugin {
    const cloned = new QueryBuilderPlugin();
    cloned.conditions = [...this.conditions];
    cloned.orders = [...this.orders];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    return cloned;
  }

  reset(): void {
    this.conditions = [];
    this.orders = [];
    this.limitValue = null;
    this.offsetValue = null;
  }
}

export class JSONPathPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/jsonpath',
    name: 'JSONPath',
    version: '1.0.0',
    description: 'JSONPath query',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['jsonpath', 'query', 'xpath'],
  };

  public capabilities: PluginCapabilities = {};

  query(data: unknown, path: string): unknown[] {
    const tokens = this.parsePath(path);
    let current: unknown[] = [data];

    for (const token of tokens) {
      current = this.evaluateToken(current, token);
    }

    return current;
  }

  private parsePath(path: string): Array<{ type: string; value: string | number }> {
    const tokens: Array<{ type: string; value: string | number }> = [];
    const regex = /([$.]?)(\*|[\w]+|'[^']+'|"[^"]+"|\d+)/g;
    let match;

    while ((match = regex.exec(path))) {
      const [, prefix, value] = match;
      const cleanValue = value.replace(/^['"]|['"]$/g, '');

      if (prefix === '$') {
        tokens.push({ type: 'root', value: cleanValue });
      } else if (value === '*') {
        tokens.push({ type: 'wildcard', value: cleanValue });
      } else if (/^\d+$/.test(value)) {
        tokens.push({ type: 'index', value: parseInt(value, 10) });
      } else if (value === '..') {
        tokens.push({ type: 'recursive', value: cleanValue });
      } else {
        tokens.push({ type: 'key', value: cleanValue });
      }
    }

    return tokens;
  }

  private evaluateToken(data: unknown[], token: { type: string; value: string | number }): unknown[] {
    const results: unknown[] = [];

    for (const item of data) {
      if (!item || typeof item !== 'object') continue;

      const obj = item as Record<string, unknown>;

      switch (token.type) {
        case 'root':
        case 'key':
          if (token.value in obj) {
            results.push(obj[token.value as string]);
          }
          break;
        case 'index':
          if (Array.isArray(obj) {
            const val = obj[token.value as number];
            if (val !== undefined) results.push(val);
          }
          break;
        case 'wildcard':
          if (Array.isArray(obj)) {
            results.push(...obj);
          } else if (typeof obj === 'object') {
            results.push(...Object.values(obj));
          }
          break;
        case 'recursive':
          this.collectRecursive(obj, token.value as string, results);
          break;
      }
    }

    return results;
  }

  private collectRecursive(obj: unknown, key: string, results: unknown[]): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (key in (item as Record<string, unknown>)) {
          results.push((item as Record<string, unknown>)[key]);
        }
        this.collectRecursive(item, key, results);
      }
    } else {
      for (const value of Object.values(obj)) {
        if (key in (value as Record<string, unknown>)) {
          results.push((value as Record<string, unknown>)[key]);
        }
        this.collectRecursive(value, key, results);
      }
    }
  }
}

export class DiffPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/diff',
    name: 'Diff',
    version: '1.0.0',
    description: 'Text diff algorithm',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['diff', 'patch', 'difference'],
  };

  public capabilities: PluginCapabilities = {};

  diff(oldText: string, newText: string): Array<{ type: 'add' | 'remove' | 'equal'; value: string }> {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result: Array<{ type: 'add' | 'remove' | 'equal'; value: string }> = [];

    const lcs = this.longestCommonSubsequence(oldLines, newLines);

    let oldIndex = 0;
    let newIndex = 0;
    let lcsIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (lcsIndex < lcs.length && oldIndex < oldLines.length && newIndex < newLines.length &&
          oldLines[oldIndex] === lcs[lcsIndex] && newLines[newIndex] === lcs[lcsIndex]) {
        result.push({ type: 'equal', value: oldLines[oldIndex] });
        oldIndex++;
        newIndex++;
        lcsIndex++;
      } else if (newIndex < newLines.length && (lcsIndex >= lcs.length || newLines[newIndex] !== lcs[lcsIndex])) {
        result.push({ type: 'add', value: newLines[newIndex] });
        newIndex++;
      } else if (oldIndex < oldLines.length && (lcsIndex >= lcs.length || oldLines[oldIndex] !== lcs[lcsIndex])) {
        result.push({ type: 'remove', value: oldLines[oldIndex] });
        oldIndex++;
      }
    }

    return result;
  }

  private longestCommonSubsequence(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const result: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        result.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return result;
  }

  patch(original: string, diffs: Array<{ type: string; value: string }>): string {
    const lines = original.split('\n');
    let result = '';
    let lineIndex = 0;

    for (const diff of diffs) {
      if (diff.type === 'equal') {
        result += lines[lineIndex] + '\n';
        lineIndex++;
      } else if (diff.type === 'add') {
        result += diff.value + '\n';
      } else if (diff.type === 'remove') {
        lineIndex++;
      }
    }

    return result;
  }
}

export class PatchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/patch',
    name: 'Patch',
    version: '1.0.0',
    description: 'JSON Patch RFC 6902',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['patch', 'rfc6902', 'json-patch'],
  };

  public capabilities: PluginCapabilities = {};

  apply_patch<T extends Record<string, unknown>>(doc: T, patch: Array<{
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: unknown;
    from?: string;
  }>): T {
    const result = { ...doc };

    for (const operation of patch) {
      this.apply_operation(result, operation);
    }

    return result;
  }

  private apply_operation<T>(doc: T, operation: { op: string; path: string; value?: unknown; from?: string }): void {
    const pathParts = operation.path.split('/').filter(Boolean);

    switch (operation.op) {
      case 'add':
        this.setValue(doc as unknown as Record<string, unknown>, pathParts, operation.value);
        break;
      case 'remove':
        this.removeValue(doc as unknown as Record<string, unknown>, pathParts);
        break;
      case 'replace':
        this.setValue(doc as unknown as Record<string, unknown>, pathParts, operation.value);
        break;
      case 'move':
        if (operation.from) {
          const value = this.getValue(doc as unknown as Record<string, unknown>, operation.from.split('/').filter(Boolean));
          this.setValue(doc as unknown as Record<string, unknown>, pathParts, value);
          this.removeValue(doc as unknown as Record<string, unknown>, operation.from.split('/').filter(Boolean));
        }
        break;
      case 'copy':
        if (operation.from) {
          const value = this.getValue(doc as unknown as Record<string, unknown>, operation.from.split('/').filter(Boolean));
          this.setValue(doc as unknown as Record<string, unknown>, pathParts, this.clone(value));
        }
        break;
      case 'test':
        const currentValue = this.getValue(doc as unknown as Record<string, unknown>, pathParts);
        if (JSON.stringify(currentValue) !== JSON.stringify(operation.value)) {
          throw new Error('Test failed');
        }
        break;
    }
  }

  private getValue(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const part of path) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      }
    }
    return current;
  }

  private setValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
    const key = path[path.length - 1];
    const parent = path.length > 1 ? this.getObjectAt(obj, path.slice(0, -1)) : obj;
    parent[key] = value;
  }

  private removeValue(obj: Record<string, unknown>, path: string[]): void {
    const key = path[path.length - 1];
    const parent = path.length > 1 ? this.getObjectAt(obj, path.slice(0, -1)) : obj;
    delete parent[key];
  }

  private getObjectAt(obj: Record<string, unknown>, path: string[]): Record<string, unknown> {
    let current: Record<string, unknown> = obj;
    for (const part of path) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    return current;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  create_patch<T extends Record<string, unknown>>(oldDoc: T, newDoc: T): Array<{ op: string; path: string; value?: unknown }> {
    return this.generatePatch('', oldDoc, newDoc);
  }

  private generatePatch(path: string, oldVal: unknown, newVal: unknown): Array<{ op: string; path: string; value?: unknown }> {
    const patch: Array<{ op: string; path: string; value?: unknown }> = [];

    if (oldVal === newVal) return patch;

    if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
      const oldObj = oldVal as Record<string, unknown>;
      const newObj = newVal as Record<string, unknown>;

      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

      for (const key of allKeys) {
        const newPath = path ? `${path}/${key}` : `/${key}`;

        if (!(key in oldObj)) {
          patch.push({ op: 'add', path: newPath, value: newObj[key] });
        } else if (!(key in newObj)) {
          patch.push({ op: 'remove', path: newPath });
        } else {
          patch.push(...this.generatePatch(newPath, oldObj[key], newObj[key]));
        }
      }
    } else {
      patch.push({ op: 'replace', path: path || '/', value: newVal });
    }

    return patch;
  }
}

export class MergePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/merge',
    name: 'Merge',
    version: '1.0.0',
    description: 'Deep merge and_patch',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['merge', 'deep', 'combine'],
  };

  public capabilities: PluginCapabilities = {};

  deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T {
    const result = { ...target };

    for (const source of sources) {
      for (const key in source) {
        const targetValue = result[key];
        const sourceValue = source[key];

        if (this.isObject(targetValue) && this.isObject(sourceValue)) {
          result[key as keyof T] = this.deepMerge(targetValue as unknown as Record<string, unknown>, sourceValue as unknown as Partial<T>) as unknown as T[keyof T];
        } else {
          result[key as keyof T] = sourceValue as T[keyof T];
        }
      }
    }

    return result;
  }

  mergeArray<T>(target: T[], source: T[], options?: {
    combineDuplicates?: boolean;
    comparator?: (a: T, b: T) => boolean;
  }): T[] {
    if (options?.combineDuplicates) {
      const unique = [...target];
      for (const item of source) {
        const exists = unique.some(u => options.comparator?.(u, item) || u === item);
        if (!exists) {
          unique.push(item);
        }
      }
      return unique;
    }
    return [...target, ...source];
  }

  mergeDeepArray<T extends Record<string, unknown>>(target: T[], source: T[], keyField: keyof T): T[] {
    const result = [...target];
    const keyMap = new Map(result.map(item => [item[keyField], item]));

    for (const sourceItem of source) {
      const key = sourceItem[keyField];
      if (keyMap.has(key)) {
        const targetItem = keyMap.get(key)!;
        keyMap.set(key, this.deepMerge(targetItem, sourceItem) as T);
      } else {
        result.push(sourceItem);
        keyMap.set(key, sourceItem);
      }
    }

    return result;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  patchValue<T extends Record<string, unknown>>(target: T, patch: Partial<T>): T {
    return this.deepMerge(target, patch);
  }
}

export class SchemaPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/schema',
    name: 'Schema Validator',
    version: '1.0.0',
    description: 'JSON Schema validation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['schema', 'validation', 'json-schema'],
  };

  public capabilities: PluginCapabilities = {};

  validate(data: unknown, schema: Record<string, unknown>): { valid: boolean; errors: Array<{ path: string; message: string }> } {
    const errors: Array<{ path: string; message: string }> = [];
    this.validateValue(data, schema as Record<string, unknown>, '', errors);
    return { valid: errors.length === 0, errors };
  }

  private validateValue(data: unknown, schema: Record<string, unknown>, path: string, errors: Array<{ path: string; message: string }>): void {
    if ('type' in schema) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      const expectedType = schema.type as string;
      if (actualType !== expectedType && !(expectedType === 'integer' && Number.isInteger(data))) {
        errors.push({ path, message: `Expected ${expectedType}, got ${actualType}` });
        return;
      }
    }

    if ('enum' in schema) {
      const enumValues = schema.enum as unknown[];
      if (!enumValues.includes(data)) {
        errors.push({ path, message: `Value must be one of: ${enumValues.join(', ')}` });
        return;
      }
    }

    if ('const' in schema && data !== schema.const) {
      errors.push({ path, message: `Value must be ${schema.const}` });
      return;
    }

    if ('minimum' in schema && (data as number) < (schema.minimum as number)) {
      errors.push({ path, message: `Value must be >= ${schema.minimum}` });
    }

    if ('maximum' in schema && (data as number) > (schema.maximum as number)) {
      errors.push({ path, message: `Value must be <= ${schema.maximum}` });
    }

    if ('minLength' in schema && typeof data === 'string' && (data as string).length < (schema.minLength as number)) {
      errors.push({ path, message: `String must be at least ${schema.minLength} characters` });
    }

    if ('maxLength' in schema && typeof data === 'string' && (data as string).length > (schema.maxLength as number)) {
      errors.push({ path, message: `String must be at most ${schema.maxLength} characters` });
    }

    if ('pattern' in schema && typeof data === 'string') {
      const regex = new RegExp(schema.pattern as string);
      if (!regex.test(data)) {
        errors.push({ path, message: `String must match pattern: ${schema.pattern}` });
      }
    }

    if ('items' in schema && Array.isArray(data)) {
      const itemSchema = schema.items as Record<string, unknown>;
      data.forEach((item, index) => {
        this.validateValue(item, itemSchema, `${path}/${index}`, errors);
      });
    }

    if ('properties' in schema && typeof data === 'object' && data !== null) {
      const props = schema.properties as Record<string, Record<string, unknown>>;
      for (const [key, propSchema] of Object.entries(props)) {
        this.validateValue((data as Record<string, unknown>)[key], propSchema, `${path}/${key}`, errors);
      }
    }

    if ('required' in schema && typeof data === 'object') {
      const required = schema.required as string[];
      for (const req of required) {
        if (!(req in (data as Record<string, unknown>))) {
          errors.push({ path: `${path}/${req}`, message: 'Required property missing' });
        }
      }
    }
  }

  createSchema(definition: {
    type?: string;
    properties?: Record<string, { type: string; required?: boolean }>;
    required?: string[];
  }): Record<string, unknown> {
    const schema: Record<string, unknown> = { type: definition.type || 'object' };

    if (definition.properties) {
      schema.properties = {};
      for (const [key, prop] of Object.entries(definition.properties)) {
        (schema.properties as Record<string, Record<string, unknown>>)[key] = { type: prop.type };
        if (prop.required) {
          if (!schema.required) schema.required = [];
          (schema.required as string[]).push(key);
        }
      }
    }

    return schema;
  }
}

export class TypeCheckPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/type-check',
    name: 'Type Check',
    version: '1.0.0',
    description: 'Runtime type checking',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['type', 'check', 'runtime'],
  };

  public capabilities: PluginCapabilities = {};

  isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }

  isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  isFunction(value: unknown): value is Function {
    return typeof value === 'function';
  }

  isNull(value: unknown): value is null {
    return value === null;
  }

  isUndefined(value: unknown): value is undefined {
    return value === undefined;
  }

  isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  isEmail(value: unknown): boolean {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  isURL(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  isDate(value: unknown): value is Date {
    return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
  }

  isPromise(value: unknown): value is Promise<unknown> {
    return value instanceof Promise || (typeof value === 'object' && 'then' in value && 'catch' in value);
  }
}

export const searchPlugin = new SearchPlugin();
export const fuzzySearchPlugin = new FuzzySearchPlugin();
export const autocompletePlugin = new AutoCompletePlugin();
export const filterPlugin = new FilterPlugin();
export const queryBuilderPlugin = new QueryBuilderPlugin();
export const jsonPathPlugin = new JSONPathPlugin();
export const diffPlugin = new DiffPlugin();
export const patchPlugin = new PatchPlugin();
export const mergePlugin = new MergePlugin();
export const schemaPlugin = new SchemaPlugin();
export const typeCheckPlugin = new TypeCheckPlugin();

export function registerQueryPlugins(): Plugin[] {
  return [
    searchPlugin,
    fuzzySearchPlugin,
    autocompletePlugin,
    filterPlugin,
    queryBuilderPlugin,
    jsonPathPlugin,
    diffPlugin,
    patchPlugin,
    mergePlugin,
    schemaPlugin,
    typeCheckPlugin,
  ];
}