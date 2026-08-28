// ── TIMPS Memory — Extended Types (supplementary) ──
// Core MemoryEntry is in src/config/types.ts

import type { MemoryEntry, MemoryVersion } from '../config/types.js';
export type { MemoryEntry, MemoryVersion };

export interface EpisodicMemory {
  timestamp: number;
  summary: string;
  filesChanged: string[];
  toolsUsed: string[];
  outcome: 'success' | 'partial' | 'failed';
  taskType?: string;
  complexity?: 'low' | 'medium' | 'high';
  userCorrected?: boolean;
  errorsEncountered?: number;
}

export interface WorkingMemory {
  currentGoal?: string;
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
  arousal?: number;
  valence?: number;
  cognitiveLoad?: number;
  taskStartTime?: number;
  toolsUsedSequence?: string[];
}

export interface ProceduralTrace {
  id: string;
  goal: string;
  taskType: string;
  steps: ProceduralStep[];
  successConditions: string[];
  outcome: 'success' | 'partial' | 'failed';
  timestamp: number;
  confidence: number;
  usageCount: number;
  lastUsed?: number;
}

export interface ProceduralStep {
  stepIndex: number;
  tool: string;
  args: Record<string, unknown>;
  decision?: string;
  result?: string;
}

export interface KnowledgeNode {
  id: string;
  entity: string;
  entityType: 'technology' | 'pattern' | 'person' | 'concept' | 'file' | 'concept';
  attributes: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeEdge {
  id: string;
  subject: string;
  relation: string;
  object: string;
  weight: number;
  timestamp: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface RetrievalResult {
  entry: MemoryEntry;
  score: number;
  sources: ('bm25' | 'vector' | 'graph' | 'episodic')[];
  layer: string;
  rank: number;
}

export interface ContextWindow {
  tokens: number;
  budget: number;
  entries: ContextEntry[];
}

export interface ContextEntry {
  entry: MemoryEntry;
  content: string;
  layer: string;
  confidence: number;
  tokens: number;
}

export interface MemoryDiff {
  entity: string;
  was: string;
  now: string;
  changedAt: number;
  trigger?: string;
}

export interface AffectiveState {
  arousal: number;
  valence: number;
  cognitiveLoad: number;
  sessionStart: number;
  samples: AffectiveSample[];
}

export interface AffectiveSample {
  timestamp: number;
  arousal: number;
  valence: number;
  cognitiveLoad: number;
  task?: string;
  toolsUsed?: string[];
}

export interface SelfReflectionResult {
  gaps: string[];
  contradictions: MemoryEntry[];
  lowConfidenceFlags: string[];
  questions: string[];
  newMemories: Partial<MemoryEntry>[];
}

export interface PredictionCandidate {
  episode: EpisodicMemory;
  similarity: number;
}

export interface MemoryLease {
  agentId: string;
  filePath: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface ConflictEntry {
  fact1: string;
  fact2: string;
  detectedAt: number;
  resolved: boolean;
  resolution?: string;
}