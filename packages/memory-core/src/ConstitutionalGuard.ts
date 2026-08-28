// ── @timps/memory-core — L15: ConstitutionalGuard ──
// Prevents the agent from committing low-confidence, unsourced, or
// contradictory information to long-term memory. Acts as a gatekeeper
// that refuses to store when confidence is too low or provenance is missing.
// Inspired by the RMT lesson: no single source can promote to high-confidence memory.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Provenance, SourceKind } from './ProvenanceForge.js';
import type { StorageBackend } from './backends/types.js';

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
  /**
   * NEW — per-source-kind evidence floor. Some source kinds are inherently
   * less trustworthy on their own and need more corroboration before a write
   * is allowed, regardless of stated confidence. Falls back to
   * minEvidenceCount for any sourceKind not listed here.
   *
   * Values chosen from eval ground truth (data/write-time-trust-gating-v2.json):
   * single_source_web required evidenceCount>=2 to be accepted;
   * cross_project_claim required evidenceCount>=3.
   */
  minEvidenceCountBySource: Partial<Record<SourceKind, number>>;
}

const DEFAULT_CONFIG: GuardConfig = {
  minConfidenceForStore: 0.3,
  minEvidenceCount: 1,
  requireProvenance: true,
  maxContradictionsBeforeBlock: 3,
  minEvidenceCountBySource: {
    web_search: 2,
    cross_project: 3,
  },
};

export class ConstitutionalGuard {
  private _backend?: StorageBackend;
  private config: GuardConfig;
  private rejectionLog: string[] = [];

  constructor(private dir: string, config?: Partial<GuardConfig>, backend?: StorageBackend) {
    this._backend = backend;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluate(
    content: string,
    provenance: Provenance | null,
    contradictionCount: number,
    chronosConflict?: { conflict: boolean; conflictsWithNodeId?: string; overlap?: number; existingReliability?: number },
  ): GuardVerdict {
    const confidence = provenance?.confidence ?? 0;
    const evidenceCount = provenance?.evidenceCount ?? 0;

    // NEW — L15 x ChronosForge wiring: if this write conflicts with an
    // already-established, more-reliable fact (per ChronosForge.checkConflict),
    // block regardless of the incoming confidence score. This is the fix for
    // the eval-v1 finding that stale/superseded facts pass the guard 0% of the time.
    if (chronosConflict?.conflict) {
      this.rejectionLog.push(`BLOCKED: conflicts with more-reliable existing fact (node ${chronosConflict.conflictsWithNodeId}, overlap ${chronosConflict.overlap?.toFixed(2)}) for "${content.slice(0, 80)}"`);
      return {
        allowed: false,
        reason: `Conflicts with an existing, more-reliable fact (overlap ${chronosConflict.overlap?.toFixed(2)}, existing reliability ${chronosConflict.existingReliability?.toFixed(2)})`,
        confidenceThreshold: this.config.minConfidenceForStore,
        actualConfidence: confidence,
      };
    }

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

    // NEW — use the source-kind-specific floor when one is set, falling back
    // to the flat minEvidenceCount otherwise.
    const evidenceFloor = (provenance?.sourceKind && this.config.minEvidenceCountBySource[provenance.sourceKind]) ?? this.config.minEvidenceCount;
    if (evidenceCount < evidenceFloor) {
      this.rejectionLog.push(`BLOCKED: evidence count ${evidenceCount} < ${evidenceFloor} (source-specific floor) for "${content.slice(0, 80)}"`);
      return {
        allowed: false,
        reason: `Evidence count ${evidenceCount} below minimum ${evidenceFloor} required for source kind "${provenance?.sourceKind ?? 'unknown'}"`,
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