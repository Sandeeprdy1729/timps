// inputCommands.ts - Voice and Document Input Commands

import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { voiceInput } from '../utils/voiceInput.js';
import { documentParser } from '../utils/documentParser.js';
import { MultimodalMemory } from '../memory/multimodalMemory.js';

const getMemory = () => new MultimodalMemory(process.cwd());
const memory = getMemory();

export async function handleVoiceCommand(args: string): Promise<string | null> {
  const [action, ...rest] = args.split(' ');

  switch (action) {
    case 'record':
    case 'r': {
      console.log(chalk.dim('\n  🎤 Starting voice recording...\n'));
      
      const result = await voiceInput.recordAndTranscribe();
      
      console.log(`\n  ${chalk.bold('Transcription:')}`);
      console.log(`  ${chalk.cyan(result.text)}\n`);
      
      return result.text;
    }

    case 'transcribe':
    case 't': {
      const filePath = rest.join(' ');
      if (!filePath) {
        console.log(chalk.dim('\n  Usage: /voice transcribe <audio-file>\n'));
        return null;
      }

      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`\n  File not found: ${filePath}\n`));
        return null;
      }

      console.log(chalk.dim(`\n  Transcribing: ${path.basename(filePath)}...\n`));
      
      const result = await voiceInput.transcribeAudioFile(filePath);
      
      console.log(`\n  ${chalk.bold('Transcription:')}`);
      console.log(`  ${chalk.cyan(result.text)}\n`);
      
      return result.text;
    }

    case 'status': {
      const available = await voiceInput.isAvailable();
      console.log(`\n  ${chalk.bold('Voice Input Status:')}`);
      console.log(`  ${available ? chalk.green('✓') : chalk.red('✗')} Audio processing`);
      console.log();
      return null;
    }

    default: {
      console.log(`\n${chalk.bold(' Voice Commands:')}`);
      console.log(`  ${chalk.cyan('/voice record')}       Record and transcribe`);
      console.log(`  ${chalk.cyan('/voice transcribe <f>')} Transcribe audio file`);
      console.log(`  ${chalk.cyan('/voice status')}       Check voice availability\n`);
      return null;
    }
  }
}

export async function handleDocumentCommand(args: string): Promise<string | null> {
  const [action, ...rest] = args.split(' ');
  const filePath = rest.join(' ');

  switch (action) {
    case 'parse':
    case 'p':
    case 'read': {
      if (!filePath) {
        console.log(chalk.dim('\n  Usage: /doc parse <file>\n'));
        return null;
      }

      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`\n  File not found: ${filePath}\n`));
        return null;
      }

      console.log(chalk.dim(`\n  Parsing: ${path.basename(filePath)}...\n`));
      
      const doc = await documentParser.parse(filePath);
      
      console.log(`  ${chalk.bold('Document:')} ${chalk.cyan(doc.filename)}`);
      console.log(`  ${chalk.bold('Type:')} ${doc.type}`);
      console.log(`  ${chalk.bold('Words:')} ${doc.wordCount}`);
      if (doc.pages) console.log(`  ${chalk.bold('Pages:')} ${doc.pages}`);
      console.log();

      console.log(`  ${chalk.bold('Preview:')}`);
      const preview = doc.content.slice(0, 1000);
      console.log(`  ${chalk.dim(preview)}`);
      if (doc.content.length > 1000) {
        console.log(`  ${chalk.dim('...')}`);
      }
      console.log();

      if (doc.type === 'image') {
        const analysis = await documentParser.analyzeWithGemma(doc);
        console.log(`  ${chalk.bold('Gemma Vision Analysis:')}`);
        console.log(`  ${chalk.cyan(analysis.description)}`);
        console.log();
      }

      const embed = await documentParser.generateEmbedding(doc.content);
      await memory.storeText(
        doc.content,
        documentParser.getSupportedTypes().includes(path.extname(filePath)) ? [doc.type] : ['document'],
        { filename: doc.filename, wordCount: doc.wordCount }
      );
      console.log(`  ${chalk.green('✓')} Stored in multimodal memory\n`);

      return doc.content;
    }

    case 'analyze':
    case 'a': {
      if (!filePath) {
        console.log(chalk.dim('\n  Usage: /doc analyze <file>\n'));
        return null;
      }

      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`\n  File not found: ${filePath}\n`));
        return null;
      }

      console.log(chalk.dim(`\n  Analyzing with Gemma vision: ${path.basename(filePath)}...\n`));
      
      const doc = await documentParser.parse(filePath);
      const analysis = await documentParser.analyzeWithGemma(doc);
      
      console.log(`  ${chalk.bold('Description:')}`);
      console.log(`  ${chalk.cyan(analysis.description)}`);
      console.log();
      
      console.log(`  ${chalk.bold('Summary:')}`);
      console.log(`  ${chalk.dim(analysis.summary)}`);
      console.log();
      
      if (analysis.tags.length > 0) {
        console.log(`  ${chalk.bold('Tags:')} ${analysis.tags.map(t => chalk.cyan(t)).join(', ')}`);
        console.log();
      }

      return analysis.description;
    }

    case 'search':
    case 's': {
      const query = rest.join(' ');
      if (!query) {
        console.log(chalk.dim('\n  Usage: /doc search <query>\n'));
        return null;
      }

      console.log(chalk.dim(`\n  Searching documents for: "${query}"...\n`));
      
      const results = await memory.search({
        text: query,
        limit: 10,
        threshold: 0.5,
      });

      if (results.length === 0) {
        console.log(`  ${chalk.dim('No documents found\n')}`);
        return null;
      }

      console.log(`  ${chalk.bold('Found:')} ${results.length} documents\n`);
      
      for (const r of results.slice(0, 5)) {
        console.log(`  ${chalk.cyan(r.entry.content.slice(0, 100))}...`);
        console.log(`  ${chalk.dim(`    [${(r.similarity * 100).toFixed(1)}% match]`)}`);
        console.log();
      }

      return results[0]?.entry.content || null;
    }

    case 'types': {
      console.log(`\n  ${chalk.bold('Supported Document Types:')}`);
      const types = documentParser.getSupportedTypes();
      console.log(`  ${types.map(t => chalk.cyan(t)).join(', ')}`);
      console.log();
      return null;
    }

    default: {
      console.log(`\n${chalk.bold(' Document Commands:')}`);
      console.log(`  ${chalk.cyan('/doc parse <file>')}     Parse and store document`);
      console.log(`  ${chalk.cyan('/doc analyze <file>')}    Analyze with Gemma vision`);
      console.log(`  ${chalk.cyan('/doc search <query>')}    Search stored documents`);
      console.log(`  ${chalk.cyan('/doc types')}            Show supported types\n`);
      return null;
    }
  }
}

export async function handleUploadCommand(args: string): Promise<string | null> {
  const [action, ...rest] = args.split(' ');
  const target = rest.join(' ');

  switch (action) {
    case 'image':
    case 'img': {
      if (!target) {
        console.log(chalk.dim('\n  Usage: /upload image <path>\n'));
        return null;
      }

      if (!fs.existsSync(target)) {
        console.log(chalk.red(`\n  File not found: ${target}\n`));
        return null;
      }

      console.log(chalk.dim(`\n  Processing image: ${path.basename(target)}...\n`));
      
      const id = await memory.storeImage(target, ['uploaded']);
      
      console.log(`  ${chalk.green('✓')} Image stored: ${id.slice(0, 8)}...\n`);
      
      return `[Image uploaded: ${path.basename(target)}]`;
    }

    case 'pdf':
    case 'document':
    case 'doc': {
      if (!target) {
        console.log(chalk.dim('\n  Usage: /upload pdf <path>\n'));
        return null;
      }

      if (!fs.existsSync(target)) {
        console.log(chalk.red(`\n  File not found: ${target}\n`));
        return null;
      }

      console.log(chalk.dim(`\n  Processing document: ${path.basename(target)}...\n`));
      
      const doc = await documentParser.parse(target);
      await memory.storeText(
        doc.content,
        ['uploaded', doc.type],
        { filename: doc.filename }
      );
      
      console.log(`  ${chalk.green('✓')} Document stored: ${doc.wordCount} words\n`);
      
      return `[Document uploaded: ${doc.filename} (${doc.wordCount} words)]`;
    }

    default: {
      console.log(`\n${chalk.bold(' Upload Commands:')}`);
      console.log(`  ${chalk.cyan('/upload image <path>')}   Upload image to memory`);
      console.log(`  ${chalk.cyan('/upload pdf <path>')}      Upload PDF/document to memory\n`);
      return null;
    }
  }
}
