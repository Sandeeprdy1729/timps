import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class YamlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/yaml-parser',
    name: 'YAML Parser',
    version: '1.0.0',
    description: 'Parse and serialize YAML configuration files',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['yaml', 'parser', 'config', 'serialize'],
  };

  public capabilities: PluginCapabilities = {};

  parse(yaml: string): Record<string, unknown> {
    const lines = yaml.split('\n');
    const result: Record<string, unknown> = {};
    let currentKey = '';
    let currentIndent = 0;
    let inArray = false;
    let arrayItems: unknown[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      const content = line.trim();

      if (content.includes(':')) {
        const [key, ...valueParts] = content.split(':');
        const value = valueParts.join(':').trim();

        if (value.startsWith('[') && value.endsWith(']')) {
          const arrayContent = value.slice(1, -1);
          const items = arrayContent.split(',').map((s: string) => s.trim());
          result[key.trim()] = items;
        } else if (value === '' && indent > currentIndent) {
          currentKey = key.trim();
          currentIndent = indent;
        } else if (value !== '') {
          result[key.trim()] = this.parseValue(value);
        }
      } else if (content.startsWith('- ')) {
        const item = content.slice(2).trim();
        arrayItems.push(this.parseValue(item));
        inArray = true;
      }

      if (inArray && (indent < currentIndent || !content)) {
        if (currentKey) {
          result[currentKey] = arrayItems;
        }
        arrayItems = [];
        inArray = false;
      }
    }

    return result;
  }

  private parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === '~') return null;

    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    if (value.includes('|')) {
      const [key, ...content] = value.split('|');
      return { [key.trim()]: content.join('|').trim() };
    }

    return value;
  }

  stringify(obj: Record<string, unknown>, indent = 0): string {
    const spaces = ' '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'boolean') {
        yaml += `${spaces}${key}: ${value}\n`;
      } else if (typeof value === 'number') {
        yaml += `${spaces}${key}: ${value}\n`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}  - ${JSON.stringify(item)}\n`;
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n${this.stringify(value as Record<string, unknown>, indent + 2)}`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  validate(yaml: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const parsed = this.parse(yaml);

      const lines = yaml.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const indent = line.search(/\S/);

        if (indent % 2 !== 0 && line.trim()) {
          errors.push(`Line ${i + 1}: Indentation should be even`);
        }

        if (line.includes('\t')) {
          errors.push(`Line ${i + 1}: Use spaces instead of tabs`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (e) {
      return { valid: false, errors: [(e as Error).message] };
    }
  }

  merge(yaml1: string, yaml2: string): string {
    const obj1 = this.parse(yaml1);
    const obj2 = this.parse(yaml2);

    const merged = { ...obj1, ...obj2 };
    return this.stringify(merged);
  }

  flatten(yaml: string, prefix = ''): Record<string, unknown> {
    const parsed = this.parse(yaml);
    const result: Record<string, unknown> = {};

    const flattenObj = (obj: Record<string, unknown>, prefix: string) => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flattenObj(value as Record<string, unknown>, newKey);
        } else {
          result[newKey] = value;
        }
      }
    };

    flattenObj(parsed, prefix);
    return result;
  }

  unflatten(flat: Record<string, unknown>): string {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(flat)) {
      const parts = key.split('.');
      let current = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      current[parts[parts.length - 1]] = value;
    }

    return this.stringify(result);
  }
}

export class Json5ParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/json5-parser',
    name: 'JSON5 Parser',
    version: '1.0.0',
    description: 'Parse JSON5 with comments, trailing commas, and relaxed syntax',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['json', 'json5', 'parser', 'config'],
  };

  public capabilities: PluginCapabilities = {};

  parse(json5: string): unknown {
    let input = json5.trim();

    input = input.replace(/#.*$/gm, '');
    input = input.replace(/\/\/.*$/gm, '');
    input = input.replace(/\/\*[\s\S]*?\*\//g, '');

    let index = 0;

    const parseValue = (): unknown => {
      this.skipWhitespace();

      const char = this.peek();

      if (char === '{') return this.parseObject();
      if (char === '[') return this.parseArray();
      if (char === '"') return this.parseString();
      if (char === "'") return this.parseString();
      if (char === 't' || char === 'f') return this.parseBoolean();
      if (char === 'n') return this.parseNull();
      if (char === 'I' || char === 'N') return this.parseInfinity();

      if (char === '-' || char === '+' || char === '.' ||
          (char >= '0' && char <= '9')) {
        return this.parseNumber();
      }

      throw new Error(`Unexpected character: ${char}`);
    };

    const skipWhitespace = () => {
      while (index < input.length && /\s/.test(input[index])) {
        index++;
      }
    };

    const peek = () => input[index];

    const consume = (expected?: string) => {
      if (expected && input[index] !== expected) {
        throw new Error(`Expected ${expected}, got ${input[index]}`);
      }
      return input[index++];
    };

    const parseObject = (): Record<string, unknown> => {
      const obj: Record<string, unknown> = {};
      consume('{');
      this.skipWhitespace();

      if (peek() === '}') {
        consume('}');
        return obj;
      }

      while (true) {
        this.skipWhitespace();
        let key: string;

        if (peek() === '"' || peek() === "'") {
          key = this.parseString();
        } else {
          const keyStart = index;
          while (index < input.length && input[index] !== ':') {
            index++;
          }
          key = input.slice(keyStart, index).trim();
        }

        consume(':');
        const value = parseValue();
        obj[key] = value;

        this.skipWhitespace();

        if (peek() === ',') {
          consume(',');
        } else {
          break;
        }
      }

      consume('}');
      return obj;
    };

    const parseArray = (): unknown[] => {
      const arr: unknown[] = [];
      consume('[');
      this.skipWhitespace();

      if (peek() === ']') {
        consume(']');
        return arr;
      }

      while (true) {
        this.skipWhitespace();
        arr.push(parseValue());
        this.skipWhitespace();

        if (peek() === ',') {
          consume(',');
        } else {
          break;
        }
      }

      consume(']');
      return arr;
    };

    const parseString = (): string => {
      const quote = consume();
      let str = '';
      let escaped = false;

      while (index < input.length) {
        const char = consume();

        if (escaped) {
          switch (char) {
            case 'n': str += '\n'; break;
            case 'r': str += '\r'; break;
            case 't': str += '\t'; break;
            case '\\': str += '\\'; break;
            case '"': str += '"'; break;
            case "'": str += "'"; break;
            case 'u':
              const hex = input.slice(index, index + 4);
              str += String.fromCharCode(parseInt(hex, 16));
              index += 4;
              break;
            default:
              str += char;
          }
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          return str;
        } else {
          str += char;
        }
      }

      throw new Error('Unterminated string');
    };

    const parseNumber = (): number => {
      let numStr = '';

      if (peek() === '-' || peek() === '+') {
        numStr += consume();
      }

      while (index < input.length && /[0-9.xX]/.test(input[index])) {
        numStr += consume();
      }

      if (input[index - 1] === 'x' || input[index - 1] === 'X') {
        return parseInt(numStr.slice(2), 16);
      }

      return parseFloat(numStr);
    };

    const parseBoolean = (): boolean => {
      if (input.slice(index, index + 4) === 'true') {
        index += 4;
        return true;
      }
      index += 5;
      return false;
    };

    const parseNull = (): null => {
      index += 4;
      return null;
    };

    const parseInfinity = (): number => {
      const start = index;
      while (index < input.length && /[0-9a-zA-Z]/.test(input[index])) {
        index++;
      }
      const infStr = input.slice(start, index);

      if (infStr === 'Infinity') return Infinity;
      if (infStr === 'NaN') return NaN;

      throw new Error(`Unknown keyword: ${infStr}`);
    };

    input = input.replace(/,(\s*})/g, '$1');

    return parseValue();
  }

  stringify(obj: unknown, indent = 0): string {
    const spaces = ' '.repeat(indent);

    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'string') return this.escapeString(obj);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return '[\n' + obj
        .map((item) => spaces + '  ' + this.stringify(item, indent + 2))
        .join(',\n') + '\n' + spaces + ']';
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '{}';
      return '{\n' + keys
        .map((key) =>
          spaces + '  ' + key + ': ' + this.stringify((obj as Record<string, unknown>)[key], indent + 2))
        .join(',\n') + '\n' + spaces + '}';
    }

    return String(obj);
  }

  private escapeString(str: string): string {
    if (str.includes("'") && !str.includes('"')) {
      return `"${str}"`;
    }

    let escaped = "'";
    for (const char of str) {
      if (char === "'") escaped += "\\'";
      else if (char === '\n') escaped += '\\n';
      else if (char === '\r') escaped += '\\r';
      else if (char === '\t') escaped += '\\t';
      else escaped += char;
    }
    escaped += "'";
    return escaped;
  }

  validate(json5: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.parse(json5);
    } catch (e) {
      errors.push((e as Error).message);
    }

    return { valid: errors.length === 0, errors };
  }

  toStandardJson(json5: string): string {
    const parsed = this.parse(json5);
    return JSON.stringify(parsed, null, 2);
  }

  fromStandardJson(json: string): string {
    const parsed = JSON.parse(json);
    return this.stringify(parsed);
  }
}

export class TomlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/toml-parser',
    name: 'TOML Parser',
    version: '1.0.0',
    description: 'Parse TOML configuration format',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['toml', 'parser', 'config'],
  };

  public capabilities: PluginCapabilities = {};

  parse(toml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = toml.split('\n');
    let currentTable: Record<string, unknown> = {};
    let currentTableName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('[') && line.endsWith(']')) {
        const tableName = line.slice(1, -1);

        if (tableName.includes('.')) {
          const parts = tableName.split('.');
          let target = result;

          for (let j = 0; j < parts.length - 1; j++) {
            const part = parts[j];
            if (!target[part]) {
              target[part] = {};
            }
            target = target[part] as Record<string, unknown>;
          }

          currentTable = target;
          currentTableName = parts[parts.length - 1];
          target[currentTableName] = {};
        } else {
          currentTable = {};
          currentTableName = tableName;
          result[tableName] = currentTable;
        }

        continue;
      }

      if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        const parsedValue = this.parseValue(value);

        currentTable[key.trim()] = parsedValue;
      }
    }

    return result;
  }

  private parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      const content = value.slice(1, -1).trim();
      if (!content) return [];

      return content.split(',').map((s: string) => {
        const item = s.trim();
        if (item === 'true') return true;
        if (item === 'false') return false;
        const num = Number(item);
        if (!isNaN(num)) return num;
        if ((item.startsWith('"') && item.endsWith('"')) ||
            (item.startsWith("'") && item.endsWith("'"))) {
          return item.slice(1, -1);
        }
        return item;
      });
    }

    if (value.includes('#')) {
      return new Date(value.split('#')[0].trim());
    }

    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;

    return value;
  }

  stringify(obj: Record<string, unknown>): string {
    let toml = '';

    const writeSection = (section: Record<string, unknown>, name?: string) => {
      if (name) {
        toml += `[${name}]\n`;
      }

      for (const [key, value] of Object.entries(section)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const subSection = value as Record<string, unknown>;
          const subName = name ? `${name}.${key}` : key;
          toml += `\n[${subName}]\n`;
          writeSection(subSection);
        } else {
          toml += `${key} = ${this.valueToString(value)}\n`;
        }
      }
    };

    writeSection(obj);
    return toml;
  }

  private valueToString(value: unknown): string {
    if (value === null) return '""';
    if (value === true) return 'true';
    if (value === false) return 'false';
    if (typeof value === 'number') return String(value);

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      const items = value.map((v) => this.valueToString(v)).join(', ');
      return '[${items}]';
    }

    if (typeof value === 'string') {
      if (value.includes('"') || value.includes("'") || value.includes('\n')) {
        return '"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"';
      }
      return '"${value}"';
    }

    return String(value);
  }

  validate(toml: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.parse(toml);
    } catch (e) {
      errors.push((e as Error).message);
    }

    return { valid: errors.length === 0, errors };
  }

  merge(toml1: string, toml2: string): string {
    const obj1 = this.parse(toml1);
    const obj2 = this.parse(toml2);

    const merged = { ...obj1, ...obj2 };
    return this.stringify(merged);
  }
}

export class IniParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/ini-parser',
    name: 'INI Parser',
    version: '1.0.0',
    description: 'Parse INI configuration files',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['ini', 'parser', 'config'],
  };

  public capabilities: PluginCapabilities = {};

  parse(ini: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    const lines = ini.split('\n');
    let currentSection: Record<string, string> = {};
    let currentSectionName = 'default';

    result[currentSectionName] = currentSection;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
        continue;
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSectionName = trimmed.slice(1, -1);
        currentSection = {};
        result[currentSectionName] = currentSection;
        continue;
      }

      if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        currentSection[key.trim()] = valueParts.join('=').trim();
      }
    }

    return result;
  }

  stringify(obj: Record<string, Record<string, string>>): string {
    let ini = '';

    for (const [section, values] of Object.entries(obj)) {
      if (section !== 'default') {
        ini += `[${section}]\n`;
      }

      for (const [key, value] of Object.entries(values)) {
        ini += `${key}=${value}\n`;
      }

      ini += '\n';
    }

    return ini;
  }

  getValue(ini: string, section: string, key: string): string | null {
    const parsed = this.parse(ini);
    const sectionData = parsed[section];

    if (sectionData) {
      return sectionData[key] || null;
    }

    return null;
  }

  setValue(ini: string, section: string, key: string, value: string): string {
    const parsed = this.parse(ini);

    if (!parsed[section]) {
      parsed[section] = {};
    }

    parsed[section][key] = value;
    return this.stringify(parsed);
  }
}

export class CssSelectorParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/css-selector-parser',
    name: 'CSS Selector Parser',
    version: '1.0.0',
    description: 'Parse and analyze CSS selectors',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['css', 'selector', 'parser'],
  };

  public capabilities: PluginCapabilities = {};

  parse(selector: string): CSSSelector[] {
    const selectors = selector.split(',').map((s) => s.trim());
    return selectors.map((sel) => this.parseSingleSelector(sel));
  }

  private parseSingleSelector(selector: string): CSSSelector {
    const result: CSSSelector = {
      tag: '*',
      classes: [],
      ids: [],
      attributes: [],
      pseudos: [],
      combinators: [],
    };

    const tokens = selector.match(/[.#[:\w-]+|[>+~ ]|=/g) || [];

    let currentTag = '*';

    for (const token of tokens) {
      if (token === '>' || token === '+' || token === '~' || token === ' ') {
        result.combinators.push(token);
      } else if (token.startsWith('.')) {
        result.classes.push(token.slice(1));
      } else if (token.startsWith('#')) {
        result.ids.push(token.slice(1));
      } else if (token.startsWith('[')) {
        const attr = token.slice(1, -1);
        const [name, op, value] = attr.split(/([$^*|~]=)/);
        result.attributes.push({ name, op: op as string, value });
      } else if (token.startsWith(':')) {
        const match = token.match(/:([\w-]+)(?:\(([^)]+)\))?/);
        if (match) {
          result.pseudos.push({ name: match[1], value: match[2] });
        }
      } else if (/^[\w-]+$/.test(token)) {
        currentTag = token;
      }
    }

    result.tag = currentTag;
    return result;
  }

  stringify(selector: CSSSelector): string {
    let result = selector.tag;

    for (const id of selector.ids) {
      result += `#${id}`;
    }

    for (const cls of selector.classes) {
      result += `.${cls}`;
    }

    for (const attr of selector.attributes) {
      result += `[${attr.name}${attr.op || ''}${attr.value || ''}]`;
    }

    for (const pseudo of selector.pseudos) {
      if (pseudo.value) {
        result += `:${pseudo.name}(${pseudo.value})`;
      } else {
        result += `:${pseudo.name}`;
      }
    }

    for (const comb of selector.combinators) {
      result += ` ${comb} `;
    }

    return result;
  }

  specificity(selector: CSSSelector): number {
    let score = 0;

    score += selector.ids.length * 100;
    score += selector.classes.length * 10;
    score += selector.attributes.length * 10;
    score += selector.pseudos.length * 10;
    score += selector.tag === '*' ? 0 : 1;

    return score;
  }

  matches(element: Element, selector: CSSSelector): boolean {
    if (selector.tag !== '*' && element.tagName.toLowerCase() !== selector.tag.toLowerCase()) {
      return false;
    }

    for (const id of selector.ids) {
      if (element.id !== id) return false;
    }

    for (const cls of selector.classes) {
      if (!element.classList.contains(cls)) return false;
    }

    return true;
  }
}

export interface CSSSelector {
  tag: string;
  classes: string[];
  ids: string[];
  attributes: Array<{ name: string; op?: string; value?: string }>;
  pseudos: Array<{ name: string; value?: string }>;
  combinators: string[];
}

export class GraphqlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/graphql-parser',
    name: 'GraphQL Parser',
    version: '1.0.0',
    description: 'Parse GraphQL schema and queries',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['graphql', 'parser', 'schema', 'query'],
  };

  public capabilities: PluginCapabilities = {};

  parse(query: string): GraphqlDocument {
    const doc: GraphqlDocument = {
      operations: [],
      fragments: [],
      directives: [],
    };

    const normalized = query.replace(/#.*$/gm, '').trim();

    const operationRegex = /(query|mutation|subscription)\s*([\w-]*)?\s*(?:\(([^)]*)\))?\s*\{/g;
    let match;

    while ((match = operationRegex.exec(normalized)) !== null) {
      const opType = match[1];
      const opName = match[2] || '';
      const variables = match[3] || '';

      const start = match.index + match[0].length;
      let depth = 1;
      let end = start;

      while (depth > 0 && end < normalized.length) {
        if (normalized[end] === '{') depth++;
        if (normalized[end] === '}') depth--;
        end++;
      }

      const body = normalized.slice(start, end - 1);
      doc.operations.push({
        type: opType as 'query' | 'mutation' | 'subscription',
        name: opName,
        variables: this.parseVariables(variables),
        selections: this.parseSelections(body),
      });
    }

    const fragmentRegex = /fragment\s+(\w+)\s+on\s+(\w+)/g;
    while ((match = fragmentRegex.exec(normalized)) !== null) {
      const fragName = match[1];
      const fragType = match[2];

      const start = match.index + match[0].length;
      let depth = 1;
      let end = start;

      while (depth > 0 && end < normalized.length) {
        if (normalized[end] === '{') depth++;
        if (normalized[end] === '}') depth--;
        end++;
      }

      const body = normalized.slice(start, end - 1);
      doc.fragments.push({
        name: fragName,
        typeCondition: fragType,
        selections: this.parseSelections(body),
      });
    }

    return doc;
  }

  private parseVariables(vars: string): GraphqlVariable[] {
    if (!vars.trim()) return [];

    return vars.split(',').map((v) => {
      const [name, type, defValue] = v.trim().split(':');
      return {
        name: name.trim(),
        type: type.trim(),
        defaultValue: defValue?.trim(),
      };
    });
  }

  private parseSelections(body: string): GraphqlSelection[] {
    const selections: GraphqlSelection[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('{')) continue;

      if (trimmed.includes('(')) {
        const [fieldName, argsStr] = trimmed.split('(');
        const field = fieldName.trim();
        const args = argsStr?.replace(')', '').trim();

        selections.push({
          name: field,
          arguments: args ? this.parseArguments(args) : [],
          alias: field.includes(':') ? field.split(':')[0] : undefined,
        });
      } else {
        const [field, alias] = trimmed.includes(':')
          ? trimmed.split(':')
          : [trimmed, null];

        selections.push({
          name: field.trim(),
          alias: alias?.trim(),
        });
      }
    }

    return selections;
  }

  private parseArguments(args: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const pairs = args.split(',');

    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split(':');
      const value = valueParts.join(':').trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        result[key.trim()] = value.slice(1, -1);
      } else if (!isNaN(Number(value))) {
        result[key.trim()] = Number(value);
      } else if (value === 'true' || value === 'false') {
        result[key.trim()] = value === 'true';
      } else {
        result[key.trim()] = value;
      }
    }

    return result;
  }

  validate(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const balance = (str: string, open: string, close: string) => {
      let count = 0;
      for (const char of str) {
        if (char === open) count++;
        if (char === close) count--;
        if (count < 0) return false;
      }
      return count === 0;
    }

    if (!balance(query, '{', '}')) {
      errors.push('Unbalanced curly braces');
    }

    if (!balance(query, '(', ')')) {
      errors.push('Unbalanced parentheses');
    }

    return { valid: errors.length === 0, errors };
  }

  extractFields(query: string): string[] {
    const doc = this.parse(query);
    const fields: string[] = [];

    for (const op of doc.operations) {
      for (const sel of op.selections) {
        fields.push(sel.name);
      }
    }

    return fields;
  }
}

export interface GraphqlDocument {
  operations: GraphqlOperation[];
  fragments: GraphqlFragment[];
  directives: string[];
}

export interface GraphqlOperation {
  type: 'query' | 'mutation' | 'subscription';
  name: string;
  variables: GraphqlVariable[];
  selections: GraphqlSelection[];
}

export interface GraphqlFragment {
  name: string;
  typeCondition: string;
  selections: GraphqlSelection[];
}

export interface GraphqlVariable {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface GraphqlSelection {
  name: string;
  alias?: string;
  arguments?: Record<string, unknown>;
}