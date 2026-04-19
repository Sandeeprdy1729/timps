import chalk from 'chalk';

// ═══════════════════════════════════════
// Color Palette — Deep space violet + electric cyan
// ═══════════════════════════════════════

const purple  = '#7C3AED';
const violet  = '#8B5CF6';
const indigo  = '#6366F1';
const cyan    = '#06B6D4';
const teal    = '#14B8A6';
const green   = '#10B981';
const yellow  = '#FBBF24';
const orange  = '#F59E0B';
const red     = '#EF4444';
const blue    = '#3B82F6';
const pink    = '#EC4899';
const lime    = '#84CC16';
const slate   = '#64748B';
const zinc    = '#71717A';
const dimGray = '#4B5563';
const darkGray = '#374151';

export const t = {
  // Brand
  brand: chalk.hex(purple),
  brandBold: chalk.hex(purple).bold,
  brandDim: chalk.hex(violet).dim,
  accent: chalk.hex(cyan),
  accentBold: chalk.hex(cyan).bold,
  glow: chalk.hex(pink),

  // Status
  success: chalk.hex(green),
  warning: chalk.hex(orange),
  error: chalk.hex(red),
  info: chalk.hex(blue),

  // Text
  dim: chalk.dim,
  muted: chalk.gray,
  bold: chalk.bold,
  italic: chalk.italic,
  white: chalk.white,

  // Code
  code: chalk.hex(yellow),
  file: chalk.hex(cyan).underline,
  tool: chalk.hex(violet).bold,
  key: chalk.hex(teal),
  lineNum: chalk.hex(zinc),
  string: chalk.hex(lime),

  // UI
  border: chalk.hex(dimGray),
  borderLight: chalk.hex(slate),
  header: chalk.bold.hex(purple),
  prompt: chalk.hex(purple).bold,
  separator: chalk.hex(darkGray)('─'.repeat(60)),
  separatorDouble: chalk.hex(darkGray)('═'.repeat(60)),

  //Diff
  diffAdd: chalk.hex(green),
  diffRem: chalk.hex(red),
  diffCtx: chalk.hex('#9CA3AF'),

  // Gradient helpers
  gradient: (text: string) => {
    const colors = [purple, indigo, cyan, teal];
    return [...text].map((ch, i) => chalk.hex(colors[i % colors.length])(ch)).join('');
  },
};

// ═══════════════════════════════════════
// ASCII Art Logos
// ═══════════════════════════════════════

export const LOGO_LARGE = [
  '',
  `  ${t.brand('┌──────────────────────────────────────────────────────────┐')}`,
  `  ${t.brand('│')}                                                          ${t.brand('│')}`,
  `  ${t.brand('│')}    ${chalk.hex(violet).bold('████████╗')}${chalk.hex(indigo).bold('██╗')}${chalk.hex(blue).bold('███╗   ███╗')}${chalk.hex(cyan).bold('██████╗ ')}${chalk.hex(teal).bold('███████╗')}       ${t.brand('│')}`,
  `  ${t.brand('│')}    ${chalk.hex(violet).bold('╚══██╔══╝')}${chalk.hex(indigo).bold('██║')}${chalk.hex(blue).bold('████╗ ████║')}${chalk.hex(cyan).bold('██╔══██╗')}${chalk.hex(teal).bold('██╔════╝')}       ${t.brand('│')}`,
  `  ${t.brand('│')}    ${chalk.hex(violet).bold('   ██║   ')}${chalk.hex(indigo).bold('██║')}${chalk.hex(blue).bold('██╔████╔██║')}${chalk.hex(cyan).bold('██████╔╝')}${chalk.hex(teal).bold('███████╗')}       ${t.brand('│')}`,
  `  ${t.brand('│')}    ${chalk.hex(violet).bold('   ██║   ')}${chalk.hex(indigo).bold('██║')}${chalk.hex(blue).bold('██║╚██╔╝██║')}${chalk.hex(cyan).bold('██╔═══╝ ')}${chalk.hex(teal).bold('╚════██║')}       ${t.brand('│')}`,
  `  ${t.brand('│')}    ${chalk.hex(violet).bold('   ██║   ')}${chalk.hex(indigo).bold('██║')}${chalk.hex(blue).bold('██║ ╚═╝ ██║')}${chalk.hex(cyan).bold('██║     ')}${chalk.hex(teal).bold('███████║')}       ${t.brand('│')}`,
  `  ${t.brand('│')}    ${chalk.hex(violet).bold('   ╚═╝   ')}${chalk.hex(indigo).bold('╚═╝')}${chalk.hex(blue).bold('╚═╝     ╚═╝')}${chalk.hex(cyan).bold('╚═╝     ')}${chalk.hex(teal).bold('╚══════╝')}       ${t.brand('│')}`,
  `  ${t.brand('│')}                                                          ${t.brand('│')}`,
  `  ${t.brand('│')}    ${chalk.hex(pink)('⚡')} ${chalk.bold.hex(violet)('C O D E')}  ${t.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}     ${t.brand('│')}`,
  `  ${t.brand('│')}                                                          ${t.brand('│')}`,
  `  ${t.brand('│')}    ${t.dim('▸')} ${chalk.hex(cyan)('AI-Powered Coding Agent')}                            ${t.brand('│')}`,
  `  ${t.brand('│')}    ${t.dim('▸')} ${chalk.hex(teal)('Persistent Memory Across Sessions')}                  ${t.brand('│')}`,
  `  ${t.brand('│')}    ${t.dim('▸')} ${chalk.hex(green)('Self-Correcting · Auto-Healing')}                     ${t.brand('│')}`,
  `  ${t.brand('│')}    ${t.dim('▸')} ${chalk.hex(blue)('Local-First · 100% Private')}                         ${t.brand('│')}`,
  `  ${t.brand('│')}                                                          ${t.brand('│')}`,
  `  ${t.brand('└──────────────────────────────────────────────────────────┘')}`,
  '',
].join('\n');

// Compact logo for in-session use
export const LOGO = LOGO_LARGE;

export const SMALL_LOGO = `  ${chalk.hex(pink)('⚡')} ${chalk.bold.hex(violet)('TIMPS Code')} ${t.dim('v1.0.0')}`;

export const icons = {
  // Core
  thinking: '◐',
  tool: '⚡',
  success: '✔',
  error: '✘',
  warning: '⚠',
  info: 'ℹ',

  // Files & navigation
  file: '◇',
  fileEdit: '◆',
  folder: '▸',
  folderOpen: '▾',

  // Actions
  search: '⊙',
  git: '⎇',
  bash: '▶',
  memory: '◈',
  key: '⊡',
  lock: '◉',
  arrow: '→',
  arrowRight: '▸',
  arrowDown: '▾',
  bullet: '·',
  dot: '●',
  ring: '○',

  // Prompt
  prompt: '❯',
  promptAlt: '›',

  // Planning
  plan: '◆',
  undo: '↺',
  snap: '⊞',
  correct: '↻',
  compact: '⊟',

  // Steps
  step: '▪',
  stepDone: '▣',
  stepFail: '▢',
  stepRun: '▪',

  // Status
  online: '●',
  offline: '○',
  loading: '◌',

  // Sparkle
  sparkle: '✦',
  star: '★',
  diamond: '◇',
  heart: '♥',
};

// ═══════════════════════════════════════
// Box drawing components
// ═══════════════════════════════════════

export const box = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│',
  ltee: '├', rtee: '┤',
  // Heavy
  htl: '┏', htr: '┓', hbl: '┗', hbr: '┛',
  hh: '━', hv: '┃',
  // Double
  dtl: '╔', dtr: '╗', dbl: '╚', dbr: '╝',
  dh: '═', dv: '║',
};

// ═══════════════════════════════════════
// Panel component — box-drawn section
// ═══════════════════════════════════════

export function panel(title: string, content: string, width = 60): string {
  const inner = width - 4;
  const lines: string[] = [];
  const titleLen = stripAnsi(title).length;
  const topBar = box.h.repeat(Math.max(0, inner - titleLen - 1));
  lines.push(`  ${t.border(box.tl + box.h)} ${t.header(title)} ${t.border(topBar + box.tr)}`);
  for (const line of content.split('\n')) {
    const stripped = stripAnsi(line);
    const pad = Math.max(0, inner - stripped.length);
    lines.push(`  ${t.border(box.v)} ${line}${' '.repeat(pad)} ${t.border(box.v)}`);
  }
  lines.push(`  ${t.border(box.bl + box.h.repeat(inner + 2) + box.br)}`);
  return lines.join('\n');
}

// ═══════════════════════════════════════
// Status Bar — model + dir + memory
// ═══════════════════════════════════════

export function statusBar(sections: { label: string; value: string; icon?: string }[], width = 60): string {
  const inner = width - 4;
  const parts = sections.map(s => {
    const icon = s.icon ? `${s.icon} ` : '';
    return `${t.dim(icon + s.label + ':')} ${t.accent(s.value)}`;
  });
  const joined = parts.join(t.border(' │ '));
  const stripped = stripAnsi(joined);
  const pad = Math.max(0, inner - stripped.length);
  return [
    `  ${t.border(box.tl + box.h.repeat(inner + 2) + box.tr)}`,
    `  ${t.border(box.v)} ${joined}${' '.repeat(pad)} ${t.border(box.v)}`,
    `  ${t.border(box.bl + box.h.repeat(inner + 2) + box.br)}`,
  ].join('\n');
}

// ═══════════════════════════════════════
// Divider with label
// ═══════════════════════════════════════

export function divider(label?: string, width = 56): string {
  if (!label) return `  ${t.border(box.h.repeat(width))}`;
  const labelLen = stripAnsi(label).length;
  const side = Math.max(2, Math.floor((width - labelLen - 2) / 2));
  const rem = width - side - labelLen - 2;
  return `  ${t.border(box.h.repeat(side))} ${t.dim(label)} ${t.border(box.h.repeat(Math.max(0, rem)))}`;
}

// ═══════════════════════════════════════
// Progress bar
// ═══════════════════════════════════════

export function progressBar(current: number, total: number, width = 24): string {
  const ratio = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return t.brand('█'.repeat(filled)) + t.border('░'.repeat(empty));
}

// ═══════════════════════════════════════
// Spinner frames
// ═══════════════════════════════════════

export const SPINNER_FRAMES = ['◐', '◓', '◑', '◒'];
export const DOT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}
