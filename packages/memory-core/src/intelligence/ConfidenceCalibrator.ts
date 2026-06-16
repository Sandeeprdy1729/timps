// ── Tool 19: ConfidenceCalibrator (intelligence tool) ──
// Re-calibrates confidence using retrieval score, source reliability,
// corroboration count, and freshness. Thin wrapper around the L22 layer.

import type { CalibrationInput, CalibrationResult } from '../ConfidenceCalibrator.js';
import { ConfidenceCalibrator as L22ConfidenceCalibrator } from '../ConfidenceCalibrator.js';

export { CalibrationInput, CalibrationResult };

export class ConfidenceCalibratorTool {
  private impl: L22ConfidenceCalibrator;

  constructor(dir: string) {
    this.impl = new L22ConfidenceCalibrator(dir);
  }

  calibrate(scores: CalibrationInput): CalibrationResult {
    return this.impl.calibrate(scores);
  }

  record(memoryId: string, input: CalibrationInput): CalibrationResult {
    return this.impl.record(memoryId, input);
  }
}
