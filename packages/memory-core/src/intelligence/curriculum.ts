// ── Tool: Curriculum Architect — personalized learning plans from retention data ──
// Identifies topics you keep asking about but haven't stored solid decisions on.

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LearningGap {
  topic: string;
  mentions: number;        // how often you've asked about it
  stored_decisions: number; // how many decisions you've actually made on it
  gap_score: number;        // mentions / max(1, decisions) — high = you keep asking but never decide
  suggested_next_step: string;
}

export interface Curriculum {
  gaps: LearningGap[];
  generated_at: string;
  topics_analyzed: number;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
  'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'and', 'or', 'but', 'not',
  'no', 'yes', 'on', 'in', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'if', 'so',
  'what', 'how', 'why', 'when', 'where', 'which', 'who', 'whom',
]);

function extractTopics(text: string, minLen = 4): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= minLen && !STOP_WORDS.has(w));
}

function frequencyMap(texts: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of texts) {
    for (const w of extractTopics(t)) m.set(w, (m.get(w) || 0) + 1);
  }
  return m;
}

export class CurriculumArchitect {
  private file: string;
  private questions: string[] = [];
  private decisions: string[] = [];

  constructor(dir: string) {
    this.file = path.join(dir, 'curriculum_log.json');
    this.load();
  }

  private load(): void {
    // Read the contradiction positions (which often come from questions) and regrets
    const files: { name: string; key: string }[] = [
      { name: 'positions.json', key: 'positions' },
      { name: 'decisions.json', key: 'decisions' },
      { name: 'curriculum_log.json', key: 'curriculum_log' },
    ];
    for (const { name, key } of files) {
      const full = path.join(path.dirname(this.file), name);
      if (!fs.existsSync(full)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
        if (key === 'positions' && Array.isArray(data.positions)) {
          for (const p of data.positions) if (p.claim) this.decisions.push(p.claim);
        }
        if (key === 'decisions' && Array.isArray(data.decisions)) {
          for (const d of data.decisions) if (d.decision) this.decisions.push(d.decision);
        }
        if (key === 'curriculum_log' && Array.isArray(data.questions)) {
          for (const q of data.questions) this.questions.push(q);
        }
      } catch { /* ignore */ }
    }
  }

  /** Log a question you asked (so the system can detect what you keep asking about). */
  logQuestion(q: string): void {
    this.questions.push(q);
    fs.writeFileSync(this.file, JSON.stringify({ questions: this.questions.slice(-500) }, null, 2), 'utf-8');
  }

  /** Generate a learning plan based on what you keep asking about vs what you've decided. */
  plan(): Curriculum {
    const qFreq = frequencyMap(this.questions);
    const dFreq = frequencyMap(this.decisions);
    const topics = new Set<string>([...qFreq.keys(), ...dFreq.keys()]);
    const gaps: LearningGap[] = [];
    for (const topic of topics) {
      const mentions = qFreq.get(topic) || 0;
      const stored = dFreq.get(topic) || 0;
      // Heuristic: a "gap" is something you ask about more than you decide
      if (mentions >= 2 && stored < mentions) {
        gaps.push({
          topic,
          mentions,
          stored_decisions: stored,
          gap_score: Math.round((mentions / Math.max(1, stored)) * 10) / 10,
          suggested_next_step: stored === 0
            ? `You keep asking about "${topic}" but have never made a decision. Time to either learn it or commit to a default.`
            : `You've made ${stored} decision(s) about "${topic}" but keep asking. Document the trade-offs once and link them.`,
        });
      }
    }
    return {
      gaps: gaps.sort((a, b) => b.gap_score - a.gap_score).slice(0, 10),
      generated_at: new Date().toISOString(),
      topics_analyzed: topics.size,
    };
  }
}
