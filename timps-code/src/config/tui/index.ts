import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const CONFIG_DIR = path.join(process.env.HOME || '', '.config', 'timps');

export interface ThemeConfig {
  name: string;
  colors: Record<string, string>;
  syntax: Record<string, string>;
}

export interface LayoutConfig {
  name: string;
  spacing: Record<string, number>;
  visibility: Record<string, boolean>;
  sizing: Record<string, number>;
  animation: Record<string, boolean | number>;
}

export interface KeybindConfig {
  leader: string;
  leaderTimeout: number;
  keybinds: Record<string, string>;
  mode: Record<string, Record<string, string>>;
}

export interface TUIConfig {
  theme: ThemeConfig;
  layout: LayoutConfig;
  keybinds: KeybindConfig;
}

const DEFAULT_THEME: ThemeConfig = {
  name: 'timps',
  colors: {
    background: '#1C1C1C',
    foreground: '#F5F0E1',
    border: '#64747A',
    borderFocus: '#4A8C7A',
    muted: '#8A9098',
    accent: '#4A8C7A',
    accentBold: '#7EC8B8',
    success: '#28A070',
    warning: '#E8C94A',
    error: '#C83838',
    info: '#7EC8B8',
    brand: '#2D5A4F',
    brandBold: '#2D5A4F',
    dim: '#8A9098',
    selection: '#4A8C7A40',
    cursor: '#4A8C7A',
    diffAdd: '#28A070',
    diffRemove: '#C83838',
    diffContext: '#9CA3AF',
    code: '#C8BF8C',
    file: '#7EC8B8',
    tool: '#4A8C7A',
    key: '#7EC8B8',
    lineNum: '#8A9098',
    string: '#C8BF8C',
    keyword: '#A78BFA',
    function: '#60A5FA',
    number: '#FBBF24',
    comment: '#64747A',
  },
  syntax: {
    keyword: 'keyword',
    function: 'function',
    number: 'number',
    string: 'string',
    comment: 'comment',
    type: 'keyword',
    operator: 'muted',
    punctuation: 'muted',
  },
};

const DEFAULT_LAYOUT: LayoutConfig = {
  name: 'default',
  spacing: {
    messageGap: 1,
    messagePadding: 1,
    panelPadding: 1,
    panelMargin: 1,
    footerHeight: 8,
    headerHeight: 3,
    statusHeight: 1,
    inputHeight: 3,
    autocompleteHeight: 10,
    dialogPadding: 2,
    dialogMargin: 2,
    toastGap: 1,
    toastMargin: 1,
  },
  visibility: {
    showHeader: true,
    showFooter: true,
    showStatusBar: true,
    showLineNumbers: false,
    showTimestamps: false,
    showToolIcons: true,
    showModelBadge: true,
    showContextBar: true,
    showCost: true,
    showGitStatus: true,
    compactMode: false,
  },
  sizing: {
    maxWidth: 120,
    minWidth: 60,
    messageMaxWidth: 100,
    panelMaxWidth: 80,
    dialogMaxWidth: 70,
    autocompleteMaxItems: 10,
    historyMaxItems: 1000,
  },
  animation: {
    enabled: true,
    spinnerSpeed: 100,
    fadeSpeed: 150,
    slideSpeed: 200,
  },
};

const DEFAULT_KEYBINDS: KeybindConfig = {
  leader: 'ctrl+x',
  leaderTimeout: 2000,
  keybinds: {
    commandPalette: 'ctrl+p',
    help: 'f1',
    quit: 'ctrl+c',
    clear: 'ctrl+l',
    newSession: 'ctrl+n',
    nextSession: 'ctrl+tab',
    prevSession: 'ctrl+shift+tab',
    scrollUp: 'pageup',
    scrollDown: 'pagedown',
    scrollTop: 'home',
    scrollBottom: 'end',
    pageUp: 'ctrl+u',
    pageDown: 'ctrl+d',
    halfPageUp: 'ctrl+b',
    halfPageDown: 'ctrl+f',
    search: 'ctrl+f',
    searchNext: 'f3',
    searchPrev: 'shift+f3',
    copy: 'ctrl+shift+c',
    paste: 'ctrl+v',
    undo: 'ctrl+z',
    redo: 'ctrl+y',
    interrupt: 'ctrl+c',
    submit: 'enter',
    submitAlt: 'ctrl+enter',
    newline: 'shift+enter',
    autocomplete: 'tab',
    autocompleteNext: 'ctrl+n',
    autocompletePrev: 'ctrl+p',
    autocompleteAccept: 'enter',
    autocompleteClose: 'escape',
    historyUp: 'up',
    historyDown: 'down',
    historySearch: 'ctrl+r',
    wordLeft: 'ctrl+left',
    wordRight: 'ctrl+right',
    lineStart: 'home',
    lineEnd: 'end',
    deleteWord: 'ctrl+backspace',
    deleteLine: 'ctrl+k',
    'leader:help': 'h',
    'leader:palette': 'p',
    'leader:memory': 'm',
    'leader:todos': 't',
    'leader:git': 'g',
    'leader:provider': 'P',
    'leader:model': 'M',
    'leader:theme': 'T',
    'leader:layout': 'L',
    'leader:settings': 's',
    'leader:doctor': 'd',
    'leader:cost': 'c',
    'leader:snapshot': 'S',
    'leader:team': 'T',
    'leader:skills': 'k',
    'leader:debug': 'D',
    'leader:quit': 'q',
  },
  mode: {
    normal: {},
    insert: {},
    command: {},
    search: {},
  },
};

function loadJSON<T>(filePath: string): Partial<T> {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Partial<T>;
    }
  } catch (e) {
    console.warn(`Failed to load config from ${filePath}:`, e);
  }
  return {} as Partial<T>;
}

function mergeDeep<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(result)) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];
    if (
      sourceValue !== undefined &&
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      (result as any)[key] = mergeDeep(
        targetValue as any,
        sourceValue as any
      );
    } else if (sourceValue !== undefined) {
      (result as any)[key] = sourceValue;
    }
  }
  return result as T;
}

export function loadTUIConfig(): TUIConfig {
  const userTheme = loadJSON<Partial<ThemeConfig>>(path.join(CONFIG_DIR, 'theme.json'));
  const userLayout = loadJSON<Partial<LayoutConfig>>(path.join(CONFIG_DIR, 'layout.json'));
  const userKeybinds = loadJSON<Partial<KeybindConfig>>(path.join(CONFIG_DIR, 'keybinds.json'));

  const projectTheme = loadJSON<Partial<ThemeConfig>>(path.join(PROJECT_ROOT, '.timps', 'theme.json'));
  const projectLayout = loadJSON<Partial<LayoutConfig>>(path.join(PROJECT_ROOT, '.timps', 'layout.json'));
  const projectKeybinds = loadJSON<Partial<KeybindConfig>>(path.join(PROJECT_ROOT, '.timps', 'keybinds.json'));

  return {
    theme: mergeDeep<ThemeConfig>(mergeDeep<ThemeConfig>(DEFAULT_THEME, projectTheme), userTheme),
    layout: mergeDeep<LayoutConfig>(mergeDeep<LayoutConfig>(DEFAULT_LAYOUT, projectLayout), userLayout),
    keybinds: mergeDeep<KeybindConfig>(mergeDeep<KeybindConfig>(DEFAULT_KEYBINDS, projectKeybinds), userKeybinds),
  };
}

export function saveTUIConfig(config: Partial<TUIConfig>, scope: 'user' | 'project' = 'user'): void {
  const dir = scope === 'user' ? CONFIG_DIR : path.join(PROJECT_ROOT, '.timps');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (config.theme) {
    fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify(config.theme, null, 2));
  }
  if (config.layout) {
    fs.writeFileSync(path.join(dir, 'layout.json'), JSON.stringify(config.layout, null, 2));
  }
  if (config.keybinds) {
    fs.writeFileSync(path.join(dir, 'keybinds.json'), JSON.stringify(config.keybinds, null, 2));
  }
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getProjectConfigDir(): string {
  return path.join(PROJECT_ROOT, '.timps');
}