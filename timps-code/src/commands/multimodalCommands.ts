// multimodalCommands.ts - Slash commands for Multimodal Memory

import { MultimodalMemory, MemoryQuery } from '../memory/multimodalMemory.js';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

export function registerMultimodalCommands(
  register: (name: string, aliases: string[], description: string, handler: (args: string, mm: MultimodalMemory) => Promise<void>) => void
): void {
  
  register('vision', ['vis'], 'Store or search images',
    async (args, mm) => {
      const [action, ...rest] = args.split(' ');
      
      if (action === 'store' || action === 'add') {
        const imagePath = rest.join(' ');
        if (!imagePath) {
          console.log(chalk.dim('\n Usage: /vision store <image-path> [tags...]\n'));
          return;
        }
        const tags = rest.slice(1);
        const id = await mm.storeImage(imagePath, tags);
        console.log(chalk.green(`\n ✓ Image stored: ${id.slice(0, 8)}...\n`));
      } 
      else if (action === 'search' || action === 'find') {
        const query = rest.join(' ');
        if (!query) {
          console.log(chalk.dim('\n Usage: /vision search <query>\n'));
          return;
        }
        const results = await mm.findSimilarImages(query);
        console.log(`\n${chalk.bold(' Similar Images')}\n`);
        for (const r of results) {
          console.log(`  ${chalk.cyan('[' + r.entry.type + ']')} similarity: ${(r.similarity * 100).toFixed(1)}%`);
          console.log(`    ${chalk.dim(r.entry.metadata.source || 'unknown')}`);
        }
        console.log();
      }
      else {
        console.log(chalk.dim('\n Usage: /vision [store|search] <args>\n'));
      }
    }
  );

  register('audio', ['sound', 'voice'], 'Store or search audio',
    async (args, mm) => {
      const [action, ...rest] = args.split(' ');
      
      if (action === 'store' || action === 'add') {
        const audioPath = rest[0];
        const duration = parseFloat(rest[1]) || 0;
        const tags = rest.slice(2);
        if (!audioPath) {
          console.log(chalk.dim('\n Usage: /audio store <audio-path> [duration] [tags...]\n'));
          return;
        }
        const id = await mm.storeAudio(audioPath, duration, tags);
        console.log(chalk.green(`\n ✓ Audio stored: ${id.slice(0, 8)}...\n`));
      }
      else if (action === 'search' || action === 'find') {
        const query = rest.join(' ');
        const results = await mm.search({ text: query, limit: 5 });
        console.log(`\n${chalk.bold(' Similar Audio')}\n`);
        for (const r of results) {
          console.log(`  ${chalk.cyan('[' + r.entry.type + ']')} similarity: ${(r.similarity * 100).toFixed(1)}%`);
          if (r.entry.metadata.duration) {
            console.log(`    duration: ${r.entry.metadata.duration}s`);
          }
        }
        console.log();
      }
      else {
        console.log(chalk.dim('\n Usage: /audio [store|search] <args>\n'));
      }
    }
  );

  register('recall', ['remember'], 'Recall multimodal memories',
    async (args, mm) => {
      const query: MemoryQuery = { limit: 10 };
      
      const parts = args.split(' --tags ');
      query.text = parts[0] || undefined;
      
      if (parts[1]) {
        query.tags = parts[1].split(' ').filter(Boolean);
      }
      
      const results = await mm.search(query);
      
      console.log(`\n${chalk.bold(' Multimodal Recall')}\n`);
      console.log(`  ${chalk.dim('Found:')} ${results.length} results\n`);
      
      for (const r of results.slice(0, 5)) {
        const icon = r.entry.type === 'image' ? '🖼' : r.entry.type === 'audio' ? '🎵' : '📝';
        console.log(`  ${icon} ${chalk.cyan(r.entry.type)} (${(r.similarity * 100).toFixed(1)}% match)`);
        console.log(`    ${r.entry.content.slice(0, 80)}${r.entry.content.length > 80 ? '...' : ''}`);
        if (r.entry.metadata.tags.length > 0) {
          console.log(`    tags: ${r.entry.metadata.tags.join(', ')}`);
        }
        console.log();
      }
    }
  );

  register('screenshot', ['ss', 'screen'], 'Capture and store a screenshot',
    async (args, mm) => {
      const tags = args.split(' ').filter(Boolean);
      const screenshotPath = await captureScreenshot();
      if (!screenshotPath) {
        console.log(chalk.dim('\n Screenshot capture requires macOS (screencapture) or import command\n'));
        return;
      }
      const id = await mm.storeImage(screenshotPath, tags);
      console.log(chalk.green(`\n ✓ Screenshot stored: ${id.slice(0, 8)}... (${screenshotPath})\n`));
    }
  );

  register('diagram', ['chart', 'plot'], 'Store a diagram or chart',
    async (args, mm) => {
      const [diagramType, ...rest] = args.split(' ');
      const imagePath = rest.join(' ');
      if (!imagePath) {
        console.log(chalk.dim('\n Usage: /diagram <type> <image-path>\n   Types: architecture, flowchart, uml, graph, wireframe, screenshot, other\n'));
        return;
      }
      const tags = rest.slice(1);
      const validTypes = ['architecture', 'flowchart', 'uml', 'graph', 'wireframe', 'screenshot', 'other'];
      const type = validTypes.includes(diagramType) ? diagramType : 'other';
      const id = await mm.storeDiagram(imagePath, type, tags);
      console.log(chalk.green(`\n ✓ Diagram stored: ${id.slice(0, 8)}... (type: ${type})\n`));
    }
  );

  register('terminal', ['cmd', 'command'], 'Capture terminal output as memory',
    async (args, mm) => {
      const parts = args.split(' -- ');
      const command = parts[0]?.trim();
      const output = parts[1]?.trim() || '';
      const tags = parts.slice(2);

      if (!command) {
        console.log(chalk.dim('\n Usage: /terminal <command> -- <output> [tags...]\n'));
        return;
      }

      const exitCode = output.includes('Error') || output.includes('failed') ? 1 : 0;
      const id = await mm.captureTerminal(command, output, exitCode, tags);
      console.log(chalk.green(`\n ✓ Terminal output captured: ${id.slice(0, 8)}...\n`));
    }
  );

  register('crossmodal', ['cm', 'query-all'], 'Search across all memory modalities',
    async (args, mm) => {
      const parts = args.split(' --tags ');
      const query = (parts[0] || '').trim();
      const tagFilter = parts[1] ? parts[1].split(' ').filter(Boolean) : undefined;

      if (!query) {
        console.log(chalk.dim('\n Usage: /crossmodal <query> [--tags tag1 tag2]\n'));
        return;
      }

      const results = await mm.crossModalRecall(query, {
        limit: 15,
        threshold: 0.4,
        tags: tagFilter,
        includeLinked: true,
      });

      console.log(`\n${chalk.bold(' Cross-Modal Recall')}\n`);
      console.log(`  ${chalk.dim('Query:')} "${query}"`);
      console.log(`  ${chalk.dim('Found:')} ${results.length} results\n`);

      for (const r of results.slice(0, 8)) {
        const icon = r.entry.type === 'image' ? '🖼' : r.entry.type === 'audio' ? '🎵' : '📄';
        const typeLabel = r.entry.metadata.diagramType
          ? `diagram:${r.entry.metadata.diagramType}`
          : r.entry.type;
        console.log(`  ${icon} ${chalk.cyan(typeLabel)} (${(r.similarity * 100).toFixed(1)}% match)`);
        const content = r.entry.content.slice(0, 80);
        console.log(`    ${content}${r.entry.content.length > 80 ? '...' : ''}`);
        if (r.entry.metadata.tags.length > 0) {
          console.log(`    tags: ${r.entry.metadata.tags.join(', ')}`);
        }
        console.log();
      }
    }
  );

  register('mmbudget', ['storage', 'budget'], 'Show multimodal storage budget',
    async (args, mm) => {
      const budget = mm.getStorageBudget();
      const stats = await mm.getStats();

      console.log(`\n${chalk.bold(' Storage Budget')}\n`);
      console.log(`  ${chalk.dim('Used:')} ${formatBytes(budget.usedBytes)} / ${formatBytes(budget.maxBytes)}`);
      console.log(`  ${chalk.dim('Usage:')} ${chalk.cyan(budget.percentUsed + '%')}`);
      console.log(`  ${chalk.dim('Total entries:')} ${chalk.cyan(String(stats.total))}`);

      if (budget.percentUsed > 80) {
        console.log(`\n  ${chalk.yellow('⚠ High storage usage — consider pruning with /mmbudget --prune')}`);
      }
      console.log();
    }
  );

  register('visionstats', ['vstats'], 'Show multimodal memory stats',
    async (args, mm) => {
      const stats = await mm.getStats();
      
      console.log(`\n${chalk.bold(' Multimodal Memory Stats')}\n`);
      console.log(`  ${chalk.dim('Total entries:')} ${chalk.cyan(String(stats.total))}`);
      console.log(`  ${chalk.dim('Images:')} ${chalk.cyan(String(stats.byType.image || 0))}`);
      console.log(`  ${chalk.dim('Audio:')} ${chalk.cyan(String(stats.byType.audio || 0))}`);
      console.log(`  ${chalk.dim('Text:')} ${chalk.cyan(String(stats.byType.text || 0))}`);
      console.log(`  ${chalk.dim('Avg access count:')} ${chalk.cyan(stats.avgAccessCount.toFixed(1))}`);
      console.log();
    }
  );
}

export async function handleMultimodalCommand(
  cmd: string,
  args: string,
  mm: MultimodalMemory
): Promise<boolean> {
  switch (cmd) {
    case 'vision':
    case 'vis': {
      const [action, ...rest] = args.split(' ');
      
      if (action === 'store' || action === 'add') {
        const imagePath = rest[0];
        const tags = rest.slice(1);
        if (!imagePath) {
          console.log(chalk.dim('\n Usage: /vision store <image-path> [tags...]\n'));
          return true;
        }
        const id = await mm.storeImage(imagePath, tags);
        console.log(chalk.green(`\n ✓ Image stored: ${id.slice(0, 8)}...\n`));
        return true;
      }
      
      if (action === 'search' || action === 'find' || !action) {
        const query = rest.join(' ') || args;
        if (!query) {
          console.log(chalk.dim('\n Usage: /vision search <query>\n'));
          return true;
        }
        const results = await mm.findSimilarImages(query);
        console.log(`\n${chalk.bold(' Similar Images')}\n`);
        for (const r of results) {
          console.log(`  ${chalk.cyan('[' + r.entry.type + ']')} similarity: ${(r.similarity * 100).toFixed(1)}%`);
          console.log(`    ${chalk.dim(r.entry.metadata.source || 'unknown')}`);
        }
        console.log();
        return true;
      }
      return false;
    }

    case 'audio':
    case 'sound':
    case 'voice': {
      const [action, ...rest] = args.split(' ');
      
      if (action === 'store' || action === 'add') {
        const audioPath = rest[0];
        const duration = parseFloat(rest[1]) || 0;
        const tags = rest.slice(2);
        if (!audioPath) {
          console.log(chalk.dim('\n Usage: /audio store <audio-path> [duration] [tags...]\n'));
          return true;
        }
        const id = await mm.storeAudio(audioPath, duration, tags);
        console.log(chalk.green(`\n ✓ Audio stored: ${id.slice(0, 8)}...\n`));
        return true;
      }
      return false;
    }

    case 'recall':
    case 'remember': {
      const parts = args.split(' --tags ');
      const query: MemoryQuery = { 
        text: parts[0] || undefined, 
        limit: 10 
      };
      
      if (parts[1]) {
        query.tags = parts[1].split(' ').filter(Boolean);
      }
      
      const results = await mm.search(query);
      
      console.log(`\n${chalk.bold(' Multimodal Recall')}\n`);
      console.log(`  ${chalk.dim('Found:')} ${results.length} results\n`);
      
      for (const r of results.slice(0, 5)) {
        const icon = r.entry.type === 'image' ? '🖼' : r.entry.type === 'audio' ? '🎵' : '📝';
        console.log(`  ${icon} ${chalk.cyan(r.entry.type)} (${(r.similarity * 100).toFixed(1)}% match)`);
        console.log(`    ${r.entry.content.slice(0, 80)}${r.entry.content.length > 80 ? '...' : ''}`);
        console.log();
      }
      return true;
    }

    case 'screenshot':
    case 'ss':
    case 'screen': {
      const ssTags = args.split(' ').filter(Boolean);
      const screenshotPath = await captureScreenshot();
      if (!screenshotPath) {
        console.log(chalk.dim('\n Screenshot capture requires macOS (screencapture)\n'));
        return true;
      }
      const ssId = await mm.storeImage(screenshotPath, ssTags);
      console.log(chalk.green(`\n ✓ Screenshot stored: ${ssId.slice(0, 8)}... (${screenshotPath})\n`));
      return true;
    }

    case 'diagram':
    case 'chart':
    case 'plot': {
      const [diagramType, ...diagramArgs] = args.split(' ');
      const imgPath = diagramArgs.join(' ');
      if (!imgPath) {
        console.log(chalk.dim('\n Usage: /diagram <type> <image-path>\n'));
        return true;
      }
      const validTypes = ['architecture', 'flowchart', 'uml', 'graph', 'wireframe', 'screenshot', 'other'];
      const dtype = validTypes.includes(diagramType) ? diagramType : 'other';
      const diagramTags = diagramArgs.slice(1);
      const diagId = await mm.storeDiagram(imgPath, dtype, diagramTags);
      console.log(chalk.green(`\n ✓ Diagram stored: ${diagId.slice(0, 8)}... (type: ${dtype})\n`));
      return true;
    }

    case 'terminal':
    case 'cmd':
    case 'command': {
      const cmdParts = args.split(' -- ');
      const command = cmdParts[0]?.trim();
      const output = cmdParts[1]?.trim() || '';
      if (!command) {
        console.log(chalk.dim('\n Usage: /terminal <command> -- <output>\n'));
        return true;
      }
      const exitCode = output.includes('Error') || output.includes('failed') ? 1 : 0;
      await mm.captureTerminal(command, output, exitCode);
      console.log(chalk.green(`\n ✓ Terminal output captured\n`));
      return true;
    }

    case 'crossmodal':
    case 'cm':
    case 'query-all': {
      const cmParts = args.split(' --tags ');
      const cmQuery = (cmParts[0] || '').trim();
      const cmTags = cmParts[1] ? cmParts[1].split(' ').filter(Boolean) : undefined;
      if (!cmQuery) {
        console.log(chalk.dim('\n Usage: /crossmodal <query>\n'));
        return true;
      }
      const cmResults = await mm.crossModalRecall(cmQuery, {
        limit: 15, threshold: 0.4, tags: cmTags, includeLinked: true,
      });
      console.log(`\n${chalk.bold(' Cross-Modal Recall')}\n`);
      console.log(`  ${chalk.dim('Found:')} ${cmResults.length} results\n`);
      for (const r of cmResults.slice(0, 8)) {
        const icon = r.entry.type === 'image' ? '🖼' : r.entry.type === 'audio' ? '🎵' : '📄';
        const typeLabel = r.entry.metadata.diagramType
          ? `diagram:${r.entry.metadata.diagramType}`
          : r.entry.type;
        console.log(`  ${icon} ${chalk.cyan(typeLabel)} (${(r.similarity * 100).toFixed(1)}%)`);
        console.log(`    ${r.entry.content.slice(0, 80)}`);
        console.log();
      }
      return true;
    }

    case 'mmbudget':
    case 'storage':
    case 'budget': {
      const budget = mm.getStorageBudget();
      const st = await mm.getStats();
      console.log(`\n${chalk.bold(' Storage Budget')}\n`);
      console.log(`  ${chalk.dim('Used:')} ${formatBytes(budget.usedBytes)} / ${formatBytes(budget.maxBytes)}`);
      console.log(`  ${chalk.dim('Usage:')} ${chalk.cyan(budget.percentUsed + '%')}`);
      console.log(`  ${chalk.dim('Total entries:')} ${chalk.cyan(String(st.total))}`);
      if (budget.percentUsed > 80) {
        console.log(`\n  ${chalk.yellow('⚠ High storage usage')}`);
      }
      console.log();
      return true;
    }

    case 'visionstats':
    case 'vstats': {
      const stats = await mm.getStats();
      
      console.log(`\n${chalk.bold(' Multimodal Memory Stats')}\n`);
      console.log(`  ${chalk.dim('Total entries:')} ${chalk.cyan(String(stats.total))}`);
      console.log(`  ${chalk.dim('Images:')} ${chalk.cyan(String(stats.byType.image || 0))}`);
      console.log(`  ${chalk.dim('Audio:')} ${chalk.cyan(String(stats.byType.audio || 0))}`);
      console.log(`  ${chalk.dim('Text:')} ${chalk.cyan(String(stats.byType.text || 0))}`);
      console.log();
      return true;
    }

    default:
      return false;
  }
}

// ── Helpers ──

async function captureScreenshot(): Promise<string | null> {
  const screenshotDir = path.join(os.homedir(), '.timps', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filename = `screenshot_${Date.now()}.png`;
  const filepath = path.join(screenshotDir, filename);

  try {
    if (process.platform === 'darwin') {
      execSync(`screencapture -x "${filepath}"`, { timeout: 5000 });
    } else if (process.platform === 'linux') {
      execSync(`import "${filepath}"`, { timeout: 5000 });
    } else {
      return null;
    }
    return fs.existsSync(filepath) ? filepath : null;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
