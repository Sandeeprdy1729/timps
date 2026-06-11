// governTier.ts - Policy-Driven Agent-Native Governance Engine
// Decoupled governance layer for adaptive lifecycle management

import { pool } from '../db/postgres';
import { getVectorClient, upsertVectors, searchVectors } from '../db/vector';
import { config } from '../config/env';

export type GovernanceTier = 'raw' | 'episodic' | 'semantic' | 'wisdom';
export type PolicyType = 'decay' | 'conflict' | 'privacy' | 'admission' | 'evolution';

export interface GovernancePolicy {
  id?: number;
  name: string;
  policy_type: PolicyType;
  config: Record<string, any>;
  version: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface GovernanceEvent {
  id?: number;
  source_module: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  provenance?: string;
  user_id?: number;
  project_id?: string;
  event_type: string;
  created_at?: Date;
}

export interface GovernedMemory {
  id?: number;
  event_id: number;
  tier: GovernanceTier;
  governance_score: number;
  policy_version: number;
  resolved_conflicts?: any;
  decay_applied?: boolean;
  privacy_masked?: boolean;
  admission_status: 'admitted' | 'decayed' | 'flagged' | 'rejected';
  linked_insights?: any;
  created_at?: Date;
  updated_at?: Date;
}

export interface PolicyScore {
  relevance: number;
  utility: number;
  novelty: number;
  maturity: number;
  recency: number;
  total: number;
}

const DEFAULT_POLICIES: GovernancePolicy[] = [
  { name: 'default_admission', policy_type: 'admission', config: { admit_threshold: 0.5 }, version: 1 },
  { name: 'default_decay', policy_type: 'decay', config: { decay_threshold: 0.4, decay_rate: 0.1 }, version: 1 },
  { name: 'default_conflict', policy_type: 'conflict', config: { conflict_similarity_threshold: 0.85, merge_on_conflict: true }, version: 1 },
  { name: 'default_privacy', policy_type: 'privacy', config: { sensitive_keywords: ['password', 'secret', 'api_key', 'token', 'credential'] }, version: 1 },
];

export class GovernTier {
  private policies: Map<string, GovernancePolicy> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled && process.env.ENABLE_GOVERNTIER !== 'false';
    this.loadPolicies();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async loadPolicies(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT * FROM governance_policies ORDER BY version DESC
      `);
      
      if (result.rows.length > 0) {
        for (const row of result.rows) {
          this.policies.set(row.name, row);
        }
      } else {
        for (const policy of DEFAULT_POLICIES) {
          this.policies.set(policy.name, policy);
          await this.upsertPolicy(policy);
        }
      }
    } catch {
      for (const policy of DEFAULT_POLICIES) {
        this.policies.set(policy.name, policy);
      }
    }
  }

  async upsertPolicy(policy: GovernancePolicy): Promise<void> {
    await pool.query(`
      INSERT INTO governance_policies (name, policy_type, config, version)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO UPDATE SET
        config = EXCLUDED.config,
        version = EXCLUDED.version,
        updated_at = CURRENT_TIMESTAMP
    `, [policy.name, policy.policy_type, JSON.stringify(policy.config), policy.version]);
  }

  async computePolicyScore(event: GovernanceEvent): Promise<PolicyScore> {
    const admission = this.policies.get('default_admission');
    const decay = this.policies.get('default_decay');
    
    const baseScore = 0.5;
    let novelty = 0.2;
    let maturity = 0.1;
    
    if (event.metadata?.importance) {
      maturity = Math.min(event.metadata.importance / 5, 1) * 0.3;
    }
    
    if (event.metadata?.retrieval_count) {
      novelty = Math.max(0, 0.3 - (event.metadata.retrieval_count * 0.02));
    }
    
    const relevance = event.metadata?.relevance_score || baseScore;
    const utility = event.metadata?.utility_score || baseScore;
    
    const ageHours = event.created_at 
      ? (Date.now() - new Date(event.created_at).getTime()) / 3600000 
      : 0;
    const recency = Math.max(0, 1 - (ageHours / (24 * 30)));
    
    const total = (relevance * 0.35) + (utility * 0.25) + (novelty * 0.15) + (maturity * 0.15) + (recency * 0.1);
    
    return {
      relevance,
      utility,
      novelty,
      maturity,
      recency,
      total: Math.min(Math.max(total, 0), 1),
    };
  }

  assignTier(event: GovernanceEvent, score: PolicyScore): GovernanceTier {
    const tierConfig = event.metadata?.tier_config;
    if (tierConfig) return tierConfig;

    if (score.total >= 0.8) return 'wisdom';
    if (score.total >= 0.6) return 'semantic';
    if (score.total >= 0.4) return 'episodic';
    return 'raw';
  }

  async detectConflicts(event: GovernanceEvent): Promise<GovernanceEvent[]> {
    if (!event.embedding || event.embedding.length === 0) return [];
    
    const conflictPolicy = this.policies.get('default_conflict');
    const threshold = conflictPolicy?.config?.conflict_similarity_threshold || 0.85;
    
    try {
      const results = await searchVectors(event.embedding, 5, {
        must: [
          { key: 'source_module', match: { value: event.source_module } },
        ],
      });
      
      const conflicts: GovernanceEvent[] = [];
      for (const result of results) {
        if (result.payload.governance && result.payload.tier !== 'raw') {
          conflicts.push(result.payload as GovernanceEvent);
        }
      }
      
      return conflicts;
    } catch {
      return [];
    }
  }

  async resolveConflicts(
    event: GovernanceEvent, 
    conflicts: GovernanceEvent[]
  ): Promise<{ resolved: GovernanceEvent; merged: boolean; conflicts_resolved: any[] }> {
    const conflictPolicy = this.policies.get('default_conflict');
    const shouldMerge = conflictPolicy?.config?.merge_on_conflict ?? true;
    
    const resolved = { ...event };
    const conflictsResolved: any[] = [];
    
    if (shouldMerge && conflicts.length > 0) {
      const latestConflict = conflicts[0];
      conflictsResolved.push({
        original_id: latestConflict.id,
        merge_type: 'content_merge',
        timestamp: new Date().toISOString(),
      });
      
      resolved.metadata = {
        ...resolved.metadata,
        merged_from: conflicts.map(c => c.id),
        resolved_at: new Date().toISOString(),
      };
    }
    
    return {
      resolved,
      merged: shouldMerge && conflicts.length > 0,
      conflicts_resolved: conflictsResolved,
    };
  }

  async applyPrivacy(event: GovernanceEvent): Promise<GovernanceEvent> {
    const privacyPolicy = this.policies.get('default_privacy');
    const sensitiveKeywords = privacyPolicy?.config?.sensitive_keywords || [];
    
    let masked = false;
    let content = event.content;
    
    for (const keyword of sensitiveKeywords) {
      const regex = new RegExp(`(${keyword}[=:]\\s*)([^\\s,]+)`, 'gi');
      if (regex.test(content)) {
        content = content.replace(regex, '$1[REDACTED]');
        masked = true;
      }
    }
    
    return {
      ...event,
      content,
      metadata: {
        ...event.metadata,
        privacy_masked: masked,
      },
    };
  }

  applyDecay(event: GovernanceEvent, sourceModule: string): GovernedMemory {
    const decay = this.policies.get('default_decay');
    const threshold = decay?.config?.decay_threshold || 0.4;
    
    const admissionPolicy = this.policies.get('default_admission');
    const admissionThreshold = admissionPolicy?.config?.admit_threshold || 0.5;
    
    return {
      event_id: event.id || 0,
      tier: 'raw',
      governance_score: threshold,
      policy_version: this.getLatestPolicyVersion(),
      admission_status: 'decayed',
      decay_applied: true,
    };
  }

  private getLatestPolicyVersion(): number {
    let maxVersion = 0;
    for (const policy of this.policies.values()) {
      if (policy.version > maxVersion) maxVersion = policy.version;
    }
    return maxVersion;
  }

  async enforce(event: GovernanceEvent, sourceModule: string): Promise<GovernedMemory> {
    if (!this.enabled) {
      return {
        event_id: event.id || 0,
        tier: 'episodic',
        governance_score: 0.5,
        policy_version: 0,
        admission_status: 'admitted',
      };
    }

    const score = await this.computePolicyScore(event);
    const admission = this.policies.get('default_admission');
    
    if (score.total < (admission?.config?.admit_threshold || 0.5)) {
      const decay = this.applyDecay(event, sourceModule);
      await this.storeGovernedMemory(event, decay);
      return decay;
    }

    const tier = this.assignTier(event, score);
    const conflicts = await this.detectConflicts(event);
    let resolvedEvent = event;
    let resolvedConflicts: any[] = [];
    
    if (conflicts.length > 0) {
      const result = await this.resolveConflicts(event, conflicts);
      resolvedEvent = result.resolved;
      resolvedConflicts = result.conflicts_resolved;
    }

    resolvedEvent = await this.applyPrivacy(resolvedEvent);
    
    const governedMemory: GovernedMemory = {
      event_id: event.id || 0,
      tier,
      governance_score: score.total,
      policy_version: this.getLatestPolicyVersion(),
      resolved_conflicts: resolvedConflicts.length > 0 ? resolvedConflicts : undefined,
      admission_status: 'admitted',
      linked_insights: this.extractCodingInsights(sourceModule, resolvedEvent),
    };
    
    await this.storeGovernedMemory(resolvedEvent, governedMemory);
    
    if (sourceModule.includes('code') || sourceModule.includes('cli')) {
      await this.propagateToLongitudinal(resolvedEvent, governedMemory);
    }
    
    return governedMemory;
  }

  private extractCodingInsights(sourceModule: string, event: GovernanceEvent): any | undefined {
    if (!sourceModule.includes('code') && !sourceModule.includes('cli')) {
      return undefined;
    }
    
    const insights: any = {};
    
    if (event.metadata?.tech_debt) {
      insights.techDebtPattern = event.metadata.tech_debt;
    }
    if (event.metadata?.bug_pattern) {
      insights.bugPattern = event.metadata.bug_pattern;
    }
    if (event.metadata?.skill_trail) {
      insights.skillTrail = event.metadata.skill_trail;
    }
    
    return Object.keys(insights).length > 0 ? insights : undefined;
  }

  async propagateToLongitudinal(event: GovernanceEvent, memory: GovernedMemory): Promise<void> {
    if (!memory.linked_insights) return;
    
    try {
      if (memory.linked_insights.techDebtPattern) {
        await pool.query(`
          INSERT INTO tech_debt_incidents (user_id, incident_type, description, severity, linked_memory_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          event.user_id,
          'governance_detected',
          memory.linked_insights.techDebtPattern,
          memory.tier === 'wisdom' ? 'low' : memory.tier === 'semantic' ? 'medium' : 'high',
          memory.id,
        ]);
      }
      
      if (memory.linked_insights.bugPattern) {
        await pool.query(`
          INSERT INTO bug_patterns (user_id, pattern_description, frequency, linked_memory_id)
          VALUES ($1, $2, $3, $4)
        `, [
          event.user_id,
          memory.linked_insights.bugPattern,
          1,
          memory.id,
        ]);
      }
    } catch {
      // Tables may not exist yet, ignore
    }
  }

  private async storeGovernedMemory(event: GovernanceEvent, memory: GovernedMemory): Promise<void> {
    await pool.query(`
      INSERT INTO governed_memories (
        event_id, tier, governance_score, policy_version, 
        resolved_conflicts, decay_applied, privacy_masked, 
        admission_status, linked_insights, user_id, project_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      memory.event_id,
      memory.tier,
      memory.governance_score,
      memory.policy_version,
      memory.resolved_conflicts ? JSON.stringify(memory.resolved_conflicts) : null,
      memory.decay_applied || false,
      event.metadata?.privacy_masked || false,
      memory.admission_status,
      memory.linked_insights ? JSON.stringify(memory.linked_insights) : null,
      event.user_id,
      event.project_id,
    ]);
    
    if (event.embedding && event.embedding.length > 0) {
      await upsertVectors([{
        id: `governed_${event.id}_${Date.now()}`,
        vector: event.embedding,
        payload: {
          ...event,
          tier: memory.tier,
          governance_score: memory.governance_score,
          governance: true,
        },
      }]);
    }
  }

  async evolvePolicies(): Promise<void> {
    try {
      const outcomes = await pool.query(`
        SELECT tier, admission_status, governance_score, COUNT(*) as count
        FROM governed_memories
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        GROUP BY tier, admission_status, governance_score
      `);
      
      let version = this.getLatestPolicyVersion();
      
      for (const row of outcomes.rows) {
        if (row.admission_status === 'admitted' && row.tier === 'raw') {
          const admission = this.policies.get('default_admission');
          if (admission) {
            const current = admission.config.admit_threshold;
            admission.config.admit_threshold = Math.min(0.9, current + 0.02);
            admission.version = ++version;
            this.policies.set('default_admission', admission);
            await this.upsertPolicy(admission);
          }
        }
      }
    } catch {
      // Evolution failed, keep current policies
    }
  }

  async getGovernanceStats(): Promise<{
    totalGoverned: number;
    byTier: Record<GovernanceTier, number>;
    byStatus: Record<string, number>;
    conflictsResolved: number;
  }> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          tier,
          admission_status,
          COALESCE(jsonb_array_length(resolved_conflicts), 0) as conflict_count
        FROM governed_memories
        GROUP BY tier, admission_status
      `);
      
      const stats = {
        totalGoverned: 0,
        byTier: { raw: 0, episodic: 0, semantic: 0, wisdom: 0 } as Record<GovernanceTier, number>,
        byStatus: {} as Record<string, number>,
        conflictsResolved: 0,
      };
      
      for (const row of result.rows) {
        stats.totalGoverned += parseInt(row.total);
        stats.byTier[row.tier as GovernanceTier] += parseInt(row.total);
        stats.byStatus[row.admission_status] = (stats.byStatus[row.admission_status] || 0) + parseInt(row.total);
        stats.conflictsResolved += parseInt(row.conflict_count);
      }
      
      return stats;
    } catch {
      return {
        totalGoverned: 0,
        byTier: { raw: 0, episodic: 0, semantic: 0, wisdom: 0 },
        byStatus: {},
        conflictsResolved: 0,
      };
    }
  }
}

export const governTier = new GovernTier();
