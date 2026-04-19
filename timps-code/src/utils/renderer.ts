// ── TIMPS Code — Terminal Renderer v3 ──
// Memory panel · Todo tracker · Context bar · Cost display · Rich diffs
// Inspired by Claude Code's Ink renderer — pure terminal, zero dependencies beyond chalk

import chalk from 'chalk';
import {
  t, icons, panel, box, statusBar, divider,
  LOGO_LARGE, DOT_FRAMES, stripAnsi,
} from '../config/theme.js';
import type { AgentEvent, PlanStep, TokenUsage, MemoryEntry, WorkingMemory } from '../config/types.js';
import { getInstalledSkills } from './skills.js';
import { formatCost } from './utils.js';

const W = process.stdout.columns || 100;
const bar = (n: number, total: number, w = 20, full = '█', empty = '░') => {
  const filled = total === 0 ? 0 : Math.round((n / total) * w);
  return chalk.hex('#7C3AED')(full.repeat(filled)) + chalk.hex('#374151')(empty.repeat(w - filled));
};

// ═══════════════════════════════════════
// Streaming text renderer
// ═══════════════════════════════════════

let lineBuffer = '';

export function renderTextChunk(chunk: string): void {
  process.stdout.write(chunk);
  lineBuffer += chunk;
}

export function flushText(): void {
  if (lineBuffer.length > 0 && !lineBuffer.endsWith('\n')) process.stdout.write('\n');
  lineBuffer = '';
}

// ═══════════════════════════════════════
// Landing page — TIMPS signature
// ═══════════════════════════════════════

export function renderLandingPage(
  model: string,
  provider: string,
  cwd: string,
  memoryFacts: number,
  ollamaModels: string[],
  todoCount?: number,
  sessionCount?: number,
): void {
  const lines = LOGO_LARGE.split('\n');
  for (const line of lines) console.log(line);
  console.log();

  // Info grid
  const providerColor = { claude: '#7C3AED', openai: '#10B981', gemini: '#3B82F6', ollama: '#F59E0B', openrouter: '#EC4899' }[provider] ?? '#64748B';
  const project = cwd.split('/').slice(-2).join('/');

  const infoLines = [
    `  ${t.dim('model')}    ${chalk.hex(providerColor).bold(model)}`,
    `  ${t.dim('project')}  ${t.accent(project)}`,
    `  ${t.dim('memory')}   ${memoryFacts > 0 ? t.success(`${memoryFacts} facts`) : t.dim('empty — I\'ll learn as we work')}`,
    todoCount ? `  ${t.dim('todos')}    ${t.warning(`${todoCount} open`)}` : '',
    sessionCount ? `  ${t.dim('sessions')} ${t.dim(`${sessionCount} stored`)}` : '',
  ].filter(Boolean);

  for (const l of infoLines) console.log(l);
  console.log();

  // Context bar
  console.log(`  ${t.dim('context')}  ${bar(0, 200000)} ${t.dim('0 / 200k tokens')}`);
  console.log();

  // Quick help
  console.log(`  ${t.dim('type')} ${t.brand('/help')} ${t.dim('to see commands')} ${t.dim('·')} ${t.dim('Ctrl+C to cancel')} ${t.dim('·')} ${t.dim('Ctrl+D to quit')}`);
  console.log();

  if (ollamaModels.length > 1) {
    console.log(`  ${t.dim('local models:')} ${ollamaModels.map(m => t.key(m)).join(t.dim(', '))}`);
    console.log();
  }
}

// ═══════════════════════════════════════
// Prompt indicator
// ═══════════════════════════════════════

export function renderPrompt(model?: string, tokens?: number, cost?: number): void {
  const modelPart = model ? ` ${t.dim(model.slice(0, 18))}` : '';
  const tokenPart = tokens ? ` ${t.dim(`${(tokens / 1000).toFixed(1)}k tok`)}` : '';
  const costPart = cost ? ` ${t.dim(`$${cost.toFixed(4)}`)}` : '';
  process.stdout.write(`\n  ${t.brand('▸')}${modelPart}${tokenPart}${costPart} `);
}

export function renderChatReady(): void {
  console.log(`\n  ${t.success(icons.success)} ${t.dim('Ready. Ask me anything.')}\n`);
}

// ═══════════════════════════════════════
// Context window usage bar
// ═══════════════════════════════════════

export function renderContextBar(used: number, max: number): void {
  const pct = Math.round((used / max) * 100);
  const color = pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981';
  const b = bar(used, max, 30, '█', '░');
  const label = `${(used / 1000).toFixed(1)}k / ${(max / 1000).toFixed(0)}k tokens (${pct}%)`;
  console.log(`\n  ${t.dim('context')} ${b} ${chalk.hex(color)(label)}`);
}

// ═══════════════════════════════════════
// Tool events — rich cards with borders
// ═══════════════════════════════════════

export function renderToolStart(name: string, args: Record<string, unknown>): void {
  flushText();
  const icon = toolIcon(name);
  const summary = toolArgSummary(name, args);
  const riskBadge = toolRiskBadge(name);
  const border = chalk.hex('#374151')('─'.repeat(Math.min(W - 6, 60)));

  console.log(`\n  ${chalk.hex('#374151')('┌')}${border}`);
  console.log(`  ${chalk.hex('#374151')('│')} ${icon} ${t.tool(name)} ${riskBadge}`);
  if (summary) {
    console.log(`  ${chalk.hex('#374151')('│')} ${t.dim('  ' + summary)}`);
  }
}

export function renderToolResult(name: string, result: string, success: boolean, durationMs?: number): void {
  const status = success ? t.success(icons.success) : t.error(icons.error);
  const dur = durationMs ? t.dim(` ${durationMs}ms`) : '';
  const border = chalk.hex('#374151')('─'.repeat(Math.min(W - 6, 60)));

  const maxLines = 35;
  const lines = result.split('\n');
  const truncated = lines.length > maxLines;
  const display = truncated
    ? lines.slice(0, maxLines).join('\n') + `\n${t.dim(`  … ${lines.length - maxLines} more lines`)}`
    : result;

  if (name === 'edit_file' || name === 'multi_edit' || name === 'patch_file' || name === 'write_file') {
    renderDiff(display, dur, border);
  } else if (name === 'list_directory') {
    renderTree(display, dur, border);
  } else if (name === 'search_code' || name === 'find_files') {
    renderSearchResult(display, dur, border);
  } else if (name === 'run_bash' || name === 'run_command') {
    renderBashOutput(display, status, dur, border, success);
  } else {
    const indented = display.split('\n').map(l => `  ${t.dim('│')} ${l}`).join('\n');
    console.log(`  ${t.dim('│')} ${status}${dur}`);
    if (display.trim()) console.log(indented);
  }

  console.log(`  ${chalk.hex('#374151')('└')}${border}`);
}

// ═══════════════════════════════════════
// Bash output — with exit code
// ═══════════════════════════════════════

function renderBashOutput(output: string, status: string, dur: string, border: string, success: boolean): void {
  const prefix = success ? t.success('✓') : t.error('✗');
  console.log(`  ${t.dim('│')} ${status}${dur}`);
  const lines = output.split('\n');
  for (const line of lines) {
    const colored = success ? t.dim('  │ ') + line : t.dim('  │ ') + chalk.hex('#FCA5A5')(line);
    console.log(colored);
  }
}

// ═══════════════════════════════════════
// Diff rendering — full unified diff
// ═══════════════════════════════════════

function renderDiff(diffOutput: string, dur: string, border: string): void {
  const lines = diffOutput.split('\n');
  let added = 0, removed = 0;
  let filename = '';

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      const fname = line.replace(/^[+-]{3}\s+/, '').replace(/\s+\d{4}-.*$/, '').trim();
      if (fname && fname !== '/dev/null') filename = fname;
      console.log(`  ${t.dim('│')} ${t.dim(line)}`);
    } else if (line.startsWith('+')) {
      console.log(`  ${t.success('│')} ${t.diffAdd(line)}`);
      added++;
    } else if (line.startsWith('-')) {
      console.log(`  ${t.error('│')} ${t.diffRem(line)}`);
      removed++;
    } else if (line.startsWith('@@')) {
      console.log(`  ${t.info('│')} ${t.info(line)}`);
    } else {
      console.log(`  ${t.dim('│')} ${t.diffCtx(line)}`);
    }
  }

  const stats = `${t.success(`+${added}`)} ${t.error(`-${removed}`)}`;
  const fileLabel = filename ? ` ${t.file(filename)}` : '';
  console.log(`  ${t.dim('│')} ${t.success(icons.success)}${dur} ${stats}${fileLabel}`);
}

// ═══════════════════════════════════════
// Tree rendering — directory with icons
// ═══════════════════════════════════════

function renderTree(output: string, dur: string, _border: string): void {
  const lines = output.split('\n').map(l => {
    if (l.trimEnd().endsWith('/')) {
      return `  ${t.dim('│')} ${t.accent(icons.folder + ' ' + l.trim())}`;
    }
    const ext = l.trim().split('.').pop() ?? '';
    const langColor = { ts: '#60A5FA', js: '#FBBF24', py: '#34D399', rs: '#F97316', go: '#22D3EE', md: '#A78BFA', json: '#10B981' }[ext] ?? '#9CA3AF';
    return `  ${t.dim('│')} ${chalk.hex(langColor)(icons.file + ' ')}${l.trim()}`;
  });
  console.log(`  ${t.dim('│')} ${t.success(icons.success)}${dur}`);
  for (const l of lines) console.log(l);
}

// ═══════════════════════════════════════
// Search results — with match highlights
// ═══════════════════════════════════════

function renderSearchResult(output: string, dur: string, _border: string): void {
  const lines = output.split('\n');
  let matchCount = 0;

  for (const line of lines) {
    if (line.includes(':')) {
      const colonIdx = line.indexOf(':');
      const filePart = line.slice(0, colonIdx);
      const matchPart = line.slice(colonIdx + 1);
      console.log(`  ${t.dim('│')} ${t.file(filePart)}${t.dim(':')}${t.accent(matchPart)}`);
      matchCount++;
    } else {
      console.log(`  ${t.dim('│')} ${t.dim(line)}`);
    }
  }
  console.log(`  ${t.dim('│')} ${t.success(icons.success)}${dur} ${t.dim(`${matchCount} matches`)}`);
}

// ═══════════════════════════════════════
// Agent event dispatcher
// ═══════════════════════════════════════

export function renderAgentEvent(event: AgentEvent): void {
  switch (event.type) {
    case 'text':
      renderTextChunk(event.content);
      break;

    case 'thinking':
      flushText();
      const thinkLines = event.content.trim().split('\n').slice(0, 6);
      console.log(`\n  ${t.dim('◈ thinking')}`);
      for (const l of thinkLines) {
        console.log(`    ${t.dim(l)}`);
      }
      console.log();
      break;

    case 'plan':
      flushText();
      renderPlan(event.plan?.steps || []);
      break;

    case 'plan_step_start':
      console.log(`\n  ${t.accent('→')} ${t.dim(`step ${event.stepIndex + 1}:`)} ${event.description}`);
      break;

    case 'plan_step_done':
      console.log(`  ${event.success ? t.success(icons.success) : t.error(icons.error)} step ${event.stepIndex + 1} ${event.success ? 'done' : 'failed'}`);
      break;

    case 'tool_start':
      renderToolStart(event.tool, event.args);
      break;

    case 'tool_result':
      renderToolResult(event.tool, event.result, event.success, event.durationMs);
      break;

    case 'selfcorrect':
      flushText();
      console.log(`\n  ${t.warning(icons.warning)} self-correcting (attempt ${event.attempt})`);
      console.log(`  ${t.dim('  error: ')}${t.error(event.error.slice(0, 120))}`);
      break;

    case 'snapshot_created':
      flushText();
      console.log(`\n  ${t.info(icons.snap)} snapshot ${t.dim(event.id)} — ${event.fileCount} files`);
      break;

    case 'context_compacted':
      flushText();
      const saved = event.before - event.after;
      console.log(`\n  ${t.success('◈')} context compacted — ${t.dim(`${(event.before / 1000).toFixed(0)}k → ${(event.after / 1000).toFixed(0)}k`)} ${t.success(`(saved ${(saved / 1000).toFixed(0)}k)`)}`);
      break;

    case 'memory_saved':
      flushText();
      console.log(`\n  ${t.success(icons.memory)} memory saved: ${t.dim(event.summary)}`);
      break;

    case 'done':
      flushText();
      if (event.usage) renderTokenUsage(event.usage);
      break;

    case 'error':
      flushText();
      renderError(event.message);
      break;
  }
}

// ═══════════════════════════════════════
// Plan rendering
// ═══════════════════════════════════════

function renderPlan(steps: PlanStep[]): void {
  console.log(`\n  ${t.brandBold('◈ PLAN')} ${t.dim(`— ${steps.length} steps`)}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(50))}`);

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const statusIcon = {
      pending: t.dim('○'),
      running: t.accent('◉'),
      done: t.success('●'),
      failed: t.error('●'),
      skipped: t.dim('◌'),
    }[s.status];

    console.log(`  ${statusIcon} ${t.dim(`${i + 1}.`)} ${s.description}`);
    if (s.result && s.status !== 'pending') {
      console.log(`     ${t.dim('└')} ${t.muted(s.result.slice(0, 80))}`);
    }
  }
  console.log();
}

// ═══════════════════════════════════════
// Token usage + cost breakdown
// ═══════════════════════════════════════

function renderTokenUsage(usage: TokenUsage): void {
  const total = usage.inputTokens + usage.outputTokens;
  const costStr = usage.estimatedCost !== undefined ? ` · ${t.dim('$')}${t.success(usage.estimatedCost.toFixed(5))}` : '';
  console.log(`\n  ${t.dim('tokens')} ${t.dim(`${(usage.inputTokens / 1000).toFixed(1)}k in`)} ${t.dim('·')} ${t.dim(`${(usage.outputTokens / 1000).toFixed(1)}k out`)} ${t.dim('·')} ${t.dim(`${(total / 1000).toFixed(1)}k total`)}${costStr}`);
}

export function renderCostSummary(sessions: { model: string; cost: number; tokens: number; timestamp: number }[]): void {
  const totalCost = sessions.reduce((s, r) => s + r.cost, 0);
  const totalTokens = sessions.reduce((s, r) => s + r.tokens, 0);

  console.log(`\n  ${t.brandBold('◈ COST SUMMARY')}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(50))}`);
  console.log(`  ${t.dim('total')}   ${t.success('$' + totalCost.toFixed(5))} across ${sessions.length} sessions`);
  console.log(`  ${t.dim('tokens')}  ${t.dim((totalTokens / 1000).toFixed(1))}k total`);

  // Per-model breakdown
  const byModel = new Map<string, { cost: number; tokens: number; count: number }>();
  for (const s of sessions) {
    const entry = byModel.get(s.model) ?? { cost: 0, tokens: 0, count: 0 };
    entry.cost += s.cost;
    entry.tokens += s.tokens;
    entry.count++;
    byModel.set(s.model, entry);
  }

  if (byModel.size > 1) {
    console.log(`\n  ${t.dim('by model:')}`);
    for (const [model, data] of byModel) {
      console.log(`  ${t.accent('·')} ${t.key(model.padEnd(30))} ${t.success('$' + data.cost.toFixed(5))} ${t.dim(`(${(data.tokens / 1000).toFixed(1)}k tok, ${data.count} sessions)`)}`);
    }
  }
  console.log();
}

// ═══════════════════════════════════════
// Memory panel — the TIMPS signature feature
// ═══════════════════════════════════════

export function renderMemoryPanel(
  entries: MemoryEntry[],
  working: WorkingMemory,
  episodeCount: number,
  query?: string,
): void {
  const filtered = query
    ? entries.filter(e => e.content.toLowerCase().includes(query.toLowerCase()) || e.tags.some(t2 => t2.includes(query)))
    : entries.slice(-20);

  const statsByType: Record<string, number> = {};
  for (const e of entries) statsByType[e.type] = (statsByType[e.type] ?? 0) + 1;

  console.log(`\n  ${t.brandBold('◈ TIMPS MEMORY LAYER')}`);
  console.log(`  ${chalk.hex('#374151')('═'.repeat(56))}`);

  // Stats grid
  console.log(`\n  ${t.accent('semantic')}  ${t.success(String(entries.length).padStart(4))} facts   ${t.dim('│')}  ${t.accent('episodic')}  ${t.success(String(episodeCount).padStart(3))} sessions`);
  console.log(`  ${t.accent('working')}   ${t.success(String(working.activeFiles.length).padStart(4))} files   ${t.dim('│')}  ${t.accent('patterns')}  ${t.success(String(working.discoveredPatterns.length).padStart(3))} found`);

  // By type breakdown
  if (Object.keys(statsByType).length > 0) {
    const typeColors: Record<string, string> = {
      fact: '#60A5FA',
      pattern: '#34D399',
      preference: '#FBBF24',
      error_lesson: '#F87171',
      architecture: '#A78BFA',
      convention: '#F59E0B',
    };
    console.log(`\n  ${t.dim('by type:')}`);
    for (const [type, count] of Object.entries(statsByType)) {
      const color = typeColors[type] ?? '#9CA3AF';
      const b = bar(count, entries.length, 15);
      console.log(`  ${chalk.hex(color)(type.padEnd(16))} ${b} ${t.dim(String(count))}`);
    }
  }

  // Active files
  if (working.activeFiles.length > 0) {
    console.log(`\n  ${t.dim('recently active files:')}`);
    for (const f of working.activeFiles.slice(-6)) {
      console.log(`  ${t.dim('  ·')} ${t.file(f)}`);
    }
  }

  // Discovered patterns
  if (working.discoveredPatterns.length > 0) {
    console.log(`\n  ${t.dim('discovered patterns:')}`);
    for (const p of working.discoveredPatterns.slice(-5)) {
      console.log(`  ${t.dim('  ·')} ${t.dim(p)}`);
    }
  }

  // Recent errors
  if (working.recentErrors.length > 0) {
    console.log(`\n  ${t.dim('recent errors (learn from these):')}`);
    for (const e of working.recentErrors.slice(-3)) {
      console.log(`  ${t.error('  ·')} ${t.dim(e.slice(0, 80))}`);
    }
  }

  // Semantic entries
  if (filtered.length > 0) {
    const heading = query ? `memories matching "${query}":` : 'recent semantic memory:';
    console.log(`\n  ${t.dim(heading)}`);
    console.log(`  ${chalk.hex('#374151')('─'.repeat(52))}`);

    for (const entry of filtered) {
      const age = Math.round((Date.now() - entry.timestamp) / (24 * 3600 * 1000));
      const ageStr = age === 0 ? 'today' : `${age}d ago`;
      const typeColors: Record<string, string> = {
        architecture: '#A78BFA', convention: '#F59E0B', error_lesson: '#F87171',
        fact: '#60A5FA', pattern: '#34D399', preference: '#FBBF24',
      };
      const typeColor = typeColors[entry.type] ?? '#9CA3AF';
      const confBar = bar(entry.confidence, 1, 5, '▪', '▫');

      console.log(`  ${chalk.hex(typeColor)('[' + entry.type.slice(0, 4) + ']')} ${t.dim(ageStr.padEnd(8))} ${confBar}  ${entry.content.slice(0, 60)}`);
      if (entry.tags.length > 0) {
        console.log(`  ${' '.repeat(24)}${entry.tags.map(tag => t.dim(`#${tag}`)).join(' ')}`);
      }
    }
  } else if (query) {
    console.log(`\n  ${t.dim(`no memories matching "${query}"`)}`);
  }

  console.log();
}

// ═══════════════════════════════════════
// Todo tracker display
// ═══════════════════════════════════════

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
  doneAt?: number;
  source: 'user' | 'agent';
}

export function renderTodoList(todos: Todo[]): void {
  const open = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done).slice(-5);

  console.log(`\n  ${t.brandBold('◈ TODOS')} ${t.dim(`— ${open.length} open, ${done.length} done`)}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(52))}`);

  if (open.length === 0 && done.length === 0) {
    console.log(`  ${t.dim('no todos yet — add with /todo add <text>')}`);
    console.log();
    return;
  }

  const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#60A5FA' };
  const priorityIcons: Record<string, string> = { high: '!!', medium: '! ', low: '  ' };

  if (open.length > 0) {
    console.log(`\n  ${t.dim('open:')}`);
    for (const todo of open) {
      const pc = priorityColors[todo.priority] ?? '#9CA3AF';
      const pi = priorityIcons[todo.priority] ?? '  ';
      const sourceTag = todo.source === 'agent' ? t.dim(' [ai]') : '';
      console.log(`  ${chalk.hex(pc)(pi)} ${t.dim('□')} ${todo.text}${sourceTag}`);
    }
  }

  if (done.length > 0) {
    console.log(`\n  ${t.dim('recently done:')}`);
    for (const todo of done) {
      const age = todo.doneAt ? Math.round((Date.now() - todo.doneAt) / 3600000) : 0;
      const ageStr = age < 1 ? 'just now' : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`;
      console.log(`  ${t.dim('  ')} ${t.success('✓')} ${t.dim(todo.text + ' · ' + ageStr)}`);
    }
  }

  console.log();
}

// ═══════════════════════════════════════
// Doctor — system health check
// ═══════════════════════════════════════

export function renderDoctorReport(checks: { name: string; ok: boolean; detail: string }[]): void {
  console.log(`\n  ${t.brandBold('◈ TIMPS DOCTOR')}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(52))}\n`);

  for (const check of checks) {
    const icon = check.ok ? t.success('✓') : t.error('✗');
    const nameColor = check.ok ? t.dim : t.error;
    console.log(`  ${icon} ${nameColor(check.name.padEnd(28))} ${t.dim(check.detail)}`);
  }

  const failing = checks.filter(c => !c.ok);
  console.log();
  if (failing.length === 0) {
    console.log(`  ${t.success('All checks passed ✓')}\n`);
  } else {
    console.log(`  ${t.error(`${failing.length} check(s) failing`)}\n`);
    for (const f of failing) {
      console.log(`  ${t.warning('→')} fix: ${t.dim(f.name)} — ${f.detail}`);
    }
    console.log();
  }
}

// ═══════════════════════════════════════
// Git output
// ═══════════════════════════════════════

export function renderGitStatus(output: string): void {
  console.log(`\n  ${t.brandBold('◈ GIT STATUS')}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(52))}`);

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('M')) console.log(`  ${t.warning('M')} ${line.slice(2)}`);
    else if (line.startsWith('A')) console.log(`  ${t.success('A')} ${line.slice(2)}`);
    else if (line.startsWith('D')) console.log(`  ${t.error('D')} ${line.slice(2)}`);
    else if (line.startsWith('?')) console.log(`  ${t.dim('?')} ${line.slice(3)}`);
    else if (line.startsWith('##')) console.log(`  ${t.accent('→')} ${t.dim(line.slice(3))}`);
    else console.log(`  ${t.dim(line)}`);
  }
  console.log();
}

export function renderGitLog(output: string): void {
  console.log(`\n  ${t.brandBold('◈ GIT LOG')}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(52))}`);

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    // Format: hash message
    const match = line.match(/^([a-f0-9]{7,8})\s+(.*)$/);
    if (match) {
      console.log(`  ${t.dim(match[1])} ${match[2]}`);
    } else {
      console.log(`  ${t.dim(line)}`);
    }
  }
  console.log();
}

// ═══════════════════════════════════════
// Error display
// ═══════════════════════════════════════

export function renderError(message: string): void {
  const lines = message.split('\n');
  console.log(`\n  ${t.error('✗ error')} ${t.dim('─────────────────────────────')}`);
  for (const line of lines.slice(0, 8)) {
    console.log(`  ${t.error('│')} ${chalk.hex('#FCA5A5')(line)}`);
  }
  console.log(`  ${t.error('└────────────────────────────────')}\n`);
}

// ═══════════════════════════════════════
// Help display
// ═══════════════════════════════════════

export function renderHelp(): void {
  console.log(`\n  ${t.brandBold('◈ TIMPS CODE')} ${t.dim('— Commands')}`);
  console.log(`  ${chalk.hex('#374151')('═'.repeat(56))}\n`);

  const commands: [string, string, string?][] = [
    // General
    ['/help', 'show this help', 'h'],
    ['/clear', 'clear screen', 'c'],
    ['/cost', 'show session cost breakdown'],
    ['/doctor', 'run system health check'],
    ['/think <question>', 'reasoning mode'],
    ['/plan <task>', 'enter planning mode'],
    ['/context', 'show context usage'],

    // Model
    ['/provider', 'switch AI provider'],
    ['/model <provider> [model]', 'switch model', 'm'],
    ['/models', 'list available models'],

    // Memory
    ['/memory [query]', 'show memory panel (optional filter)', 'mem'],
    ['/memory query <text>', 'semantic search in memory'],
    ['/memory forget <id>', 'remove a memory entry'],
    ['/memory export', 'export memory to file'],
    ['/memory clear', 'wipe all memory for project'],

    // Todos
    ['/todo', 'list todos', 't'],
    ['/todo add <text>', 'add todo item'],
    ['/todo done <text>', 'mark todo done'],
    ['/todo clear', 'clear all todos'],

    // Git
    ['/git', 'git status'],
    ['/git log', 'recent commits'],
    ['/git diff', 'uncommitted diff'],

    // Session
    ['/save', 'save session'],
    ['/compact', 'summarize and compress context'],
    ['/undo', 'undo last file changes'],

    // Snapshots
    ['/snap', 'list snapshots'],
    ['/snap restore <id>', 'restore a snapshot'],
    ['/snap diff <id>', 'show what changed in snapshot'],

    // Skills
    ['/skills', 'show installed skills'],
    ['/skills search <name>', 'search skill marketplace'],
    ['/skills install <name>', 'install a skill'],

    // Forge (version control)
    ['/forge', 'show forge commands'],
    ['/forge branches', 'list memory branches'],
    ['/forge log', 'show version history'],
    ['/forge stats', 'show forge statistics'],

    // Multimodal Memory
    ['/vision store <path>', 'store image in memory'],
    ['/vision search <query>', 'find similar images'],
    ['/audio store <path>', 'store audio in memory'],
    ['/recall <query>', 'search all memories (text+image+audio)'],
    ['/visionstats', 'show multimodal memory stats'],

    // Team
    ['/team join <proj> <name>', 'join/create team'],
    ['/team status', 'show team info'],
    ['/team share <fact>', 'share knowledge with team'],
  ];

  let lastGroup = '';
  for (const [cmd, desc, alias] of commands) {
    const group = cmd.startsWith('/provider') ? 'model' :
      cmd.startsWith('/model') ? 'model' :
      cmd.startsWith('/memory') || cmd.startsWith('/mem') ? 'memory' :
      cmd.startsWith('/todo') ? 'todo' :
      cmd.startsWith('/git') ? 'git' :
      cmd.startsWith('/snap') ? 'snapshots' :
      cmd.startsWith('/skill') ? 'skills' :
      cmd.startsWith('/forge') ? 'forge' :
      cmd.startsWith('/team') ? 'team' :
      cmd.startsWith('/vision') || cmd.startsWith('/audio') || cmd.startsWith('/recall') || cmd.startsWith('/vstats') ? 'multimodal' :
      cmd.startsWith('/save') || cmd.startsWith('/compact') || cmd.startsWith('/undo') || cmd.startsWith('/plan') || cmd.startsWith('/think') || cmd.startsWith('/context') ? 'session' :
      'general';

    if (group !== lastGroup) {
      console.log(`\n  ${t.dim('·'.repeat(4))} ${t.dim(group)}`);
      lastGroup = group;
    }

    const aliasStr = alias ? t.dim(` (/${alias})`) : '';
    console.log(`  ${t.brand(cmd.padEnd(32))} ${t.dim(desc)}${aliasStr}`);
  }

  console.log(`\n  ${chalk.hex('#374151')('─'.repeat(56))}`);
  console.log(`  ${t.dim('TIMPS vs Claude Code:')}`);
  console.log(`  ${t.success('✓')} ${t.dim('persistent 3-layer memory across sessions')}`);
  console.log(`  ${t.success('✓')} ${t.dim('multi-model: Claude · GPT-4 · Gemini · Ollama')}`);
  console.log(`  ${t.success('✓')} ${t.dim('team memory — shared knowledge base per project')}`);
  console.log(`  ${t.success('✓')} ${t.dim('built-in todo tracking from agent output')}`);
  console.log(`  ${t.success('✓')} ${t.dim('snapshot undo — revert any file changes instantly')}`);
  console.log(`  ${t.success('✓')} ${t.dim('skills marketplace — extend with custom prompts')}`);
  console.log(`  ${t.success('✓')} ${t.dim('100% open-source, runs offline via Ollama')}`);
  console.log();
}

// ═══════════════════════════════════════
// Models list
// ═══════════════════════════════════════

export function renderModelsList(current: string, providers: string[]): void {
  console.log(`\n  ${t.brandBold('◈ AVAILABLE MODELS')}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(52))}\n`);

  const modelGroups: Record<string, string[]> = {
    'claude (Anthropic)': ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
    'openai (OpenAI)': ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    'gemini (Google)': ['gemini-2.0-flash', 'gemini-1.5-pro'],
    'ollama (local)': ['qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'deepseek-r1:7b', 'codellama:7b'],
  };

  for (const [group, models] of Object.entries(modelGroups)) {
    console.log(`  ${t.dim(group)}`);
    for (const m of models) {
      const isCurrent = m === current;
      const marker = isCurrent ? t.success('▶') : t.dim('·');
      console.log(`  ${marker} ${isCurrent ? t.accentBold(m) : t.dim(m)}`);
    }
    console.log();
  }
}

// ═══════════════════════════════════════
// Skill discovery
// ═══════════════════════════════════════

export function renderSkills(installed: string[], available?: string[]): void {
  console.log(`\n  ${t.brandBold('◈ SKILLS')}`);
  console.log(`  ${chalk.hex('#374151')('─'.repeat(52))}\n`);

  if (installed.length === 0) {
    console.log(`  ${t.dim('no skills installed yet')}`);
    console.log(`  ${t.dim('use /skills install <name> to add one')}\n`);
    return;
  }

  console.log(`  ${t.dim('installed:')}`);
  for (const s of installed) {
    console.log(`  ${t.success('·')} ${t.accent(s)}`);
  }

  if (available && available.length > 0) {
    console.log(`\n  ${t.dim('available:')}`);
    for (const s of available.filter(a => !installed.includes(a))) {
      console.log(`  ${t.dim('·')} ${t.dim(s)}`);
    }
  }
  console.log();
}

// ═══════════════════════════════════════
// Tool helpers
// ═══════════════════════════════════════

function toolIcon(name: string): string {
  const map: Record<string, string> = {
    read_file: '📄', write_file: '✍', edit_file: '✏️',
    list_directory: '📁', run_bash: '⚡', find_files: '🔍',
    search_code: '🔎', get_git_status: '⎇', multi_edit: '✏️',
    patch_file: '🩹', run_tests: '🧪', think: '💭',
    web_fetch: '🌐', create_dir: '📁',
  };
  return map[name] ?? '🔧';
}

function toolArgSummary(name: string, args: Record<string, unknown>): string {
  if (args.path) return String(args.path);
  if (args.command) return String(args.command).slice(0, 80);
  if (args.query) return String(args.query);
  if (args.pattern) return String(args.pattern);
  if (args.url) return String(args.url);
  if (args.paths && Array.isArray(args.paths)) return args.paths.join(', ');
  return '';
}

function toolRiskBadge(name: string): string {
  const risk: Record<string, string> = {
    run_bash: chalk.hex('#EF4444').dim('[high]'),
    write_file: chalk.hex('#F59E0B').dim('[med]'),
    edit_file: chalk.hex('#F59E0B').dim('[med]'),
    multi_edit: chalk.hex('#F59E0B').dim('[med]'),
    patch_file: chalk.hex('#F59E0B').dim('[med]'),
    read_file: chalk.hex('#10B981').dim('[low]'),
    list_directory: chalk.hex('#10B981').dim('[low]'),
    find_files: chalk.hex('#10B981').dim('[low]'),
    search_code: chalk.hex('#10B981').dim('[low]'),
    think: chalk.hex('#10B981').dim('[safe]'),
  };
  return risk[name] ?? chalk.hex('#64748B').dim('[?]');
}