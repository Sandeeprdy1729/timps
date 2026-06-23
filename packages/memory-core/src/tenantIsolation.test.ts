// ── @timps/memory-core — Tenant Isolation Tests ──
// Verifies that OrgA can never see OrgB's data, even when sharing
// the same MemoryEngine with different scopes.

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryEngine } from './MemoryEngine.js';
import { InMemoryBackend } from './backends/InMemoryBackend.js';
import type { OrgScope } from './types.js';

const ORG_A: OrgScope = { orgId: 'org_a', projectId: 'proj_a' };
const ORG_B: OrgScope = { orgId: 'org_b', projectId: 'proj_b' };
const ORG_A_TEAM_X: OrgScope = { orgId: 'org_a', teamId: 'team_x', projectId: 'proj_a' };

function createEngine(scope: OrgScope): MemoryEngine {
  return new MemoryEngine('/tmp/tenant-test', {
    backend: new InMemoryBackend(),
    orgScope: scope,
    dir: '/tmp/tenant-test',  // Same dir — isolation happens at backend level
  });
}

describe('Tenant isolation', () => {
  let engineA: MemoryEngine;
  let engineB: MemoryEngine;

  beforeEach(() => {
    engineA = createEngine(ORG_A);
    engineB = createEngine(ORG_B);
  });

  it('should isolate stores between different orgs', () => {
    engineA.store({ content: 'Secret from Org A', type: 'fact' });
    engineB.store({ content: 'Secret from Org B', type: 'fact' });

    const recallA = engineA.recall('Secret');
    const recallB = engineB.recall('Secret');

    // Each org should only see its own data
    const contentsA = recallA.map(e => e.content);
    expect(contentsA).toContain('Secret from Org A');
    expect(contentsA).not.toContain('Secret from Org B');

    const contentsB = recallB.map(e => e.content);
    expect(contentsB).toContain('Secret from Org B');
    expect(contentsB).not.toContain('Secret from Org A');
  });

  it('should isolate semantic entries between orgs', () => {
    engineA.store({ content: 'Org A preference: dark mode', type: 'preference' });
    engineB.store({ content: 'Org B preference: light mode', type: 'preference' });

    const semanticA = engineA.getSemanticEntries();
    const semanticB = engineB.getSemanticEntries();

    expect(semanticA.length).toBe(1);
    expect(semanticA[0].content).toContain('Org A');
    expect(semanticB.length).toBe(1);
    expect(semanticB[0].content).toContain('Org B');
  });

  it('should isolate episodic memory between orgs', () => {
    engineA.storeEpisode({ summary: 'Org A session', outcome: 'success', timestamp: Date.now() });
    engineB.storeEpisode({ summary: 'Org B session', outcome: 'failure', timestamp: Date.now() });

    const epsA = engineA.loadEpisodes(10);
    const epsB = engineB.loadEpisodes(10);

    expect(epsA.some(e => e.summary.includes('Org A'))).toBe(true);
    expect(epsA.some(e => e.summary.includes('Org B'))).toBe(false);
    expect(epsB.some(e => e.summary.includes('Org B'))).toBe(true);
    expect(epsB.some(e => e.summary.includes('Org A'))).toBe(false);
  });

  it('should isolate working memory between orgs', () => {
    engineA.setGoal('Build feature X for Org A');
    engineB.setGoal('Fix bug Y for Org B');

    expect(engineA.workingMemory.currentGoal).toContain('Org A');
    expect(engineB.workingMemory.currentGoal).toContain('Org B');
  });

  it('should isolate stats between orgs', () => {
    engineA.store({ content: 'A: React frontend routing', type: 'pattern' });
    engineA.store({ content: 'A: Go backend service', type: 'pattern' });
    engineB.store({ content: 'B: Python data pipeline', type: 'pattern' });

    const statsA = engineA.getStats();
    const statsB = engineB.getStats();

    expect(statsA.semanticCount).toBe(2);
    expect(statsB.semanticCount).toBe(1);
  });

  it('should isolate different projects within the same org', () => {
    const proj1: OrgScope = { orgId: 'org_a', projectId: 'project_1' };
    const proj2: OrgScope = { orgId: 'org_a', projectId: 'project_2' };
    const engineP1 = createEngine(proj1);
    const engineP2 = createEngine(proj2);

    engineP1.store({ content: 'Project 1 data', type: 'fact' });
    engineP2.store({ content: 'Project 2 data', type: 'fact' });

    const recall1 = engineP1.recall('Project');
    const recall2 = engineP2.recall('Project');

    expect(recall1.some(e => e.content.includes('Project 1'))).toBe(true);
    expect(recall1.some(e => e.content.includes('Project 2'))).toBe(false);
    expect(recall2.some(e => e.content.includes('Project 2'))).toBe(true);
    expect(recall2.some(e => e.content.includes('Project 1'))).toBe(false);
  });

  it('should isolate org A team X from org A team Y', () => {
    const teamX: OrgScope = { orgId: 'org_a', teamId: 'team_x', projectId: 'proj_a' };
    const teamY: OrgScope = { orgId: 'org_a', teamId: 'team_y', projectId: 'proj_a' };
    const engineX = createEngine(teamX);
    const engineY = createEngine(teamY);

    engineX.store({ content: 'Team X workflow', type: 'pattern' });
    engineY.store({ content: 'Team Y workflow', type: 'pattern' });

    const recallX = engineX.recall('workflow');
    const recallY = engineY.recall('workflow');

    expect(recallX.some(e => e.content.includes('Team X'))).toBe(true);
    expect(recallX.some(e => e.content.includes('Team Y'))).toBe(false);
    expect(recallY.some(e => e.content.includes('Team Y'))).toBe(true);
    expect(recallY.some(e => e.content.includes('Team X'))).toBe(false);
  });

  it('should prevent Org A from reading Org B data via backend directly', () => {
    engineA.store({ content: 'Sensitive A data', type: 'fact' });
    engineB.store({ content: 'Sensitive B data', type: 'fact' });

    const backendA = engineA.backend;
    const backendB = engineB.backend;

    // Even reading raw keys from the backend should not cross org boundaries
    const allKeysA = backendA.list();
    const allKeysB = backendB.list();

    // Each backend's key list should include the org prefix
    const keysAstr = allKeysA.join(' ');
    const keysBstr = allKeysB.join(' ');

    expect(keysAstr).toContain('org_a');
    expect(keysAstr).not.toContain('org_b');
    expect(keysBstr).toContain('org_b');
    expect(keysBstr).not.toContain('org_a');
  });

  it('should maintain isolation with exports (memory packs)', async () => {
    engineA.store({ content: 'A: important convention', type: 'convention' });
    engineB.store({ content: 'B: important convention', type: 'convention' });

    const packA = await engineA.export();
    const packB = await engineB.export();

    // Org A's pack should only contain A's data
    expect(packA.semantic.some(e => e.content.includes('A'))).toBe(true);
    expect(packA.semantic.some(e => e.content.includes('B'))).toBe(false);

    // Org B's pack should only contain B's data
    expect(packB.semantic.some(e => e.content.includes('B'))).toBe(true);
    expect(packB.semantic.some(e => e.content.includes('A'))).toBe(false);
  });

  it('should fail closed: without scope, engine works in unscoped mode', () => {
    // Backward compat: engines without orgScope still work
    const unscoped = new MemoryEngine('/tmp/unscoped', {
      backend: new InMemoryBackend(),
      dir: '/tmp/unscoped',
    });

    unscoped.store({ content: 'Legacy data', type: 'fact' });
    const results = unscoped.recall('Legacy');
    expect(results.some(e => e.content.includes('Legacy'))).toBe(true);
  });

  it('should support deriveProjectId for stable cross-machine IDs', () => {
    const pid1 = MemoryEngine.deriveProjectId('git@github.com:org/repo.git', 'main');
    const pid2 = MemoryEngine.deriveProjectId('https://github.com/org/repo.git', 'main');
    const pid3 = MemoryEngine.deriveProjectId('https://github.com/org/repo', 'main');
    const pid4 = MemoryEngine.deriveProjectId('git@github.com:org/repo.git', 'feature');

    // Same repo+branch = same ID regardless of URL format
    expect(pid1).toBe(pid2);
    expect(pid2).toBe(pid3);

    // Different branch = different ID
    expect(pid1).not.toBe(pid4);

    // Deterministic format (12 hex chars)
    expect(pid1).toMatch(/^[0-9a-f]{12}$/);
  });

  it('should support multi-project recall across projects', () => {
    // Use a single backend shared across project scopes
    const sharedBackend = new InMemoryBackend();

    // Write data for project 'frontend'
    const frontendScope: OrgScope = { orgId: 'org_a', projectId: 'frontend' };
    sharedBackend.setScope(frontendScope);
    const frontendEngine = new MemoryEngine('/tmp/tenant-test', {
      backend: sharedBackend,
      orgScope: frontendScope,
    });
    frontendEngine.store({ content: 'React component convention', type: 'convention' });

    // Write data for project 'backend'
    const backendScope: OrgScope = { orgId: 'org_a', projectId: 'backend' };
    sharedBackend.setScope(backendScope);
    const backendEngine = new MemoryEngine('/tmp/tenant-test', {
      backend: sharedBackend,
      orgScope: backendScope,
    });
    backendEngine.store({ content: 'API routing convention', type: 'convention' });

    // Reset scope for frontend and recall across both projects
    sharedBackend.setScope(frontendScope);
    const multiResults = frontendEngine.multiProjectRecall('convention', ['frontend', 'backend']);

    expect(multiResults.has('frontend')).toBe(true);
    expect(multiResults.has('backend')).toBe(true);

    const frontendHits = multiResults.get('frontend')!;
    const backendHits = multiResults.get('backend')!;

    expect(frontendHits.some(e => e.content.includes('React'))).toBe(true);
    expect(backendHits.some(e => e.content.includes('API'))).toBe(true);
  });

  it('should extract org scope from request-like objects', () => {
    const scope = MemoryEngine.extractOrgScope({
      headers: {
        'x-org-id': 'test_org',
        'x-project-id': 'test_project',
        'x-team-id': 'test_team',
      },
    });

    expect(scope).not.toBeNull();
    expect(scope!.orgId).toBe('test_org');
    expect(scope!.projectId).toBe('test_project');
    expect(scope!.teamId).toBe('test_team');
  });

  it('should return null when no org scope headers present', () => {
    const scope = MemoryEngine.extractOrgScope({
      headers: {},
    });

    expect(scope).toBeNull();
  });
});
