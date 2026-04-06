// multimodalCommands.ts - Slash commands for Multimodal Memory

import { MultimodalMemory, MemoryQuery } from './multimodalMemory.js';
import chalk from 'chalk';

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
