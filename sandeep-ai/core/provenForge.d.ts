export interface ProvenanceMetadata {
    module: string;
    timestamp: string;
    confidence: number;
    parent?: string;
    version_diff?: string;
    branch?: string;
    tags?: string[];
}
export interface ForgeEvent {
    content: string;
    embedding?: number[];
    tags?: string[];
    branch?: string;
    [key: string]: any;
}
export interface VersionedMemory {
    version_id: string;
    parent_version_id: string | null;
    tier: string;
    provenance: ProvenanceMetadata;
    content: string;
    created_at: Date;
}
export interface VersionQueryOptions {
    tier?: 'raw' | 'episodic' | 'semantic';
    branch?: string;
    limit?: number;
    since?: Date;
    until?: Date;
    includeChildren?: boolean;
}
export declare class ProvenForge {
    /**
     * Forges a new versioned memory tier with strict provenance tracking.
     * O(1) amortized per event via lightweight scoring + metadata.
     */
    forge(event: ForgeEvent, sourceModule: string, parentVersionId?: string): Promise<{
        versionId: string;
        tier: string;
    }>;
    /**
     * Proposes a merge between two memory branches, validating security/diff constraints.
     * O(log v) with indexed chains where v = version count.
     */
    safeMerge(versionA: string, versionB: string, userApproval?: boolean): Promise<{
        status: string;
        requiresReview: boolean;
        mergedVersionId?: string;
        conflicts?: string[];
    }>;
    /**
     * Retrieve versioned memories with tier/branch filtering.
     * O(log n) with proper indexing on tier, branch, created_at.
     */
    retrieveBy(options?: VersionQueryOptions): Promise<VersionedMemory[]>;
    /**
     * Get latest version for a branch, useful for planner context injection.
     */
    getLatestForBranch(branch: string, tier?: string): Promise<VersionedMemory | null>;
    /**
     * Get version lineage (DAG traversal upward).
     */
    getLineage(versionId: string, maxDepth?: number): Promise<string[]>;
    /**
     * Get children versions (branch tips).
     */
    getChildren(versionId: string): Promise<string[]>;
    /**
     * Compute embedding diff between two versions using content similarity.
     */
    embeddingDiff(versionA: string, versionB: string): Promise<number>;
    /**
     * Compute provenance credibility score.
     * Lightweight heuristic: content length + tags + module trust.
     */
    computeProvenanceScore(event: any): Promise<number>;
    /**
     * Assign tier based on confidence and event characteristics.
     */
    assignTier(event: any, provenance: ProvenanceMetadata): string;
    /**
     * Propagate coding CLI outputs to longitudinal trackers.
     * Routes bug patterns, tech debt, and skill insights to relevant tools.
     */
    propagateVersionedToLongitudinal(versionId: string, event: ForgeEvent): Promise<void>;
    /**
     * Get provenance stats for dashboard/debugging.
     */
    getStats(): Promise<{
        totalVersions: number;
        byTier: Record<string, number>;
        byModule: Record<string, number>;
    }>;
    /**
     * Build version context string for planner injection.
     */
    buildVersionContext(branch?: string, tier?: string): Promise<string>;
}
export declare const provenForge: ProvenForge;
//# sourceMappingURL=provenForge.d.ts.map