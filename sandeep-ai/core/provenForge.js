"use strict";
// core/provenForge.ts - Provenance-Aware Agent-Native Forge with Git-style Versioned Tiering
//
// ProvenForge treats memory as evolvable, versioned knowledge with traceable provenance.
// Key operations:
//   - forge(): create versioned memory nodes with provenance metadata
//   - safeMerge(): merge branches with conflict detection
//   - retrieveBy*: tier/version-aware retrieval for planner/router integration
//   - propagateToLongitudinal(): route coding outputs to burnout/seismograph systems
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.provenForge = exports.ProvenForge = void 0;
const crypto = __importStar(require("crypto"));
const postgres_1 = require("../db/postgres");
const vector_1 = require("../db/vector");
class ProvenForge {
    /**
     * Forges a new versioned memory tier with strict provenance tracking.
     * O(1) amortized per event via lightweight scoring + metadata.
     */
    async forge(event, sourceModule, parentVersionId) {
        const confidence = await this.computeProvenanceScore(event);
        const branch = event.branch || sourceModule.split('-')[0] || 'main';
        const provenance = {
            module: sourceModule,
            timestamp: new Date().toISOString(),
            confidence,
            parent: parentVersionId,
            branch,
            tags: event.tags || [],
        };
        const versionId = crypto.randomUUID();
        const tier = this.assignTier(event, provenance);
        if (process.env.ENABLE_PROVENFORGE === 'false') {
            return { versionId, tier };
        }
        try {
            await (0, postgres_1.execute)(`INSERT INTO versioned_memories (version_id, parent_version_id, tier, provenance, content, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (version_id) DO NOTHING`, [versionId, parentVersionId || null, tier, JSON.stringify(provenance), event.content || JSON.stringify(event)]);
            if (parentVersionId) {
                await (0, postgres_1.execute)(`INSERT INTO provenance_edges (source_version_id, target_version_id, edge_type)
           VALUES ($1, $2, 'version_lineage')
           ON CONFLICT DO NOTHING`, [versionId, parentVersionId, 'version_lineage']);
            }
            if (event.embedding) {
                const payload = { ...event, version_id: versionId, provenance_metadata: provenance };
                delete payload.embedding;
                await (0, vector_1.upsertVectors)([{ id: versionId, vector: event.embedding, payload }]);
            }
            if (sourceModule.includes('code') || sourceModule.includes('cli') || sourceModule === 'timps-code') {
                await this.propagateVersionedToLongitudinal(versionId, event);
            }
        }
        catch (err) {
            console.warn('[ProvenForge] Failed to persist forged version:', err);
        }
        return { versionId, tier };
    }
    /**
     * Proposes a merge between two memory branches, validating security/diff constraints.
     * O(log v) with indexed chains where v = version count.
     */
    async safeMerge(versionA, versionB, userApproval = false) {
        const diffScore = await this.embeddingDiff(versionA, versionB);
        const conflicts = [];
        try {
            const [rowA, rowB] = await Promise.all([
                (0, postgres_1.query)('SELECT provenance FROM versioned_memories WHERE version_id = $1', [versionA]),
                (0, postgres_1.query)('SELECT provenance FROM versioned_memories WHERE version_id = $1', [versionB]),
            ]);
            if (rowA.length && rowB.length) {
                const provA = rowA[0].provenance;
                const provB = rowB[0].provenance;
                if (provA.branch && provB.branch && provA.branch !== provB.branch) {
                    conflicts.push(`Different branches: ${provA.branch} vs ${provB.branch}`);
                }
                if (Math.abs(provA.confidence - provB.confidence) > 0.5) {
                    conflicts.push(`Confidence mismatch: ${provA.confidence} vs ${provB.confidence}`);
                }
            }
        }
        catch { /* provenance check is best-effort */ }
        if ((diffScore > 0.25 || conflicts.length > 0) && !userApproval) {
            return { status: 'conflict', requiresReview: true, conflicts };
        }
        const mergedVersionId = crypto.randomUUID();
        try {
            await (0, postgres_1.execute)(`INSERT INTO versioned_memories (version_id, tier, provenance, content, created_at)
         VALUES ($1, 'semantic', $2, $3, CURRENT_TIMESTAMP)`, [mergedVersionId, JSON.stringify({ module: 'merge', parentA: versionA, parentB: versionB }), `Merged: ${versionA.slice(0, 8)} + ${versionB.slice(0, 8)}`]);
            await (0, postgres_1.execute)(`INSERT INTO provenance_edges (source_version_id, target_version_id, edge_type) VALUES ($1, $2, 'merged_from'), ($1, $3, 'merged_from')`, [mergedVersionId, versionA, versionB]);
        }
        catch (err) {
            console.warn('[ProvenForge] Merge error', err);
            return { status: 'error', requiresReview: true };
        }
        return { status: 'merged', requiresReview: false, mergedVersionId };
    }
    /**
     * Retrieve versioned memories with tier/branch filtering.
     * O(log n) with proper indexing on tier, branch, created_at.
     */
    async retrieveBy(options = {}) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;
        if (options.tier) {
            conditions.push(`tier = $${paramIdx++}`);
            params.push(options.tier);
        }
        if (options.branch) {
            conditions.push(`provenance->>'branch' = $${paramIdx++}`);
            params.push(options.branch);
        }
        if (options.since) {
            conditions.push(`created_at >= $${paramIdx++}`);
            params.push(options.since);
        }
        if (options.until) {
            conditions.push(`created_at <= $${paramIdx++}`);
            params.push(options.until);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = options.limit || 50;
        try {
            const result = await (0, postgres_1.query)(`SELECT version_id, parent_version_id, tier, provenance, content, created_at
         FROM versioned_memories ${whereClause}
         ORDER BY created_at DESC LIMIT $${paramIdx}`, [...params, limit]);
            return result;
        }
        catch {
            return [];
        }
    }
    /**
     * Get latest version for a branch, useful for planner context injection.
     */
    async getLatestForBranch(branch, tier) {
        const tierCondition = tier ? `AND tier = $2` : '';
        const params = tier ? [branch, tier] : [branch];
        try {
            const result = await (0, postgres_1.query)(`SELECT * FROM versioned_memories
         WHERE provenance->>'branch' = $1 ${tierCondition}
         ORDER BY created_at DESC LIMIT 1`, params);
            return result[0] || null;
        }
        catch {
            return null;
        }
    }
    /**
     * Get version lineage (DAG traversal upward).
     */
    async getLineage(versionId, maxDepth = 10) {
        const lineage = [versionId];
        let current = versionId;
        let depth = 0;
        try {
            while (depth < maxDepth) {
                const result = await (0, postgres_1.query)(`SELECT parent_version_id FROM versioned_memories WHERE version_id = $1`, [current]);
                if (!result[0]?.parent_version_id)
                    break;
                lineage.push(result[0].parent_version_id);
                current = result[0].parent_version_id;
                depth++;
            }
        }
        catch { /* best-effort */ }
        return lineage;
    }
    /**
     * Get children versions (branch tips).
     */
    async getChildren(versionId) {
        try {
            const result = await (0, postgres_1.query)(`SELECT source_version_id FROM provenance_edges WHERE target_version_id = $1`, [versionId]);
            return result.map(r => r.source_version_id);
        }
        catch {
            return [];
        }
    }
    /**
     * Compute embedding diff between two versions using content similarity.
     */
    async embeddingDiff(versionA, versionB) {
        try {
            const rows = await (0, postgres_1.query)(`SELECT content FROM versioned_memories WHERE version_id IN ($1, $2) ORDER BY created_at DESC LIMIT 2`, [versionA, versionB]);
            if (rows.length >= 2) {
                const textA = rows[0].content || '';
                const textB = rows[1].content || '';
                const wordsA = textA.toLowerCase().split(/\s+/);
                const wordsB = textB.toLowerCase().split(/\s+/);
                const setA = new Set(wordsA);
                const setB = new Set(wordsB);
                const intersection = [...setA].filter(x => setB.has(x)).length;
                const union = new Set([...setA, ...setB]).size;
                return union > 0 ? 1 - intersection / union : 0.1;
            }
        }
        catch { /* fallback */ }
        return 0.1;
    }
    /**
     * Compute provenance credibility score.
     * Lightweight heuristic: content length + tags + module trust.
     */
    async computeProvenanceScore(event) {
        let score = 0.3;
        if (event.content && event.content.length > 50)
            score += 0.2;
        if (event.content && event.content.length > 200)
            score += 0.1;
        if (event.tags && event.tags.length > 0)
            score += 0.1;
        if (event.module && !event.module.includes('unknown'))
            score += 0.1;
        const codingModules = ['timps-code', 'tech-debt', 'bug-pattern', 'codebase'];
        if (codingModules.some(m => event.module?.includes(m)))
            score += 0.1;
        return Math.min(score, 1.0);
    }
    /**
     * Assign tier based on confidence and event characteristics.
     */
    assignTier(event, provenance) {
        if (provenance.confidence > 0.8)
            return 'semantic';
        if (provenance.confidence > 0.4)
            return 'episodic';
        return 'raw';
    }
    /**
     * Propagate coding CLI outputs to longitudinal trackers.
     * Routes bug patterns, tech debt, and skill insights to relevant tools.
     */
    async propagateVersionedToLongitudinal(versionId, event) {
        try {
            const content = (event.content || '').toLowerCase();
            const tags = (event.tags || []).map(t => t.toLowerCase());
            if (tags.some(t => ['bug', 'error', 'crash', 'incident'].includes(t)) || content.includes('bug') || content.includes('error')) {
                await (0, postgres_1.execute)(`INSERT INTO bug_patterns (user_id, bug_type, trigger_context, recorded_at)
           VALUES (1, $1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT DO NOTHING`, ['detected', event.content?.slice(0, 200)]);
            }
            if (tags.some(t => ['tech-debt', 'refactor', 'debt'].includes(t)) || content.includes('debt') || content.includes('refactor')) {
                await (0, postgres_1.execute)(`INSERT INTO code_incidents (user_id, pattern, incident_type, recorded_at)
           VALUES (1, $1, 'tech-debt', CURRENT_TIMESTAMP)`, [event.content?.slice(0, 200)]);
            }
            if (tags.some(t => ['skill', 'workflow', 'pattern'].includes(t)) || content.includes('pattern')) {
                await (0, postgres_1.execute)(`INSERT INTO workflow_patterns (user_id, pattern_type, description, recorded_at)
           VALUES (1, 'detected', $1, CURRENT_TIMESTAMP)`, [event.content?.slice(0, 200)]);
            }
        }
        catch { /* best-effort propagation */ }
    }
    /**
     * Get provenance stats for dashboard/debugging.
     */
    async getStats() {
        try {
            const total = await (0, postgres_1.query)('SELECT COUNT(*) as count FROM versioned_memories');
            const byTier = await (0, postgres_1.query)('SELECT tier, COUNT(*) as count FROM versioned_memories GROUP BY tier');
            const byModule = await (0, postgres_1.query)(`SELECT provenance->>'module' as module, COUNT(*) as count FROM versioned_memories GROUP BY module ORDER BY count DESC LIMIT 10`);
            return {
                totalVersions: parseInt(total[0]?.count || '0'),
                byTier: Object.fromEntries(byTier.map(r => [r.tier, parseInt(r.count)])),
                byModule: Object.fromEntries(byModule.map(r => [r.module, parseInt(r.count)])),
            };
        }
        catch {
            return { totalVersions: 0, byTier: {}, byModule: {} };
        }
    }
    /**
     * Build version context string for planner injection.
     */
    async buildVersionContext(branch, tier) {
        const latest = await this.getLatestForBranch(branch || 'main', tier);
        if (!latest)
            return '';
        const lineage = await this.getLineage(latest.version_id, 5);
        const lineageStr = lineage.length > 1
            ? `Lineage: ${lineage.map(v => v.slice(0, 8)).join(' → ')}`
            : '';
        return `[ProvenForge] Branch: ${branch || 'main'}, Tier: ${latest.tier}, Version: ${latest.version_id.slice(0, 8)}\n${lineageStr}\nLatest: ${latest.content?.slice(0, 200) || '(no content)'}`;
    }
}
exports.ProvenForge = ProvenForge;
exports.provenForge = new ProvenForge();
//# sourceMappingURL=provenForge.js.map