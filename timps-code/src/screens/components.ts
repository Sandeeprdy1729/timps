// TIMPS Code — Screen Components
// Terminal UI components for CLI output

export interface ScreenTheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
}

export const defaultTheme: ScreenTheme = {
  primary: '\x1b[36m',
  secondary: '\x1b[35m',
  success: '\x1b[32m',
  warning: '\x1b[33m',
  error: '\x1b[31m',
  info: '\x1b[34m',
  muted: '\x1b[90m',
};

const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';

export function coloredText(text: string, color?: string): string {
  return color ? `${color}${text}${reset}` : text;
}

export function text(text: string): string {
  return text;
}

export function boldColored(text: string, color?: string): string {
  return `${bold}${color || ''}${text}${reset}`;
}

export function boldText(text: string): string {
  return `${bold}${text}${reset}`;
}

export function dimText(text: string): string {
  return `${dim}${text}${reset}`;
}

export function success(text: string): string {
  return coloredText(text, defaultTheme.success);
}

export function error(text: string): string {
  return coloredText(text, defaultTheme.error);
}

export function warning(text: string): string {
  return coloredText(text, defaultTheme.warning);
}

export function info(text: string): string {
  return coloredText(text, defaultTheme.info);
}

export function primary(text: string): string {
  return coloredText(text, defaultTheme.primary);
}

export function secondary(text: string): string {
  return coloredText(text, defaultTheme.secondary);
}

export function muted(text: string): string {
  return coloredText(text, defaultTheme.muted);
}

export function divider(char: string = '─', width: number = 80): string {
  return char.repeat(width);
}

export function box(title: string, content: string): string {
  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length), title.length);
  const top = `┌${'─'.repeat(maxWidth + 2)}┐`;
  const titleLine = `│ ${boldText(title)}${' '.repeat(maxWidth - title.length + 1)}│`;
  const middle = lines.map(l => `│ ${l}${' '.repeat(maxWidth - l.length + 1)}│`).join('\n');
  const bottom = `└${'─'.repeat(maxWidth + 2)}┘`;
  return `${top}\n${titleLine}\n${middle}\n${bottom}`;
}

export function progressBar(current: number, total: number, width: number = 40): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.round((current / total) * 100);
  return `[${bar}] ${percent}%`;
}

export function spinner(frame: number = 0): string {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  return frames[frame % frames.length];
}

export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map(r => (r[i] || '').length));
    return Math.max(h.length, maxRowWidth);
  });

  const headerLine = headers.map((h, i) => boldColored(h.padEnd(colWidths[i]), defaultTheme.primary)).join(' │ ');
  const separator = colWidths.map(w => '─'.repeat(w)).join('─┼─');
  const dataLines = rows.map(row => {
    return row.map((cell, i) => cell.padEnd(colWidths[i])).join(' │ ');
  });

  return [headerLine, separator, ...dataLines].join('\n');
}

export function list(items: string[], options?: { numbered?: boolean; bullet?: string }): string {
  if (options?.numbered) {
    return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  }
  const bullet = options?.bullet || '•';
  return items.map(item => `${bullet} ${item}`).join('\n');
}

export function treeNode(name: string, children?: string[], isLast: boolean = true): string {
  const connector = isLast ? '└── ' : '├── ';
  const childConnector = isLast ? '    ' : '│   ';
  let result = `${connector}${name}`;
  if (children && children.length > 0) {
    result += '\n' + children.map((child, i) => {
      const isLastChild = i === children.length - 1;
      return `${childConnector}${isLastChild ? '└── ' : '├── '}${child}`;
    }).join('\n');
  }
  return result;
}

export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

export function pad(text: string, width: number, align: 'left' | 'center' | 'right' = 'left', fillChar: string = ' '): string {
  const padding = width - text.length;
  if (padding <= 0) return text;

  switch (align) {
    case 'right':
      return fillChar.repeat(padding) + text;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return fillChar.repeat(leftPad) + text + fillChar.repeat(rightPad);
    default:
      return text + fillChar.repeat(padding);
  }
}

export function keyValue(key: string, value: string, keyWidth: number = 20): string {
  return `${boldText(pad(key, keyWidth))}${value}`;
}

export function statusIcon(status: 'success' | 'error' | 'warning' | 'info' | 'loading' | 'pending'): string {
  const icons = {
    success: success('✓'),
    error: error('✗'),
    warning: warning('⚠'),
    info: info('ℹ'),
    loading: spinner(),
    pending: '○',
  };
  return icons[status];
}

export class ProgressTracker {
  private current: number = 0;
  private total: number;
  private startTime: number;
  private description: string;

  constructor(total: number, description: string = 'Progress') {
    this.total = total;
    this.description = description;
    this.startTime = Date.now();
  }

  increment(): void {
    this.current++;
  }

  setProgress(current: number): void {
    this.current = current;
  }

  render(): string {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const percent = this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
    const bar = progressBar(this.current, this.total, 30);
    return `${info(this.description)} ${bar} ${muted(`${elapsed}s`)}`;
  }

  isComplete(): boolean {
    return this.current >= this.total;
  }

  getPercent(): number {
    return this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
  }
}

export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

export function moveCursor(x: number, y: number): void {
  process.stdout.write(`\x1b[${y};${x}H`);
}

export function saveCursor(): void {
  process.stdout.write('\x1b[s');
}

export function restoreCursor(): void {
  process.stdout.write('\x1b[u');
}

export function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

export function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}