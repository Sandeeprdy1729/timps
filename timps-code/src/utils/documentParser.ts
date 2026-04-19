// documentParser.ts - Document Parser for PDF, DOC, Images with Gemma Vision
// Extracts text and generates embeddings for documents

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

let pdfParse: any = null;

async function getPdfParse() {
  if (!pdfParse) {
    const { PDFParse } = await import('pdf-parse');
    pdfParse = PDFParse;
  }
  return pdfParse;
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface DocumentConfig {
  maxPages?: number;
  maxFileSize?: number;
  ocrEnabled?: boolean;
  visionModel?: string;
}

const DEFAULT_CONFIG: DocumentConfig = {
  maxPages: 100,
  maxFileSize: 50 * 1024 * 1024,
  ocrEnabled: false,
  visionModel: 'gemma3:1b',
};

export interface ParsedDocument {
  id: string;
  filename: string;
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'md' | 'image';
  content: string;
  pages?: number;
  wordCount: number;
  language?: string;
  metadata: Record<string, any>;
  embeddings?: number[];
  timestamp: number;
}

export interface VisionAnalysis {
  description: string;
  text: string;
  tags: string[];
  summary: string;
}

export class DocumentParser {
  private config: DocumentConfig;
  private tempDir: string;

  constructor(config: Partial<DocumentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tempDir = path.join(process.env.HOME || '/tmp', '.timps', 'documents');
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  async parse(filePath: string): Promise<ParsedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);

    if (stats.size > this.config.maxFileSize!) {
      throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${this.config.maxFileSize! / 1024 / 1024}MB)`);
    }

    let content = '';
    let metadata: Record<string, any> = {};

    switch (ext) {
      case '.pdf':
        const pdfResult = await this.parsePDF(filePath);
        content = pdfResult.content;
        metadata = pdfResult.metadata;
        break;

      case '.txt':
      case '.md':
      case '.text':
        content = this.parseText(filePath);
        break;

      case '.doc':
      case '.docx':
        content = await this.parseDoc(filePath);
        break;

      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.gif':
      case '.webp':
        content = await this.parseImage(filePath);
        metadata = { ...metadata, type: 'image' };
        break;

      default:
        content = this.parseText(filePath);
    }

    const id = crypto.randomUUID();
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return {
      id,
      filename: path.basename(filePath),
      type: this.getDocType(ext),
      content,
      wordCount,
      metadata,
      timestamp: Date.now(),
    };
  }

  private async parsePDF(filePath: string): Promise<{ content: string; metadata: Record<string, any> }> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = await getPdfParse();
      const data = await parser(dataBuffer, { max: this.config.maxPages });

      return {
        content: data.text,
        metadata: {
          pages: data.numpages,
          title: data.info?.Title || '',
          author: data.info?.Author || '',
          creationDate: data.info?.CreationDate || '',
        },
      };
    } catch (err) {
      return {
        content: `[PDF parsing failed: ${(err as Error).message}]`,
        metadata: {},
      };
    }
  }

  private parseText(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      return `[Text parsing failed: ${(err as Error).message}]`;
    }
  }

  private async parseDoc(filePath: string): Promise<string> {
    try {
      const result = execSync(
        `textutil -convert txt -stdout "${filePath}" 2>/dev/null || cat "${filePath}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      return result;
    } catch {
      return '[DOC parsing requires textutil (macOS) or antiword]';
    }
  }

  private async parseImage(filePath: string): Promise<string> {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const base64 = imageBuffer.toString('base64');

      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.visionModel,
          prompt: `Analyze this image/document thoroughly. Extract all visible text, describe the content, and provide a comprehensive summary. Focus on:
1. Any text visible in the image
2. Structure and layout
3. Key information and data
4. Charts, diagrams, or visual elements

Provide your analysis in a structured format.`,
          images: [base64],
          stream: false,
          options: { num_predict: 1000 },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return data.response;
      }
    } catch {}

    return `[Image requires Gemma vision for analysis. File: ${path.basename(filePath)}]`;
  }

  private getDocType(ext: string): 'pdf' | 'doc' | 'docx' | 'txt' | 'md' | 'image' {
    const types: Record<string, 'pdf' | 'doc' | 'docx' | 'txt' | 'md' | 'image'> = {
      '.pdf': 'pdf',
      '.doc': 'doc',
      '.docx': 'docx',
      '.txt': 'txt',
      '.md': 'md',
      '.markdown': 'md',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.webp': 'image',
    };
    return types[ext] || 'txt';
  }

  async analyzeWithGemma(document: ParsedDocument): Promise<VisionAnalysis> {
    if (document.type === 'image') {
      return this.analyzeImage(document.content);
    }

    return {
      description: `Document: ${document.filename}`,
      text: document.content.slice(0, 2000),
      tags: this.extractTags(document.content),
      summary: this.generateSummary(document.content),
    };
  }

  private async analyzeImage(imagePath: string): Promise<VisionAnalysis> {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64 = imageBuffer.toString('base64');

      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.visionModel,
          prompt: `Perform detailed document analysis:
1. Extract ALL text visible in the image
2. Identify document type (form, screenshot, diagram, photo, etc.)
3. Describe the structure and key elements
4. Note any data, numbers, or specific information

Be thorough and precise.`,
          images: [base64],
          stream: false,
          options: { num_predict: 1500 },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return {
          description: data.response.slice(0, 200),
          text: data.response,
          tags: this.extractTags(data.response),
          summary: data.response.slice(0, 500),
        };
      }
    } catch (err) {
      return {
        description: `[Vision analysis failed: ${(err as Error).message}]`,
        text: '',
        tags: [],
        summary: '',
      };
    }

    return {
      description: '[Vision not available]',
      text: '',
      tags: [],
      summary: '',
    };
  }

  private extractTags(content: string): string[] {
    const tags = new Set<string>();
    const patterns = [
      /\b(API|REST|GraphQL|gRPC)\b/gi,
      /\b(database|SQL|MongoDB|PostgreSQL)\b/gi,
      /\b(AWS|Azure|GCP|cloud)\b/gi,
      /\b(auth|login|jwt|oauth)\b/gi,
      /\b(test|unit|integration|e2e)\b/gi,
      /\b(react|vue|angular|frontend)\b/gi,
      /\b(node|python|java|golang)\b/gi,
      /\b(deploy|docker|kubernetes|ci\/cd)\b/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(m => tags.add(m.toLowerCase()));
      }
    }

    return Array.from(tags).slice(0, 10);
  }

  private generateSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 5).join('. ').trim() + '.';
  }

  async generateEmbedding(content: string): Promise<number[]> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: content.slice(0, 4000),
        }),
      });

      if (response.ok) {
        const data = await response.json() as { embedding: number[] };
        return data.embedding;
      }
    } catch {}

    return this.fallbackEmbedding(content);
  }

  private fallbackEmbedding(content: string): number[] {
    const dim = 768;
    const words = content.toLowerCase().split(/\s+/);
    const embedding = new Array(dim).fill(0);

    for (let i = 0; i < dim; i++) {
      const wordIdx = i % Math.max(words.length, 1);
      const charSum = (words[wordIdx] || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      embedding[i] = Math.sin(charSum / (i + 1)) * Math.cos(i * 0.1);
    }

    return embedding;
  }

  getSupportedTypes(): string[] {
    return ['.pdf', '.txt', '.md', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`);
      if (response.ok) {
        const data = await response.json() as { models: { name: string }[] };
        const hasGemma = data.models.some(m => m.name.includes('gemma'));
        const hasNomic = data.models.some(m => m.name.includes('nomic'));
        return hasGemma || hasNomic;
      }
    } catch {}
    return false;
  }
}

export const documentParser = new DocumentParser();
