// ── @timps/memory-core — Phase 4c: ContentCompressor ──
// Lossy compression for medium-value memories.
// Shortens verbose content while preserving semantic meaning for embedding.
// Embedding is always kept — only the content text is compressed.

import type { CompressionResult } from './types.js';

interface CompressorOptions {
  /** Maximum content length after compression */
  maxLength: number;
  /** Whether to keep error messages and stack traces fully */
  preserveErrors: boolean;
  /** Whether to keep file paths */
  preserveFilePaths: boolean;
}

const DEFAULT_OPTIONS: CompressorOptions = {
  maxLength: 200,
  preserveErrors: true,
  preserveFilePaths: false,
};

export class ContentCompressor {
  private options: CompressorOptions;

  constructor(options?: Partial<CompressorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Compress a single memory entry's content.
   * Returns both original and compressed for auditability.
   */
  compress(content: string): CompressionResult {
    if (content.length <= this.options.maxLength) {
      return {
        originalContent: content,
        compressedContent: content,
        compressionRatio: 1,
        embeddingKept: true,
      };
    }

    const compressed = this._compressContent(content);
    const ratio = compressed.length > 0 ? content.length / compressed.length : 1;

    return {
      originalContent: content,
      compressedContent: compressed,
      compressionRatio: Math.round(ratio * 10) / 10,
      embeddingKept: true,
    };
  }

  /**
   * Bulk compress multiple entries, returning a map of id -> result.
   */
  compressMany(entries: Array<{ id: string; content: string }>): Map<string, CompressionResult> {
    const results = new Map<string, CompressionResult>();
    for (const entry of entries) {
      results.set(entry.id, this.compress(entry.content));
    }
    return results;
  }

  /**
   * Core compression algorithm:
   * 1. Keep first sentence (problem/context)
   * 2. Extract key entities
   * 3. Drop verbose details (unless preserveErrors keeps stack traces)
   * 4. Reconstruct as concise summary
   */
  private _compressContent(content: string): string {
    let text = content;

    // Preserve error messages if configured
    if (this.options.preserveErrors) {
      const errorMatch = content.match(/(Error|Exception|Failure|Failed):\s*.{5,200}/i);
      if (errorMatch && this._shouldKeepError(errorMatch[0])) {
        return errorMatch[0].slice(0, this.options.maxLength);
      }
    }

    // Try to extract the first substantive sentence
    const sentences = text.split(/(?<=[.!?])\s+/);
    const firstSentence = sentences[0]?.trim() ?? '';
    const entityNames = this._extractEntities(text);

    // Build compressed version: first sentence + key entities
    const parts: string[] = [];

    if (firstSentence.length > 10) {
      parts.push(firstSentence);
    }

    if (entityNames.length > 0 && entityNames.some(e => !firstSentence.includes(e))) {
      const entitiesStr = entityNames.slice(0, 3).join(', ');
      parts.push(`Related: ${entitiesStr}`);
    }

    let result = parts.join('. ');

    // Still too long? Take first sentence only, truncated
    if (result.length > this.options.maxLength) {
      result = firstSentence.slice(0, this.options.maxLength);
    }

    // Still too long? Hard truncate at maxLength
    if (result.length > this.options.maxLength) {
      result = result.slice(0, this.options.maxLength - 3) + '...';
    }

    // If compression didn't help, return first 200 chars
    if (result.length < 10 && content.length > 10) {
      result = content.slice(0, this.options.maxLength);
    }

    return result;
  }

  /**
   * Extract entities (camelCase, PascalCase, UPPER_CASE words, file paths).
   */
  private _extractEntities(content: string): string[] {
    const entities = new Set<string>();

    // PascalCase and camelCase identifiers
    const identifierMatches = content.match(/[A-Z][a-z]+[A-Z][a-zA-Z]*/g);
    if (identifierMatches) identifierMatches.forEach(e => entities.add(e));

    // UPPER_CASE identifiers
    const upperMatches = content.match(/[A-Z]{2,}(?:_[A-Z]{2,})+/g);
    if (upperMatches) upperMatches.forEach(e => entities.add(e));

    // File paths (simple patterns)
    if (this.options.preserveFilePaths) {
      const pathMatches = content.match(/[\w\-./]+\.\w{2,4}/g);
      if (pathMatches) pathMatches.forEach(e => entities.add(e));
    }

    return [...entities];
  }

  /**
   * Determine if an error message is worth preserving in full.
   */
  private _shouldKeepError(errorText: string): boolean {
    // Keep errors that have descriptive content
    return errorText.length > 20 && errorText.length < 300;
  }
}
