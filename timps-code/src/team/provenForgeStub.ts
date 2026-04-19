// provenForgeStub.ts - Stub for ProvenForge (optional integration with sandeep-ai)
// This is a no-op stub that allows timps-code to compile without the sandeep-ai dependency

export interface ProvenanceMetadata {
  module: string;
  timestamp: string;
  confidence: number;
  parent?: string;
  branch?: string;
  tags?: string[];
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

export interface ProvenForgeStats {
  totalVersions: number;
  byTier: Record<string, number>;
  byModule: Record<string, number>;
}

export class ProvenForgeStub {
  async forge(event: any, sourceModule: string, parentVersionId?: string): Promise<{ versionId: string; tier: string }> {
    return { versionId: `stub-${Date.now()}`, tier: 'raw' };
  }

  async safeMerge(versionA: string, versionB: string, userApproval = false): Promise<{ status: string; requiresReview: boolean }> {
    return { status: 'conflict', requiresReview: true };
  }

  async retrieveBy(options: VersionQueryOptions = {}): Promise<VersionedMemory[]> {
    return [];
  }

  async getLatestForBranch(branch: string, tier?: string): Promise<VersionedMemory | null> {
    return null;
  }

  async getLineage(versionId: string, maxDepth?: number): Promise<string[]> {
    return [versionId];
  }

  async getChildren(versionId: string): Promise<string[]> {
    return [];
  }

  async getStats(): Promise<ProvenForgeStats> {
    return { totalVersions: 0, byTier: {}, byModule: {} };
  }

  async buildVersionContext(branch?: string, tier?: string): Promise<string> {
    return '';
  }
}

export const provenForge = new ProvenForgeStub();
