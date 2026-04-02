// ── TIMPS Code — Terminal Renderer v2 ──
// Gorgeous CLI output with landing page, status bar, tools, plans, diffs

import chalk from 'chalk';
import { t, icons, panel, box, statusBar, divider, LOGO_LARGE, DOT_FRAMES, stripAnsi } from './theme.js';
import type { AgentEvent, PlanStep, TokenUsage } from './types.js';
import { getInstalledSkills } from './skills.js';
import { formatCost } from './utils.js';

// ═══════════════════════════════════════
// Streaming text renderer
// ═══════════════════════════════════════

let lineBuffer = '';

export function renderTextChunk(chunk: string): void {
  process.stdout.write(chunk);
  lineBuffer += chunk;
}

export function flushText(): void {
  if (lineBuffer.length > 0 && !lineBuffer.endsWith('\n')) {
    process.stdout.write('\n');
  }
  lineBuffer = '';
}

// ═══════════════════════════════════════
// Tool events — fancy display
// ═══════════════════════════════════════

export function renderToolStart(name: string, args: Record<string, unknown>): void {
  flushText();
  const icon = toolIcon(name);
  const summary = toolArgSummary(name, args);
  const riskBadge = toolRiskBadge(name);
  console.log(`\n  ${icon} ${t.tool(name)} ${riskBadge} ${t.dim(summary)}`);
}

export function renderToolResult(name: string, result: string, success: boolean, durationMs?: number): void {
  const status = success ? t.success(icons.success) : t.error(icons.error);
  const dur = durationMs ? t.dim(` ${durationMs}ms`) : '';

  const maxLines = 30;
  const lines = result.split('\n');
  const display = lines.length > maxLines
    ? lines.slice(0, maxLines).join('\n') + `\n${t.dim(`  ... ${lines.length - maxLines} more lines`)}`
    : result;

  if (name === 'edit_file' || name === 'multi_edit' || name === 'patch_file') {
    renderDiff(display, dur);
  } else if (name === 'list_directory') {
    renderTree(display, dur);
  } else if (name === 'search_code' || name === 'find_files') {
    renderSearchResult(display, dur);
  } else {
    const indented = display.split('\n').map(l => `  ${t.dim('│')} ${l}`).join('\n');
    console.log(`  ${status}${dur}\n${t.dim(indented)}`);
  }
}

// ═══════════════════════════════════════
// Diff rendering — colored with gutter
// ═══════════════════════════════════════

function renderDiff(diffOutput: string, dur: string): void {
  const lines = diffOutput.split('\n');
  const rendered: string[] = [];
  let added = 0, removed = 0;

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      rendered.push(`  ${t.dim('│')} ${t.dim(line)}`);
    } else if (line.startsWith('+')) {
      rendered.push(`  ${t.success('│')} ${t.diffAdd(line)}`);
      added++;
    } else if (line.startsWith('-')) {
      rendered.push(`  ${t.error('│')} ${t.diffRem(line)}`);
      removed++;
    } else if (line.startsWith('@@')) {
      rendered.push(`  ${t.info('│')} ${t.info(line)}`);
    } else {
      rendered.push(`  ${t.dim('│')} ${t.diffCtx(line)}`);
    }
  }

  const stats = `${t.success(`+${added}`)} ${t.error(`-${removed}`)}`;
  console.log(`  ${t.success(icons.success)} ${stats}${dur}\n${rendered.join('\n')}`);
}

// ═══════════════════════════════════════
// Tree rendering — colorful directories
// ═══════════════════════════════════════

function renderTree(output: string, dur: string): void {
  const lines = output.split('\n').map(l => {
    if (l.trimEnd().endsWith('/')) return `  ${t.dim('│')} ${t.accent(icons.folder + ' ' + l.trim())}`;
    return `  ${t.dim('│')} ${t.dim(icons.file + ' ')}${l.trim()}`;
  });
  console.log(`  ${t.success(icons.success)}${dur}\n${lines.join('\n')}`);
}

// ═══════════════════════════════════════
// Search result — highlighted matches
// ═══════════════════════════════════════

function renderSearchResult(output: string, dur: string): void {
  const lines = output.split('\n').slice(0, 25).map(l => {
    // Format "file:line:content" pattern
    const match = l.match(/^(.+?):(\d+):(.*)$/);
    if (match) {
      return `  ${t.dim('│')} ${t.file(match[1])}${t.dim(':')}${t.lineNum(match[2])} ${match[3].trim()}`;
    }
    return `  ${t.dim('│')} ${l}`;
  });
  console.log(`  ${t.success(icons.success)}${dur}\n${lines.join('\n')}`);
}

// ═══════════════════════════════════════
// Plan rendering — numbered steps
// ═══════════════════════════════════════

export function renderPlan(steps: PlanStep[]): void {
  flushText();
  console.log(`\n${divider('PLAN')}`);
  steps.forEach((step, i) => {
    const icon = step.status === 'done' ? t.success(icons.stepDone)
      : step.status === 'failed' ? t.error(icons.stepFail)
      : step.status === 'running' ? t.accent(icons.stepRun)
      : t.dim(icons.step);
    const num = t.dim(`${String(i + 1).padStart(2)}.`);
    console.log(`  ${icon} ${num} ${step.description}`);
  });
  console.log(divider());
  console.log();
}

export function renderPlanStepStart(index: number, description: string): void {
  console.log(`\n  ${t.accent(icons.arrowRight)} ${t.dim(`Step ${index + 1}:`)} ${description}`);
}

export function renderPlanStepDone(index: number, success: boolean): void {
  const icon = success ? t.success(icons.stepDone) : t.error(icons.stepFail);
  console.log(`  ${icon} ${t.dim(`Step ${index + 1}`)} ${success ? t.success('complete') : t.error('failed')}`);
}

// ═══════════════════════════════════════
// Self-correction indicator
// ═══════════════════════════════════════

export function renderSelfCorrect(attempt: number, error: string): void {
  flushText();
  console.log(`\n  ${t.warning(`${icons.correct} Self-correcting`)} ${t.dim(`attempt ${attempt}`)}`);
  console.log(`  ${t.dim('│')} ${t.dim(error.split('\n')[0].slice(0, 80))}`);
}

// ═══════════════════════════════════════
// Context compaction
// ═══════════════════════════════════════

export function renderContextCompacted(before: number, after: number): void {
  const saved = Math.round((1 - after / before) * 100);
  console.log(`\n  ${t.warning(`${icons.compact} Context at capacity — compacting`)}`);
  console.log(`  ${t.dim('│')} ${before.toLocaleString()} → ${after.toLocaleString()} tokens ${t.success(`(${saved}% freed)`)}`);
  console.log(`  ${t.dim('│')} Full history saved to ~/.timps/history/`);
}

// ═══════════════════════════════════════
// Snapshot
// ═══════════════════════════════════════

export function renderSnapshotCreated(id: string, fileCount: number): void {
  console.log(`  ${t.dim(`${icons.snap} Snapshot`)} ${t.dim(id.slice(0, 8))} ${t.dim(`(${fileCount} file${fileCount > 1 ? 's' : ''})`)}`);
}

// ═══════════════════════════════════════
// Memory
// ═══════════════════════════════════════

export function renderMemorySaved(summary: string): void {
  console.log(`  ${t.dim(`${icons.memory} Saved:`)} ${t.dim(summary.slice(0, 60))}`);
}

// ═══════════════════════════════════════
// Thinking indicator
// ═══════════════════════════════════════

let thinkingActive = false;
let thinkingInterval: ReturnType<typeof setInterval> | null = null;

export function renderThinkingStart(): void {
  if (!thinkingActive) {
    flushText();
    thinkingActive = true;
    let frame = 0;
    thinkingInterval = setInterval(() => {
      const spinner = DOT_FRAMES[frame % DOT_FRAMES.length];
      process.stdout.write(`\r  ${t.brand(spinner)} ${t.dim('thinking...')}  `);
      frame++;
    }, 80);
  }
}

export function renderThinkingEnd(): void {
  if (thinkingActive) {
    if (thinkingInterval) clearInterval(thinkingInterval);
    thinkingInterval = null;
    process.stdout.write('\r' + ' '.repeat(40) + '\r');
    thinkingActive = false;
  }
}

// ═══════════════════════════════════════
// Token usage display
// ═══════════════════════════════════════

export function renderUsage(usage: TokenUsage, model: string): void {
  const total = usage.inputTokens + usage.outputTokens;
  const parts = [
    `${t.dim('tokens')} ${t.accent(total.toLocaleString())}`,
    `${t.dim('in')} ${usage.inputTokens.toLocaleString()}`,
    `${t.dim('out')} ${usage.outputTokens.toLocaleString()}`,
  ];
  if (usage.estimatedCost !== undefined && usage.estimatedCost > 0) {
    parts.push(`${t.warning(formatCost(usage.estimatedCost))}`);
  } else if (usage.estimatedCost === 0 || !usage.estimatedCost) {
    parts.push(`${t.success('free')}`);
  }
  if (model) parts.push(t.dim(model));
  console.log(`\n  ${t.border('╰─')} ${parts.join(t.border(' · '))}`);
}

// ═══════════════════════════════════════
// Error
// ═══════════════════════════════════════

export function renderError(message: string): void {
  flushText();
  renderThinkingEnd();
  console.log(`\n  ${t.error(`${icons.error} ${message}`)}`);
}

// ═══════════════════════════════════════
// Prompt — main input prompt
// ═══════════════════════════════════════

export function renderPrompt(): void {
  process.stdout.write(`\n  ${t.prompt(icons.prompt)} `);
}

// ═══════════════════════════════════════
// Landing Page — shown on startup
// ═══════════════════════════════════════

export function renderLandingPage(
  model: string,
  provider: string,
  cwd: string,
  memoryCount: number,
  ollamaModels: string[],
): void {
  const shortCwd = cwd.replace(process.env.HOME || '', '~');

  // Logo
  console.log(LOGO_LARGE);

  // Status bar
  console.log(statusBar([
    { label: 'model', value: model, icon: icons.sparkle },
    { label: 'provider', value: provider },
    { label: 'dir', value: shortCwd, icon: icons.folder },
  ]));

  // Feature cards
  console.log();
  console.log(`  ${t.dim('┌─')} ${t.brandBold('What I can do')} ${t.dim('─'.repeat(38))}`);
  console.log(`  ${t.dim('│')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#8B5CF6')(icons.sparkle)} ${chalk.hex('#8B5CF6')('Read, write, and edit files')}       ${t.dim('— intelligent code changes')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#06B6D4')(icons.search)}  ${chalk.hex('#06B6D4')('Search code & find patterns')}       ${t.dim('— regex & semantic')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#10B981')(icons.bash)}  ${chalk.hex('#10B981')('Run commands & tests')}              ${t.dim('— build, test, deploy')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#3B82F6')(icons.git)}  ${chalk.hex('#3B82F6')('Git operations')}                   ${t.dim('— status, diff, commit')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#EC4899')(icons.memory)} ${chalk.hex('#EC4899')('Persistent memory')}                ${t.dim('— remembers across sessions')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#F59E0B')(icons.undo)}  ${chalk.hex('#F59E0B')('Undo any change')}                  ${t.dim('— automatic snapshots')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#06B6D4')(icons.search)}  ${chalk.hex('#06B6D4')('Web search & fetch URLs')}           ${t.dim('— DuckDuckGo / SearXNG')}`);
  console.log(`  ${t.dim('│')}  ${chalk.hex('#84CC16')(icons.tool)}  ${chalk.hex('#84CC16')('SkillGalaxy marketplace')}           ${t.dim('— 10k+ AI skills on demand')}`);
  console.log(`  ${t.dim('│')}`);
  console.log(`  ${t.dim('└─────────────────────────────────────────────────────')}`);

  // Memory + Skills status
  const installedSkills = getInstalledSkills();
  if (memoryCount > 0 || installedSkills.length > 0) {
    const parts: string[] = [];
    if (memoryCount > 0) parts.push(`${memoryCount} memories`);
    if (installedSkills.length > 0) parts.push(`${installedSkills.length} skill${installedSkills.length > 1 ? 's' : ''} active`);
    console.log(`\n  ${chalk.hex('#EC4899')(icons.memory)} ${t.dim(parts.join(' · '))}`);
  }

  // Available Ollama models
  if (ollamaModels.length > 0) {
    console.log(`\n  ${t.dim('Local models:')} ${ollamaModels.map(m => {
      const isActive = m.startsWith(model.split(':')[0]);
      return isActive ? t.accent(m) : t.dim(m);
    }).join(t.dim(' · '))}`);
  }

  // Hints
  console.log(`\n  ${t.dim('Type a message to start coding, or')} ${t.accent('/help')} ${t.dim('for commands')}`);
  console.log(`  ${t.dim('Press')} ${t.accent('Ctrl+C')} ${t.dim('to cancel, again to exit')}`);
  console.log();
}

// ═══════════════════════════════════════
// Welcome — compact (after first launch)
// ═══════════════════════════════════════

export function renderWelcome(model: string, cwd: string, memoryCount: number): void {
  renderLandingPage(model, '', cwd, memoryCount, []);
}

// ═══════════════════════════════════════
// Help — redesigned
// ═══════════════════════════════════════

export function renderHelp(): void {
  const sections = [
    {
      title: 'Navigation',
      commands: [
        ['/model <provider> [model]', 'Switch model (claude, openai, gemini, ollama, openrouter)'],
        ['/provider', 'Interactive provider selection menu'],
        ['/models', 'List local Ollama models'],
        ['/config', 'Run setup wizard'],
        ['/clear', 'Clear conversation history'],
        ['/exit', 'Exit TIMPS Code'],
      ],
    },
    {
      title: 'Memory & History',
      commands: [
        ['/memory [query]', 'View or search persistent memories'],
        ['/forget', 'Clear project memories'],
        ['/undo [n]', 'Undo last n file changes'],
        ['/snapshots', 'List file snapshots'],
      ],
    },
    {
      title: 'Skills (SkillGalaxy)',
      commands: [
        ['/skill', 'List installed skills'],
        ['/skill search <query>', 'Search SkillGalaxy marketplace'],
        ['/skill install <name>', 'Install a skill'],
        ['/skill remove <name>', 'Remove a skill'],
      ],
    },
    {
      title: 'Settings',
      commands: [
        ['/trust <level>', 'Set: cautious │ normal │ trust │ yolo'],
        ['/compact', 'Compact context window'],
        ['/cost', 'Show token usage & cost ($)'],
      ],
    },
    {
      title: 'Tech Stack',
      commands: [
        ['/tech', 'Show current tech stack'],
        ['/tech set', 'Interactive tech stack setup'],
        ['/tech add <type> <value>', 'Add: lang, fw, lib, pattern, rule'],
        ['/tech clear', 'Reset tech stack'],
      ],
    },
    {
      title: 'Team (Shared Memory)',
      commands: [
        ['/team', 'Show team info'],
        ['/team join <project> <name>', 'Join/create an encrypted team project'],
        ['/team leave', 'Leave the current team'],
        ['/team status', 'Members & recent activity'],
        ['/team progress', 'Show project progress'],
        ['/team add-progress <task>', 'Add progress update'],
        ['/team done <task>', 'Mark a task done'],
        ['/team share <fact>', 'Share knowledge with all members'],
      ],
    },
  ];

  console.log();
  for (const section of sections) {
    console.log(`  ${t.brandBold(section.title)}`);
    for (const [cmd, desc] of section.commands) {
      console.log(`    ${t.accent(cmd.padEnd(30))} ${t.dim(desc)}`);
    }
    console.log();
  }

  console.log(`  ${t.dim('Keyboard:')} ${t.accent('Ctrl+C')} ${t.dim('cancel/exit ·')} ${t.accent('Enter')} ${t.dim('send message')}`);
  console.log();
}

// ═══════════════════════════════════════
// Agent event dispatcher
// ═══════════════════════════════════════

export function renderAgentEvent(event: AgentEvent): void {
  switch (event.type) {
    case 'text': renderTextChunk(event.content); break;
    case 'thinking': renderThinkingStart(); break;
    case 'plan': renderPlan(event.steps); break;
    case 'plan_step_start': renderPlanStepStart(event.stepIndex, event.description); break;
    case 'plan_step_done': renderPlanStepDone(event.stepIndex, event.success); break;
    case 'tool_start':
      renderThinkingEnd();
      renderToolStart(event.tool, event.args);
      break;
    case 'tool_result': renderToolResult(event.tool, event.result, event.success, event.durationMs); break;
    case 'selfcorrect': renderSelfCorrect(event.attempt, event.error); break;
    case 'snapshot_created': renderSnapshotCreated(event.id, event.fileCount); break;
    case 'context_compacted': renderContextCompacted(event.before, event.after); break;
    case 'memory_saved': renderMemorySaved(event.summary); break;
    case 'error': renderError(event.message); break;
    case 'done':
      flushText();
      renderThinkingEnd();
      if (event.usage) renderUsage(event.usage, '');
      break;
  }
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function toolIcon(name: string): string {
  const map: Record<string, string> = {
    read_file: t.info(icons.file),
    write_file: chalk.hex('#F59E0B')(icons.fileEdit),
    edit_file: chalk.hex('#F59E0B')(icons.fileEdit),
    multi_edit: chalk.hex('#F59E0B')(icons.fileEdit),
    patch_file: chalk.hex('#F59E0B')(icons.fileEdit),
    list_directory: t.accent(icons.folderOpen),
    bash: chalk.hex('#EF4444')(icons.bash),
    search_code: chalk.hex('#3B82F6')(icons.search),
    find_files: chalk.hex('#3B82F6')(icons.search),
    git_status: chalk.hex('#8B5CF6')(icons.git),
    git_commit: chalk.hex('#F59E0B')(icons.git),
    think: chalk.hex('#EC4899')(icons.thinking),
  };
  return map[name] || t.tool(icons.tool);
}

function toolRiskBadge(name: string): string {
  const risks: Record<string, string> = {
    read_file: '', list_directory: '', search_code: '', find_files: '', git_status: '', think: '',
    write_file: t.warning('▪'), edit_file: t.warning('▪'), multi_edit: t.warning('▪'), patch_file: t.warning('▪'),
    bash: t.error('▪▪'), git_commit: t.error('▪▪'),
  };
  return risks[name] || '';
}

function toolArgSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file': case 'write_file': case 'edit_file':
    case 'multi_edit': case 'patch_file':
      return String(args.path || '');
    case 'list_directory':
      return String(args.path || '.');
    case 'bash':
      return trunc(String(args.command || ''), 70);
    case 'search_code':
      return `"${args.pattern}" ${args.path ? `in ${args.path}` : ''}`;
    case 'find_files':
      return String(args.pattern || '');
    case 'git_status':
      return String(args.subcommand || '');
    case 'git_commit':
      return trunc(String(args.message || ''), 55);
    case 'think':
      return trunc(String(args.thought || ''), 55);
    default:
      return '';
  }
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}
