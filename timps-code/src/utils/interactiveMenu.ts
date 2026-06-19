// ── Hermes-style Interactive Selection Menus ──
// Radio buttons (single-select) and checkboxes (multi-select)
// with ↑↓ navigation, Enter/SPACE to select, ESC to cancel

import * as readline from 'node:readline';
import chalk from 'chalk';

const c = {
  tealMid: '#4A8C7A',
  tealDark: '#2D5A4F',
  cream: '#F5F0E1',
  dim: '#64747A',
  success: '#28A070',
  warning: '#E8C94A',
  border: '#374151',
};

const strip = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, '');

export interface MenuOption {
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
  meta?: string;
}

export interface RadioMenuConfig {
  prompt: string;
  options: MenuOption[];
  defaultIndex?: number;
}

export interface CheckboxMenuConfig {
  prompt: string;
  options: MenuOption[];
  defaultChecked?: number[];
}

function emit(s: string): void {
  process.stdout.write(s);
}

function clearLine(): void {
  emit('\r\x1B[K');
}

function cursorUp(n: number): void {
  emit(`\x1B[${n}A`);
}

function hideCursor(): void {
  emit('\x1B[?25l');
}

function showCursor(): void {
  emit('\x1B[?25h');
}

// ── Radio (single-select) menu ──

export async function radioMenu(config: RadioMenuConfig): Promise<number | null> {
  const { prompt, options, defaultIndex = 0 } = config;
  let selected = Math.min(defaultIndex, options.length - 1);
  const offset = 3; // prompt + hint + blank line
  const totalLines = options.length + offset;

  hideCursor();
  console.log(`\n  ${chalk.hex(c.tealMid).bold(prompt)}`);
  console.log(`  ${chalk.hex(c.dim)('↑↓ navigate  ENTER/SPACE select  ESC cancel')}`);
  console.log();

  const render = () => {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isActive = i === selected;
      const prefix = isActive ? chalk.hex(c.tealMid)('→') : ' ';
      const radio = isActive
        ? chalk.hex(c.tealMid)('(●)')
        : chalk.hex(c.dim)('(○)');
      const label = isActive
        ? chalk.bold.hex(c.cream)(opt.label)
        : opt.disabled
          ? chalk.hex(c.dim).strikethrough(opt.label)
          : chalk.hex(c.dim)(opt.label);
      const desc = opt.description
        ? `  ${chalk.hex(c.dim)(opt.description)}`
        : '';
      const meta = opt.meta
        ? ` ${chalk.hex(c.warning)(opt.meta)}`
        : '';
      const line = `  ${prefix} ${radio} ${opt.icon ? `${opt.icon} ` : ''}${label}${meta}${desc}`;
      clearLine();
      emit(line + '\n');
    }
  };

  render();

  const result = await new Promise<number | null>((resolve) => {
    const stdin = process.stdin;
    const raw = stdin.isRaw;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();

    const handler = (buf: Buffer) => {
      const key = buf.toString();

      if (key === '\x1B[A') {
        // up
        selected = (selected - 1 + options.length) % options.length;
        cursorUp(options.length);
        render();
      } else if (key === '\x1B[B') {
        // down
        selected = (selected + 1) % options.length;
        cursorUp(options.length);
        render();
      } else if (key === '\r' || key === ' ') {
        if (!options[selected].disabled) {
          cleanup();
          resolve(selected);
        }
      } else if (key === '\x1B' || key === '\x03') {
        // ESC or Ctrl+C
        cleanup();
        resolve(null);
      }
    };

    const cleanup = () => {
      if (stdin.setRawMode && raw === false) stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', handler);
      showCursor();
    };

    stdin.on('data', handler);
  });

  // Clear rendered options and show final selection
  cursorUp(options.length + offset);
  for (let i = 0; i < options.length + offset; i++) {
    clearLine();
    emit('\n');
  }
  cursorUp(options.length + offset);

  return result;
}

// ── Checkbox (multi-select) menu ──

export async function checkboxMenu(config: CheckboxMenuConfig): Promise<number[]> {
  const { prompt, options, defaultChecked = [] } = config;
  let selected = 0;
  const checked = new Set(defaultChecked);
  const offset = 3;
  const totalLines = options.length + offset;

  hideCursor();
  console.log(`\n  ${chalk.hex(c.tealMid).bold(prompt)}`);
  console.log(`  ${chalk.hex(c.dim)('↑↓ navigate  SPACE toggle  ENTER confirm  ESC cancel')}`);
  console.log();

  const render = () => {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isActive = i === selected;
      const isChecked = checked.has(i);
      const prefix = isActive ? chalk.hex(c.tealMid)('→') : ' ';
      const box = isChecked
        ? chalk.hex(c.success)('[✓]')
        : chalk.hex(c.dim)('[ ]');
      const label = isActive
        ? chalk.bold.hex(c.cream)(opt.label)
        : chalk.hex(c.dim)(opt.label);
      const desc = opt.description
        ? `  ${chalk.hex(c.dim)(opt.description)}`
        : '';
      const line = `  ${prefix} ${box} ${opt.icon ? `${opt.icon} ` : ''}${label}${desc}`;
      clearLine();
      emit(line + '\n');
    }
  };

  render();

  const result = await new Promise<number[]>((resolve) => {
    const stdin = process.stdin;
    const raw = stdin.isRaw;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();

    const handler = (buf: Buffer) => {
      const key = buf.toString();

      if (key === '\x1B[A') {
        selected = (selected - 1 + options.length) % options.length;
        cursorUp(options.length);
        render();
      } else if (key === '\x1B[B') {
        selected = (selected + 1) % options.length;
        cursorUp(options.length);
        render();
      } else if (key === ' ') {
        if (checked.has(selected)) {
          checked.delete(selected);
        } else {
          checked.add(selected);
        }
        cursorUp(options.length);
        render();
      } else if (key === '\r') {
        cleanup();
        resolve([...checked].sort());
      } else if (key === '\x1B' || key === '\x03') {
        cleanup();
        resolve([]);
      }
    };

    const cleanup = () => {
      if (stdin.setRawMode && raw === false) stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', handler);
      showCursor();
    };

    stdin.on('data', handler);
  });

  cursorUp(options.length + offset);
  for (let i = 0; i < options.length + offset; i++) {
    clearLine();
    emit('\n');
  }
  cursorUp(options.length + offset);

  return result;
}

// ── Confirm (yes/no) prompt ──

export async function confirmMenu(prompt: string, defaultVal = true): Promise<boolean> {
  const options: MenuOption[] = [
    { label: 'Yes' },
    { label: 'No' },
  ];
  const idx = await radioMenu({
    prompt,
    options,
    defaultIndex: defaultVal ? 0 : 1,
  });
  return idx === 0;
}
