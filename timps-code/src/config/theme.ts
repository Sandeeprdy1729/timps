import chalk from 'chalk';

// ═══════════════════════════════════════
// Color Palette — Robot pixel mascot colors
// Dark teal screen + cream/tan body
// ═══════════════════════════════════════

const tealDark  = '#2D5A4F';   // robot screen face
const tealMid   = '#4A8C7A';   // accent teal
const tealLight = '#7EC8B8';   // highlight teal
const cream     = '#F5F0E1';   // paper background
const tan       = '#C8BF8C';   // robot body
const ink       = '#1C1C1C';   // dark outline
const green     = '#28A070';   // success
const yellow    = '#E8C94A';   // warning
const orange    = '#D4703A';   // orange
const red       = '#C83838';   // error
const slate     = '#64747A';   // muted
const zinc      = '#8A9098';   // dimmer muted

export const t = {
  // Brand — teal from robot screen
  brand: chalk.hex(tealDark),
  brandBold: chalk.hex(tealDark).bold,
  brandDim: chalk.hex(tealMid).dim,
  accent: chalk.hex(tealMid),
  accentBold: chalk.hex(tealMid).bold,
  glow: chalk.hex(tealLight),

  // Status
  success: chalk.hex(green),
  warning: chalk.hex(yellow),
  error: chalk.hex(red),
  info: chalk.hex(tealLight),

  // Text
  dim: chalk.dim,
  muted: chalk.hex(slate),
  bold: chalk.bold,
  italic: chalk.italic,
  white: chalk.white,

  // Code
  code: chalk.hex(tan),
  file: chalk.hex(tealLight).underline,
  tool: chalk.hex(tealMid).bold,
  key: chalk.hex(tealLight),
  lineNum: chalk.hex(zinc),
  string: chalk.hex(tan),

  // UI
  border: chalk.hex(slate),
  borderLight: chalk.hex(zinc),
  header: chalk.bold.hex(tealDark),
  prompt: chalk.hex(tealMid).bold,
  separator: chalk.hex(slate)('─'.repeat(60)),
  separatorDouble: chalk.hex(slate)('═'.repeat(60)),

  // Diff
  diffAdd: chalk.hex(green),
  diffRem: chalk.hex(red),
  diffCtx: chalk.hex('#9CA3AF'),

  // Dynamic color from hex string
  hex: (color: string) => chalk.hex(color),

  // Gradient helpers
  gradient: (text: string) => {
    const colors = [tealDark, tealMid, tealLight, tan];
    return [...text].map((ch, i) => chalk.hex(colors[i % colors.length])(ch)).join('');
  },
};

// ═══════════════════════════════════════
// ASCII Art Robot Mascot + Logo
// ═══════════════════════════════════════

// Pixel robot art — teal screen face, tan body, cream/pale eyes, dark feet
const robot = [
  chalk.hex(tealDark)('   ┌──────┐   '),
  chalk.hex(tealDark)('   │') + chalk.hex('#E8E0B0')(' ◉  ◉ ') + chalk.hex(tealDark)('│   '),
  chalk.hex(tealDark)('   │') + chalk.hex('#E8E0B0')('  ▿   ') + chalk.hex(tealDark)('│   '),
  chalk.hex(tealDark)('   └──────┘   '),
  chalk.hex(tan) ('    ║    ║    '),
  chalk.hex(tan) ('  ┌─┴────┴─┐ '),
  chalk.hex(tan) ('  │        │ '),
  chalk.hex(tan) ('  └─┬────┬─┘ '),
  chalk.hex(ink)('    ██    ██  '),
];

export const LOGO_LARGE = [
  '',
  `  ${t.brand('╔══════════════════════════════════════════════════════════╗')}`,
  `  ${t.brand('║')}                                                          ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[0] + `  ${chalk.hex(tealDark).bold('████████╗')}${chalk.hex(tealMid).bold('██╗')}${chalk.hex(tealMid).bold('███╗   ███╗')}  ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[1] + `  ${chalk.hex(tealDark).bold('╚══██╔══╝')}${chalk.hex(tealMid).bold('██║')}${chalk.hex(tealMid).bold('████╗ ████║')}  ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[2] + `  ${chalk.hex(tealDark).bold('   ██║   ')}${chalk.hex(tealMid).bold('██║')}${chalk.hex(tealMid).bold('██╔████╔██║')}  ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[3] + `  ${chalk.hex(tealDark).bold('   ██║   ')}${chalk.hex(tealMid).bold('██║')}${chalk.hex(tealMid).bold('██║╚██╔╝██║')}  ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[4] + `  ${chalk.hex(tealDark).bold('   ██║   ')}${chalk.hex(tealMid).bold('██║')}${chalk.hex(tealMid).bold('██║ ╚═╝ ██║')}  ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[5] + `  ${chalk.hex(tealDark).bold('   ╚═╝   ')}${chalk.hex(tealMid).bold('╚═╝')}${chalk.hex(tealMid).bold('╚═╝     ╚═╝')}  ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[6] + `                                ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[7] + `  ${t.accent('C O D E')}  ${t.dim('━━━━━━━━━━━━━━━━━━━━━')}  ${t.brand('║')}`,
  `  ${t.brand('║')}  ` + robot[8] + `                                ${t.brand('║')}`,
  `  ${t.brand('║')}                                                          ${t.brand('║')}`,
  `  ${t.brand('║')}    ${t.dim('▸')} ${chalk.hex(tealLight)('AI-Powered Coding Agent')}                            ${t.brand('║')}`,
  `  ${t.brand('║')}    ${t.dim('▸')} ${chalk.hex(tealMid)('Persistent Memory Across Sessions')}                  ${t.brand('║')}`,
  `  ${t.brand('║')}    ${t.dim('▸')} ${chalk.hex(green)('Self-Correcting · Auto-Healing')}                     ${t.brand('║')}`,
  `  ${t.brand('║')}    ${t.dim('▸')} ${chalk.hex(tan)('Local-First · 100% Private')}                         ${t.brand('║')}`,
  `  ${t.brand('║')}                                                          ${t.brand('║')}`,
  `  ${t.brand('╚══════════════════════════════════════════════════════════╝')}`,
  '',
].join('\n');

export const SMALL_LOGO = `  ${chalk.hex(tealDark)('🤖')} ${chalk.bold.hex(tealDark)('TIMPS Code')} ${t.dim('v1.0.0')}`;

// ═══════════════════════════════════════
// OpenCode-style clean block logo — no robot, no box
// ═══════════════════════════════════════

export const LOGO_TIMPS = [
  '',
  `  ${chalk.hex(tealDark).bold('████████╗██╗███╗   ███╗██████╗ ███████╗')}`,
  `  ${chalk.hex(tealDark).bold('╚══██╔══╝██║████╗ ████║██╔══██╗██╔════╝')}`,
  `  ${chalk.hex(tealDark).bold('   ██║   ██║██╔████╔██║██████╔╝███████╗')}`,
  `  ${chalk.hex(tealDark).bold('   ██║   ██║██║╚██╔╝██║██╔═══╝ ╚════██║')}`,
  `  ${chalk.hex(tealDark).bold('   ██║   ██║██║ ╚═╝ ██║██║     ███████║')}`,
  `  ${chalk.hex(tealDark).bold('   ╚═╝   ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝')}`,
  '',
  `          ${chalk.hex(tealMid).bold('T')} ${chalk.hex(tealMid).bold('I')} ${chalk.hex(tealMid).bold('M')} ${chalk.hex(tealMid).bold('P')} ${chalk.hex(tealMid).bold('S')}   ${chalk.hex(tealLight).bold('C')} ${chalk.hex(tealLight).bold('O')} ${chalk.hex(tealLight).bold('D')} ${chalk.hex(tealLight).bold('E')}`,
  '',
].join('\n');

// Compact logo for in-session use — points to the new clean block logo
export const LOGO = LOGO_TIMPS;

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
