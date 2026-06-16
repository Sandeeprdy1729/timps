// ── @timps/memory-core — L22: ConfidenceCalibrator ──
// Calibrates confidence scores by combining multiple signals:
// semantic similarity, source reliability, evidence count, and freshness.
// Returns a calibrated score ∈ [0, 1] and a verbal confidence level.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CalibrationInput {
  similarity: number;
  reliability: number;
  evidence: number;
  freshness: number;
}

export interface CalibrationResult {
  score: number;
  level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  breakdown: {
    similarityContribution: number;
    reliabilityContribution: number;
    evidenceContribution: number;
    freshnessContribution: number;
  };
}

export interface CalibrationRecord {
  id: string;
  memoryId: string;
  input: CalibrationInput;
  result: CalibrationResult;
  calibratedAt: number;
}

export class ConfidenceCalibrator {
  private records: CalibrationRecord[] = [];
  private recordFile: string;

  constructor(private dir: string) {
    this.recordFile = path.join(dir, 'confidence-calibrations.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.recordFile)) {
        this.records = JSON.parse(fs.readFileSync(this.recordFile, 'utf-8'));
      }
    } catch { this.records = []; }
  }

  private save(): void {
    fs.writeFileSync(this.recordFile, JSON.stringify(this.records.slice(-500), null, 2), 'utf-8');
  }

  calibrate(input: CalibrationInput): CalibrationResult {
    const similarityContribution = input.similarity * 0.4;
    const reliabilityContribution = input.reliability * 0.35;
    const evidenceContribution = input.evidence * 0.15;
    const freshnessContribution = input.freshness * 0.1;

    const score = similarityContribution + reliabilityContribution + evidenceContribution + freshnessContribution;
    const clampedScore = Math.max(0, Math.min(1, score));

    const level: CalibrationResult['level'] =
      clampedScore < 0.2 ? 'very_low'
      : clampedScore < 0.4 ? 'low'
      : clampedScore < 0.6 ? 'medium'
      : clampedScore < 0.8 ? 'high'
      : 'very_high';

    return {
      score: clampedScore,
      level,
      breakdown: { similarityContribution, reliabilityContribution, evidenceContribution, freshnessContribution },
    };
  }

  record(memoryId: string, input: CalibrationInput): CalibrationResult {
    const result = this.calibrate(input);
    this.records.push({
      id: crypto.randomBytes(6).toString('hex'),
      memoryId,
      input,
      result,
      calibratedAt: Date.now(),
    });
    this.save();
    return result;
  }

  getHistory(memoryId: string): CalibrationRecord[] {
    return this.records.filter(r => r.memoryId === memoryId).slice(-20);
  }

  averageConfidence(): number {
    if (this.records.length === 0) return 0;
    const sum = this.records.reduce((acc, r) => acc + r.result.score, 0);
    return sum / this.records.length;
  }

  clearHistory(): void {
    this.records = [];
    this.save();
  }
}
