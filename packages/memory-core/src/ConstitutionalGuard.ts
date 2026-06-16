// ── @timps/memory-core — L15: ConstitutionalGuard ──
// Prevents the agent from committing low-confidence, unsourced, or
// contradictory information to long-term memory. Acts as a gatekeeper
// that refuses to store when confidence is too low or provenance is missing.
// Inspired by the RMT lesson: no single source can promote to high-confidence memory.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Provenance, SourceKind } from './ProvenanceForge.js';

export interface GuardVerdict {
  allowed: boolean;
  reason: string;
  confidenceThreshold: number;
  actualConfidence: number;
}

export interface GuardConfig {
  minConfidenceForStore: number;
  minEvidenceCount: number;
  requireProvenance: boolean;
  maxContradictionsBeforeBlock: number;
}

const DEFAULT_CONFIG: GuardConfig = {
  minConfidenceForStore: 0.3,
  minEvidenceCount: 1,
  requireProvenance: true,
  maxContradictionsBeforeBlock: 3,
};

export class ConstitutionalGuard {
  private config: GuardConfig;
  private rejectionLog: string[] = [];

  constructor(private dir: string, config?: Partial<GuardConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(
    content: string,
    provenance: Provenance | null,
    contradictionCount: number,
  ): GuardVerdict {
    const confidence = provenance?.confidence ?? 0;
    const evidenceCount = provenance?.evidenceCount ?? 0;

    if (contradictionCount >= this.config.maxContradictionsBeforeBlock) {
      return {
        allowed: false,
        reason: `Memory has ${contradictionCount} contradictions (max ${this.config.maxContradictionsBeforeBlock})`,
        confidenceThreshold: this.config.minConfidenceForStore,
        actualConfidence: confidence,
      };
    }

    if (this.config.requireProvenance && !provenance) {
      this.rejectionLog.push(`BLOCKED: no provenance for "${content.slice(0, 80)}"`);
      return {
        allowed: false,
        reason: 'No provenance record — cannot verify source',
        confidenceThreshold: this.config.minConfidenceForStore,
        actualConfidence: 0,
      };
    }

    if (confidence < this.config.minConfidenceForStore) {
      this.rejectionLog.push(`BLOCKED: confidence ${confidence.toFixed(2)} < ${this.config.minConfidenceForStore} for "${content.slice(0, 80)}"`);
      return {
        allowed: false,
        reason: `Confidence ${confidence.toFixed(2)} below threshold ${this.config.minConfidenceForStore}`,
        confidenceThreshold: this.config.minConfidenceForStore,
        actualConfidence: confidence,
      };
    }

    if (evidenceCount < this.config.minEvidenceCount) {
      this.rejectionLog.push(`BLOCKED: evidence count ${evidenceCount} < ${this.config.minEvidenceCount} for "${content.slice(0, 80)}"`);
      return {
        allowed: false,
        reason: `Evidence count ${evidenceCount} below minimum ${this.config.minEvidenceCount}`,
        confidenceThreshold: this.config.minConfidenceForStore,
        actualConfidence: confidence,
      };
    }

    return {
      allowed: true,
      reason: 'Passed all constitutional checks',
      confidenceThreshold: this.config.minConfidenceForStore,
      actualConfidence: confidence,
    };
  }

  getRejectionLog(): string[] {
    return [...this.rejectionLog];
  }

  clearRejectionLog(): void {
    this.rejectionLog = [];
  }

  updateConfig(config: Partial<GuardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): GuardConfig {
    return { ...this.config };
  }
}
