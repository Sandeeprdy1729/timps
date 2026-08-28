// ── Tool: Meeting Ghost — commitment extraction from meeting notes ──
// Deterministic regex + noun-phrase extraction. No LLM required.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

export interface Commitment {
  id: string;
  text: string;
  owner?: string;        // "@sandeep" or "Sandeep will..."  → "sandeep"
  deadline?: string;     // "by Friday", "next week"        → kept as-is
  meeting_title?: string;
  extracted_at: string;
  completed: boolean;
}

export interface ExtractionResult {
  commitments: Commitment[];
  meeting_title?: string;
  participants: string[];
}

const COMMITMENT_PATTERNS: RegExp[] = [
  /\bI(?:'ll| will| am going to| plan to)?\s+(?:also\s+)?([^.!?\n]{6,140})/gi,
  /\bwe(?:'ll| will| are going to| need to)?\s+(?:also\s+)?([^.!?\n]{6,140})/gi,
  /@(\w+)\s+(?:to|will|should|owns?|does|handles?)\s+([^.!?\n]{6,140})/gi,
  /\b(?:TODO|ACTION|AI)\s*[:\-]\s*([^\n]{6,140})/gi,
  /\b(\w+)\s+(?:to|will|should|owns?|does|handles?)\s+(?:the\s+)?([^.!?\n]{6,140})/gi,
];

const DEADLINE_PATTERNS: RegExp[] = [
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|end\s+of\s+(?:day|week|month|quarter|year)|eod|eow|next\s+week|next\s+month|tomorrow|tonight|q[1-4])(?:[,.!\s]|$)/i,
  /\bbefore\s+([^.!?\n]{3,40})/i,
  /\b(?:due|deadline)\s*[:\-]?\s*([^.!?\n]{3,40})/i,
  /\b(\d{4}-\d{2}-\d{2})\b/,
];

const PARTICIPANT_PATTERN = /(?:^|\s)@(\w+)/g;

function findDeadline(text: string): string | undefined {
  for (const p of DEADLINE_PATTERNS) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
}

function isLikelyCommitment(text: string): boolean {
  if (text.length < 6 || text.length > 200) return false;
  // Skip pure opinion / observation sentences
  const skipStarters = /^(?:i think|maybe|perhaps|we should consider|it seems|note that|also|interesting)/i;
  if (skipStarters.test(text.trim())) return false;
  // Need at least one verb-like word
  return /\b(?:will|should|own|handle|do|ship|fix|write|send|review|merge|deploy|build|test|add|update|finish|complete|create|design|implement|prep|prepare|schedule|call|email|ping|message)\b/i.test(text);
}

export class MeetingGhost {
  private file: string;
  private commitments: Commitment[] = [];
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'commitments.json');
    this.load();
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read(path.basename(this.file));
        if (data) {
          this.commitments = data.commitments || [];
        }
      } else if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.commitments = data.commitments || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    const data = { commitments: this.commitments };
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /** Extract commitments from meeting notes (deterministic regex-based). */
  extract(notes: string, meeting_title?: string): ExtractionResult {
    const participants = new Set<string>();
    let pm;
    while ((pm = PARTICIPANT_PATTERN.exec(notes)) !== null) participants.add(pm[1]);

    const found: Commitment[] = [];
    const seenText = new Set<string>();

    for (const pattern of COMMITMENT_PATTERNS) {
      // Reset regex state because we share patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(notes)) !== null) {
        const fullMatch = match[0];
        const captured = (match[1] || match[2] || '').trim();
        // Use the entire match if the captured group is the subject
        const text = (captured.length < 10 ? fullMatch : captured).trim();
        if (!isLikelyCommitment(text)) continue;
        if (seenText.has(text.toLowerCase())) continue;
        seenText.add(text.toLowerCase());

        const owner = match[0].match(/^@?(\w+)\s+(?:to|will|should|owns?)/i)?.[1];
        const deadline = findDeadline(text);
        found.push({
          id: `c_${Date.now().toString(36)}_${found.length}_${Math.random().toString(36).slice(2, 5)}`,
          text: text.replace(/\s+/g, ' ').trim(),
          owner: owner?.toLowerCase(),
          deadline,
          meeting_title,
          extracted_at: new Date().toISOString(),
          completed: false,
        });
      }
    }

    this.commitments.push(...found);
    this.save();
    return { commitments: found, meeting_title, participants: Array.from(participants) };
  }

  /** List all pending (not completed) commitments. */
  getPending(): Commitment[] {
    return this.commitments.filter(c => !c.completed);
  }

  /** Mark a commitment as completed (id prefix match supported). */
  complete(idPrefix: string): Commitment | null {
    const c = this.commitments.find(x => x.id.startsWith(idPrefix));
    if (!c) return null;
    c.completed = true;
    this.save();
    return c;
  }
}
