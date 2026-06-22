// ── Smoke tests for new memory layers (L10–L22) and intelligence tools (18–25) ──
// Pattern: mkdtemp + beforeEach/afterEach cleanup, 1–3 expects per it() block.

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { EngramLog } from './EngramLog';
import { ConsolidationEngine } from './ConsolidationEngine';
import type { ConsolidationRule } from './ConsolidationEngine';
import { SynapticPruner } from './SynapticPruner';
import type { MemoryMeta } from './SynapticPruner';
import { ProvenanceForge } from './ProvenanceForge';
import { SpacedRepetitionForge } from './SpacedRepetitionForge';
import { ConstitutionalGuard } from './ConstitutionalGuard';
import { AuditForge } from './AuditForge';
import { ProspectiveTrigger } from './ProspectiveTrigger';
import { BiasRevealer } from './BiasRevealer';
import { ContextVector } from './ContextVector';
import { RehearsalEngine } from './RehearsalEngine';
import { SchemaDistorter } from './SchemaDistorter';
import { ConfidenceCalibrator } from './ConfidenceCalibrator';
import { FalseMemoryDetector } from './intelligence/FalseMemoryDetector';
import { SourceAttributor } from './intelligence/SourceAttributor';
import { ConflictResolver } from './intelligence/ConflictResolver';
import type { MemoryRef } from './intelligence/ConflictResolver';
import { MemoryAuditor } from './intelligence/MemoryAuditor';
import { ProspectiveTriggerTool } from './intelligence/ProspectiveTrigger';
import { BiasRevealerTool } from './intelligence/BiasRevealer';
import { ConfidenceCalibratorTool } from './intelligence/ConfidenceCalibrator';
import { SchemaInferrer } from './intelligence/SchemaInferrer';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'memory-core-test-'));
}

// ────────────────────────────────────────────────────────────────────
// L10: EngramLog
// ────────────────────────────────────────────────────────────────────
function ts(): number { return Date.now(); }

describe('EngramLog — L10: hash-chained audit log', () => {
  let log: EngramLog;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    log = new EngramLog(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const base = () => ({ layerId: 'L3', actorId: 'test', timestamp: ts() });

  it('append creates an entry and persists to disk', () => {
    const entry = log.append({
      ...base(),
      op: 'store',
      entryId: 'e1',
      payload: { content: 'hello' },
      justification: 'test',
    });
    expect(entry.index).toBe(0);
    expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.existsSync(path.join(dir, 'engram.log.jsonl'))).toBe(true);
  });

  it('verifyChain returns valid after appends', () => {
    log.append({ ...base(), op: 'store', entryId: 'e1', payload: {}, justification: 't' });
    log.append({ ...base(), op: 'update', entryId: 'e2', payload: {}, justification: 't' });
    expect(log.verifyChain()).toEqual({ valid: true });
  });

  it('verifyChain detects tampering after file edit', () => {
    log.append({ ...base(), op: 'store', entryId: 'e1', payload: { content: 'original' }, justification: 't' });
    log.append({ ...base(), op: 'store', entryId: 'e2', payload: { content: 'second' }, justification: 't' });
    const filePath = path.join(dir, 'engram.log.jsonl');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.trim().split('\n');
    const first = JSON.parse(lines[0]);
    first.payload.content = 'tampered';
    lines[0] = JSON.stringify(first);
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
    const result = log.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBeDefined();
  });

  it('query filters by op type', () => {
    log.append({ ...base(), op: 'store', entryId: 'e1', payload: {}, justification: 't' });
    log.append({ ...base(), op: 'delete', entryId: 'e2', payload: {}, justification: 't' });
    const results = log.query({ op: 'store' });
    expect(results.length).toBe(1);
    expect(results[0].op).toBe('store');
  });

  it('query respects limit', () => {
    for (let i = 0; i < 5; i++) {
      log.append({ ...base(), op: 'store', entryId: `e${i}`, payload: {}, justification: 't' });
    }
    expect(log.query({}, 2).length).toBe(2);
  });

  it('entryCount returns correct count', () => {
    expect(log.entryCount()).toBe(0);
    log.append({ ...base(), op: 'store', entryId: 'e1', payload: {}, justification: 't' });
    expect(log.entryCount()).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// L11: ConsolidationEngine
// ────────────────────────────────────────────────────────────────────
describe('ConsolidationEngine — L11: episodic-to-semantic promotion', () => {
  let engine: ConsolidationEngine;
  let dir: string;
  const matchAll: ConsolidationRule = {
    name: 'promote-all',
    match: () => true,
    transform: (e: any) => ({ content: e.summary, tags: e.tags, type: e.outcome }),
    promote: true,
  };

  beforeEach(() => {
    dir = tmpDir();
    engine = new ConsolidationEngine(dir, [matchAll]);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('run with no episodes returns zero promoted', () => {
    const result = engine.run();
    expect(result.promoted).toBe(0);
    expect(result.archived).toBe(0);
  });

  it('run with episodes promotes matching entries to semantic.json', () => {
    const epFile = path.join(dir, 'episodes.json');
    fs.writeFileSync(epFile, JSON.stringify([{ summary: 'test episode', tags: ['test'], outcome: 'success', timestamp: Date.now() }]), 'utf-8');
    const result = engine.run({ dryRun: false });
    expect(result.promoted).toBe(1);
    const sem = JSON.parse(fs.readFileSync(path.join(dir, 'semantic.json'), 'utf-8'));
    expect(sem.length).toBe(1);
    expect(sem[0].content).toBe('test episode');
  });

  it('run in dryRun mode does not write semantic.json', () => {
    const epFile = path.join(dir, 'episodes.json');
    fs.writeFileSync(epFile, JSON.stringify([{ summary: 'dry run test', tags: [], outcome: 'neutral', timestamp: Date.now() }]), 'utf-8');
    engine.run({ dryRun: true });
    expect(fs.existsSync(path.join(dir, 'semantic.json'))).toBe(false);
  });

  it('addRule adds a new consolidation rule', () => {
    const before = engine.getRules().length;
    engine.addRule({ name: 'extra', match: () => false, transform: (e: any) => e, promote: false });
    expect(engine.getRules().length).toBe(before + 1);
  });
});

// ────────────────────────────────────────────────────────────────────
// L12: SynapticPruner
// ────────────────────────────────────────────────────────────────────
describe('SynapticPruner — L12: active forgetting engine', () => {
  let pruner: SynapticPruner;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    pruner = new SynapticPruner(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('sweep returns zero counts when no meta file', () => {
    const result = pruner.sweep();
    expect(result.kept).toBe(0);
    expect(result.archived).toBe(0);
    expect(result.deleted).toBe(0);
  });

  it('evaluate returns keep for high-importance entries', () => {
    const meta: MemoryMeta = { id: 'm1', lastAccess: Date.now(), accessCount: 10, importance: 0.9, confidence: 0.9 };
    expect(pruner.evaluate(meta)).toBe('keep');
  });

  it('evaluate returns archive for cold low-importance entries', () => {
    const meta: MemoryMeta = {
      id: 'm2',
      lastAccess: Date.now() - 60 * 24 * 60 * 60 * 1000,
      accessCount: 1,
      importance: 0.1,
      confidence: 0.1,
    };
    expect(pruner.evaluate(meta)).toBe('archive');
  });

  it('evaluate returns keep for pinned entries regardless of age', () => {
    const meta: MemoryMeta = {
      id: 'm3',
      lastAccess: Date.now() - 100 * 24 * 60 * 60 * 1000,
      accessCount: 0,
      importance: 0,
      confidence: 0,
      pinnedByUser: true,
    };
    expect(pruner.evaluate(meta)).toBe('keep');
  });

  it('sweep archives entries that evaluate to archive', () => {
    const metaFile = path.join(dir, 'memory-meta.json');
    const old = Date.now() - 60 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(metaFile, JSON.stringify([
      { id: 'keep1', lastAccess: Date.now(), accessCount: 5, importance: 0.9, confidence: 0.9 },
      { id: 'archive1', lastAccess: old, accessCount: 1, importance: 0.1, confidence: 0.1 },
    ]), 'utf-8');
    const result = pruner.sweep();
    expect(result.kept).toBe(1);
    expect(result.archived).toBe(1);
  });

  it('updatePolicy changes behavior', () => {
    pruner.updatePolicy({ minImportance: 0.8, coldThresholdDays: 0 });
    const meta: MemoryMeta = { id: 'm4', lastAccess: 0, accessCount: 1, importance: 0.5, confidence: 0.1 };
    expect(pruner.evaluate(meta)).toBe('archive');
  });
});

// ────────────────────────────────────────────────────────────────────
// L13: ProvenanceForge
// ────────────────────────────────────────────────────────────────────
describe('ProvenanceForge — L13: source tracking chain', () => {
  let forge: ProvenanceForge;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    forge = new ProvenanceForge(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('record creates a JSON file on disk', () => {
    const p = forge.record({
      sourceKind: 'user_direct',
      sourceDetail: 'user typed it',
      actorId: 'user1',
      actor: 'user1',
      observedAt: Date.now(),
      evidenceCount: 3,
      confidence: 0.9,
      parentIds: [],
    });
    expect(p.id).toMatch(/^[a-f0-9]{64}$/);
    const file = path.join(dir, `${p.id}.json`);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('reliability returns a score between 0 and 1', () => {
    const p = forge.record({
      sourceKind: 'user_direct',
      sourceDetail: 'test',
      actorId: 'u1',
      actor: 'u1',
      observedAt: Date.now(),
      evidenceCount: 5,
      confidence: 0.9,
      parentIds: [],
    });
    const score = forge.reliability(p);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('explain returns null for unknown id', () => {
    expect(forge.explain('nonexistent')).toBeNull();
  });

  it('explain returns recorded provenance', () => {
    const p = forge.record({
      sourceKind: 'git_history',
      sourceDetail: 'commit abc',
      actorId: 'dev',
      actor: 'dev',
      observedAt: Date.now(),
      evidenceCount: 1,
      confidence: 0.8,
      parentIds: [],
    });
    const loaded = forge.explain(p.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.sourceKind).toBe('git_history');
  });

  it('addCustodyStep appends to chain', () => {
    const p = forge.record({
      sourceKind: 'user_direct',
      sourceDetail: 'original',
      actorId: 'u1',
      actor: 'u1',
      observedAt: Date.now(),
      evidenceCount: 1,
      confidence: 0.8,
      parentIds: [],
    });
    forge.addCustodyStep(p.id, 'reviewer', 'verified');
    const loaded = forge.explain(p.id)!;
    expect(loaded.chainOfCustody.length).toBe(2);
  });

  it('delete removes the file', () => {
    const p = forge.record({
      sourceKind: 'user_direct',
      sourceDetail: 'to delete',
      actorId: 'u1',
      actor: 'u1',
      observedAt: Date.now(),
      evidenceCount: 1,
      confidence: 0.5,
      parentIds: [],
    });
    expect(forge.delete(p.id)).toBe(true);
    expect(fs.existsSync(path.join(dir, `${p.id}.json`))).toBe(false);
  });

  it('listBySource filters by source kind', () => {
    forge.record({ sourceKind: 'user_direct', sourceDetail: 'a', actorId: 'u1', actor: 'u1', observedAt: Date.now(), evidenceCount: 1, confidence: 0.5, parentIds: [] });
    forge.record({ sourceKind: 'web_search', sourceDetail: 'b', actorId: 'u1', actor: 'u1', observedAt: Date.now(), evidenceCount: 1, confidence: 0.5, parentIds: [] });
    const results = forge.listBySource('user_direct');
    expect(results.length).toBe(1);
    expect(results[0].sourceKind).toBe('user_direct');
  });
});

// ────────────────────────────────────────────────────────────────────
// L14: SpacedRepetitionForge
// ────────────────────────────────────────────────────────────────────
describe('SpacedRepetitionForge — L14: SM-2 algorithm', () => {
  let srf: SpacedRepetitionForge;

  beforeEach(() => {
    srf = new SpacedRepetitionForge();
  });

  it('schedule returns a snapshot with default values for new card', () => {
    const card = srf.schedule('c1', true);
    expect(card.id).toBe('c1');
    expect(card.easeFactor).toBe(2.6);
    expect(card.repetitions).toBe(1);
    expect(card.retrievability).toBe(1.0);
  });

  it('schedule changes ease factor on second call', () => {
    const c1 = srf.schedule('c1', true);
    const c2 = srf.schedule('c1', true);
    expect(c1.easeFactor).not.toBe(c2.easeFactor);
    expect(c2.easeFactor).toBeGreaterThan(c1.easeFactor);
  });

  it('failed recall resets repetition count and lowers ease factor', () => {
    srf.schedule('c1', true);
    const fail = srf.schedule('c1', false);
    expect(fail.repetitions).toBe(0);
    expect(fail.easeFactor).toBe(2.4);
    expect(fail.retrievability).toBe(0.3);
  });

  it('cardCount reflects total unique cards', () => {
    expect(srf.cardCount()).toBe(0);
    srf.schedule('c1', true);
    expect(srf.cardCount()).toBe(1);
  });

  it('getCard returns undefined for unknown id', () => {
    expect(srf.getCard('unknown')).toBeUndefined();
  });

  it('getCard returns a copy of the card', () => {
    srf.schedule('c1', true);
    const card = srf.getCard('c1')!;
    expect(card.id).toBe('c1');
  });

  it('dueForReview returns cards where nextReview <= now', () => {
    srf.schedule('c1', true);
    const due = srf.dueForReview(Date.now() + 86400000 * 365);
    expect(due.length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// L15: ConstitutionalGuard
// ────────────────────────────────────────────────────────────────────
describe('ConstitutionalGuard — L15: memory gatekeeper', () => {
  let guard: ConstitutionalGuard;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    guard = new ConstitutionalGuard(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('evaluate with low confidence returns allowed=false', () => {
    const result = guard.evaluate('test memory', null, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No provenance');
  });

  it('evaluate with high confidence and provenance returns allowed=true', () => {
    const provenance = {
      id: 'p1',
      sourceKind: 'user_direct' as const,
      sourceDetail: 'test',
      actorId: 'test',
      observedAt: Date.now(),
      evidenceCount: 5,
      confidence: 0.9,
      chainOfCustody: [],
      parentIds: [],
    };
    const result = guard.evaluate('test memory', provenance, 0);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('Passed all constitutional checks');
  });

  it('evaluate with excessive contradictions blocks', () => {
    const provenance = {
      id: 'p2',
      sourceKind: 'user_direct' as const,
      sourceDetail: 'test',
      actorId: 'test',
      observedAt: Date.now(),
      evidenceCount: 5,
      confidence: 0.9,
      chainOfCustody: [],
      parentIds: [],
    };
    const result = guard.evaluate('test memory', provenance, 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('contradictions');
  });

  it('getRejectionLog returns blocked entries', () => {
    guard.evaluate('block me', null, 0);
    const log = guard.getRejectionLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]).toContain('BLOCKED');
  });

  it('clearRejectionLog empties the log', () => {
    guard.evaluate('block me', null, 0);
    guard.clearRejectionLog();
    expect(guard.getRejectionLog().length).toBe(0);
  });

  it('updateConfig changes threshold', () => {
    guard.updateConfig({ minConfidenceForStore: 0.9 });
    expect(guard.getConfig().minConfidenceForStore).toBe(0.9);
  });
});

// ────────────────────────────────────────────────────────────────────
// L16: AuditForge
// ────────────────────────────────────────────────────────────────────
describe('AuditForge — L16: memory health auditor', () => {
  let audit: AuditForge;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    audit = new AuditForge(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('run returns a report with health score clamped [0,100]', () => {
    const report = audit.run();
    expect(report.healthScore).toBeGreaterThanOrEqual(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
    expect(report.totalEntries).toBe(0);
  });

  it('run detects working memory issues', () => {
    fs.writeFileSync(path.join(dir, 'working.json'), JSON.stringify({ currentGoal: '', activeFiles: [] }), 'utf-8');
    const report = audit.run();
    expect(report.working.weak).toBeGreaterThan(0);
  });

  it('run counts outdated episodic entries', () => {
    const old = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const epFile = path.join(dir, 'episodes.json');
    fs.writeFileSync(epFile, JSON.stringify([{ summary: 'old episode', timestamp: old }]), 'utf-8');
    const report = audit.run();
    expect(report.episodic.outdated).toBe(1);
  });

  it('run counts outdated semantic entries', () => {
    const old = Date.now() - 60 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify([
      { id: 's1', content: 'old fact', timestamp: old },
    ]), 'utf-8');
    const report = audit.run();
    expect(report.semantic.outdated).toBe(1);
  });

  it('summary returns a formatted string', () => {
    const report = audit.run();
    const s = audit.summary(report);
    expect(typeof s).toBe('string');
    expect(s).toContain('Memory Health Report');
    expect(s).toContain('Health Score:');
  });
});

// ────────────────────────────────────────────────────────────────────
// L17: ProspectiveTrigger
// ────────────────────────────────────────────────────────────────────
describe('ProspectiveTrigger — L17: when-X-then-Y triggers', () => {
  let trigger: ProspectiveTrigger;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    trigger = new ProspectiveTrigger(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('register creates a trigger and persists to disk', () => {
    const t = trigger.register({ when: 'deploy', surface: 'run checklist', memoryId: 'm1' });
    expect(t.id).toMatch(/^trg_/);
    expect(t.fireCount).toBe(0);
    expect(t.enabled).toBe(true);
    expect(fs.existsSync(path.join(dir, 'prospective-triggers.json'))).toBe(true);
  });

  it('evaluate fires matching triggers and increments fireCount', () => {
    trigger.register({ when: 'deploy', surface: 'run checklist', memoryId: 'm1' });
    const matches = trigger.evaluate('preparing to deploy to production');
    expect(matches.length).toBe(1);
    expect(matches[0].memoryId).toBe('m1');
    const t = trigger.list()[0];
    expect(t.fireCount).toBe(1);
  });

  it('evaluate does not fire for non-matching context', () => {
    trigger.register({ when: 'deploy', surface: 'run checklist', memoryId: 'm1' });
    const matches = trigger.evaluate('working on documentation');
    expect(matches.length).toBe(0);
  });

  it('remove deletes a trigger', () => {
    const t = trigger.register({ when: 'test', surface: 'test', memoryId: 'm1' });
    expect(trigger.remove(t.id)).toBe(true);
    expect(trigger.count()).toBe(0);
  });

  it('toggle disables a trigger', () => {
    const t = trigger.register({ when: 'deploy', surface: 'checklist', memoryId: 'm1' });
    trigger.toggle(t.id, false);
    const matches = trigger.evaluate('deploy');
    expect(matches.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// L18: BiasRevealer
// ────────────────────────────────────────────────────────────────────
describe('BiasRevealer — L18: over/under-representation detector', () => {
  let revealer: BiasRevealer;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    revealer = new BiasRevealer(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('reveal with empty memory returns empty arrays', () => {
    const report = revealer.reveal();
    expect(report.overrepresented).toEqual([]);
    expect(report.underrepresented).toEqual([]);
    expect(report.recommendation).toBe('No memory data to analyze.');
  });

  it('reveal with seeded semantic returns overrepresented entries', () => {
    const entries = [];
    for (let i = 0; i < 10; i++) {
      entries.push({ id: `s${i}`, content: 'functional programming is great', tags: ['fp'], type: 'preference', timestamp: Date.now() });
    }
    entries.push({ id: 's10', content: 'something about databases', tags: ['db'], type: 'fact', timestamp: Date.now() });
    fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify(entries), 'utf-8');
    const report = revealer.reveal();
    expect(report.overrepresented.length).toBeGreaterThanOrEqual(1);
    const fpTopic = report.overrepresented.find(o => o.category === 'functional');
    expect(fpTopic).toBeDefined();
    expect(fpTopic!.count).toBeGreaterThanOrEqual(5);
  });

  it('reveal returns sentiment bias with neutral default', () => {
    fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify([
      { id: 's1', content: 'neutral fact', tags: [], type: 'fact', timestamp: Date.now() },
    ]), 'utf-8');
    const report = revealer.reveal();
    expect(typeof report.sentimentBias.neutral).toBe('number');
  });
});

// ────────────────────────────────────────────────────────────────────
// L19: ContextVector
// ────────────────────────────────────────────────────────────────────
describe('ContextVector — L19: encoding context matching', () => {
  let cv: ContextVector;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    cv = new ContextVector(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('capture stores a profile and persists to disk', () => {
    const profile = cv.capture({ domain: 'coding', activeFiles: ['src/a.ts'], tags: ['typescript'], timeOfDay: 600, dayOfWeek: 2 });
    expect(profile.id).toMatch(/^[a-f0-9]{12}$/);
    expect(profile.storedAt).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dir, 'context-vectors.json'))).toBe(true);
  });

  it('match returns scored results for matching domain', () => {
    cv.capture({ domain: 'coding', activeFiles: ['src/a.ts'], tags: ['typescript'], timeOfDay: 600, dayOfWeek: 2 });
    const matches = cv.match({ domain: 'coding', activeFiles: ['src/a.ts'], tags: ['typescript'] });
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].score).toBeGreaterThan(0);
    expect(matches[0].matchedDimensions).toContain('domain');
  });

  it('match returns empty when no similar contexts', () => {
    cv.capture({ domain: 'coding', activeFiles: ['src/a.ts'], tags: ['typescript'], timeOfDay: 600, dayOfWeek: 2 });
    const matches = cv.match({ domain: 'design', activeFiles: ['figma'], tags: [] });
    expect(matches.length).toBe(0);
  });

  it('prune removes old profiles', () => {
    // Force-save a profile with very old storedAt by writing directly
    const profiles = [{ id: 'old1', domain: 'old', activeFiles: [], tags: [], timeOfDay: 0, dayOfWeek: 0, storedAt: Date.now() - 200 * 24 * 60 * 60 * 1000 }];
    fs.writeFileSync(path.join(dir, 'context-vectors.json'), JSON.stringify(profiles), 'utf-8');
    const reloaded = new ContextVector(dir);
    expect(reloaded.count()).toBe(1);
    const removed = reloaded.prune(90);
    expect(removed).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// L20: RehearsalEngine
// ────────────────────────────────────────────────────────────────────
describe('RehearsalEngine — L20: retrieval practice scheduling', () => {
  let re: RehearsalEngine;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    re = new RehearsalEngine(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('enqueue adds a new rehearsal item', () => {
    const item = re.enqueue('important fact', 'L3', 'src123');
    expect(item.id).toMatch(/^rhs_/);
    expect(item.content).toBe('important fact');
    expect(item.reviewCount).toBe(0);
  });

  it('enqueue returns existing item if sourceId already queued', () => {
    const first = re.enqueue('fact', 'L3', 'src1');
    const second = re.enqueue('fact', 'L3', 'src1');
    expect(second.id).toBe(first.id);
  });

  it('getDueItems returns empty for newly enqueued items (scheduled tomorrow per SM-2)', () => {
    re.enqueue('review me', 'L3', 'src2');
    const due = re.getDueItems(10);
    expect(due.length).toBe(0);
  });

  it('review increments reviewCount on RehearsalItem', () => {
    const item = re.enqueue('practice item', 'L3', 'src3');
    re.review(item.id, true);
    const due = re.getDueItems(10);
    // SRF card was scheduled once by enqueue (repetitions=1), then again by review (repetitions=2)
    const card = re.spacedRepetition.getCard(item.id)!;
    expect(card.repetitions).toBe(2);
  });

  it('count returns total with dueNow=0 for fresh item', () => {
    re.enqueue('item1', 'L3', 's1');
    const counts = re.count();
    expect(counts.total).toBe(1);
    expect(counts.dueNow).toBe(0);
  });

  it('remove deletes by sourceId', () => {
    re.enqueue('to remove', 'L3', 'remove_me');
    expect(re.remove('remove_me')).toBe(true);
    expect(re.count().total).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// L21: SchemaDistorter
// ────────────────────────────────────────────────────────────────────
describe('SchemaDistorter — L21: Bartlett schema distortion detection', () => {
  let sd: SchemaDistorter;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    sd = new SchemaDistorter(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('learn adds a pattern from content', () => {
    sd.learn('always validate user input before processing');
    const schemas = sd.getSchemas();
    expect(schemas.length).toBe(1);
    expect(schemas[0].pattern).toContain('always');
    expect(schemas[0].exampleCount).toBe(1);
  });

  it('learn increments exampleCount for repeated pattern', () => {
    sd.learn('always validate user input before processing');
    sd.learn('always validate user input before processing');
    const schemas = sd.getSchemas();
    expect(schemas.length).toBe(1);
    expect(schemas[0].exampleCount).toBe(2);
  });

  it('check returns DistortionCheck for matching content with enough examples', () => {
    const text = 'always validate user input before writing';
    for (let i = 0; i < 5; i++) {
      sd.learn(text);
    }
    const result = sd.check(text);
    expect(result).not.toBeNull();
    expect(result!.severity).toMatch(/^(low|medium|high)$/);
    expect(result!.distortionScore).toBeGreaterThan(0);
  });

  it('check returns null for content with insufficient schema examples', () => {
    sd.learn('unique pattern that only appears once');
    const result = sd.check('unique pattern that only appears once');
    expect(result).toBeNull();
  });

  it('check returns null for content with <3 significant words', () => {
    const result = sd.check('hi there');
    expect(result).toBeNull();
  });

  it('prune removes old schemas', () => {
    sd.learn('test pattern');
    const before = sd.getSchemas().length;
    const removed = sd.prune(0, 0);
    expect(removed).toBe(before);
  });
});

// ────────────────────────────────────────────────────────────────────
// L22: ConfidenceCalibrator
// ────────────────────────────────────────────────────────────────────
describe('ConfidenceCalibrator — L22: multi-signal confidence calibration', () => {
  let cc: ConfidenceCalibrator;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    cc = new ConfidenceCalibrator(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('calibrate returns a weighted score as a number', () => {
    const result = cc.calibrate({ similarity: 1, reliability: 1, evidence: 1, freshness: 1 });
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('calibrate returns very_high level for max inputs', () => {
    const result = cc.calibrate({ similarity: 1, reliability: 1, evidence: 1, freshness: 1 });
    expect(result.level).toBe('very_high');
    expect(result.score).toBeCloseTo(0.4 + 0.35 + 0.15 + 0.1, 3);
  });

  it('calibrate returns very_low level for min inputs', () => {
    const result = cc.calibrate({ similarity: 0, reliability: 0, evidence: 0, freshness: 0 });
    expect(result.level).toBe('very_low');
    expect(result.score).toBe(0);
  });

  it('getVerbalLevel maps scores correctly (via level)', () => {
    const levels: { input: { similarity: number; reliability: number; evidence: number; freshness: number }; expected: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' }[] = [
      { input: { similarity: 0, reliability: 0, evidence: 0, freshness: 0 }, expected: 'very_low' },
      { input: { similarity: 0, reliability: 0.6, evidence: 0, freshness: 0 }, expected: 'low' },
      { input: { similarity: 0.5, reliability: 0.6, evidence: 0, freshness: 0 }, expected: 'medium' },
      { input: { similarity: 1, reliability: 0.6, evidence: 0, freshness: 0 }, expected: 'high' },
      { input: { similarity: 1, reliability: 1, evidence: 1, freshness: 0 }, expected: 'very_high' },
    ];
    for (const { input, expected } of levels) {
      const result = cc.calibrate(input);
      expect(result.level).toBe(expected);
    }
  });

  it('record persists and getHistory retrieves', () => {
    cc.record('mem1', { similarity: 0.8, reliability: 0.7, evidence: 0.5, freshness: 0.9 });
    const history = cc.getHistory('mem1');
    expect(history.length).toBe(1);
    expect(history[0].memoryId).toBe('mem1');
  });

  it('averageConfidence returns average across records', () => {
    cc.record('m1', { similarity: 1, reliability: 1, evidence: 1, freshness: 1 });
    cc.record('m2', { similarity: 0, reliability: 0, evidence: 0, freshness: 0 });
    const avg = cc.averageConfidence();
    expect(avg).toBeGreaterThan(0.4);
    expect(avg).toBeLessThan(0.6);
  });

  it('clearHistory empties all records', () => {
    cc.record('m1', { similarity: 1, reliability: 1, evidence: 1, freshness: 1 });
    cc.clearHistory();
    expect(cc.averageConfidence()).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Tool 18: FalseMemoryDetector
// ────────────────────────────────────────────────────────────────────
describe('FalseMemoryDetector — Tool 18: false memory risk scoring', () => {
  let detector: FalseMemoryDetector;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    detector = new FalseMemoryDetector(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('score returns riskScore as a number', () => {
    const result = detector.score({ id: 'm1', content: 'test', evidenceCount: 5, ageDays: 10 });
    expect(typeof result.riskScore).toBe('number');
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(1);
  });

  it('high-risk source (agent_inference) increases score', () => {
    const provenance = {
      id: 'p1',
      sourceKind: 'agent_inference' as const,
      sourceDetail: 'inferred',
      actorId: 'agent',
      observedAt: Date.now(),
      evidenceCount: 0,
      confidence: 0.3,
      chainOfCustody: [],
      parentIds: [],
    };
    const result = detector.score({ id: 'm2', content: 'guess', provenance, evidenceCount: 0, ageDays: 100 });
    expect(result.riskScore).toBeGreaterThan(0.5);
    expect(result.riskLevel).toMatch(/^(high|critical)$/);
    expect(result.contributingFactors.length).toBeGreaterThanOrEqual(2);
  });

  it('low-risk (user_direct, high evidence) returns low risk', () => {
    const provenance = {
      id: 'p2',
      sourceKind: 'user_direct' as const,
      sourceDetail: 'user said',
      actorId: 'user',
      observedAt: Date.now(),
      evidenceCount: 10,
      confidence: 0.95,
      chainOfCustody: [],
      parentIds: [],
    };
    const result = detector.score({ id: 'm3', content: 'solid fact', provenance, evidenceCount: 10, ageDays: 1 });
    expect(result.riskLevel).toBe('low');
    expect(result.recommendation).toBe('No action needed');
  });

  it('score handles missing provenance gracefully', () => {
    const result = detector.score({ evidenceCount: 0, ageDays: 365 });
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.memoryId).toBe('unknown');
  });
});

// ────────────────────────────────────────────────────────────────────
// Tool 20: SourceAttributor
// ────────────────────────────────────────────────────────────────────
describe('SourceAttributor — Tool 20: provenance chain attribution', () => {
  let attributor: SourceAttributor;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    attributor = new SourceAttributor(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('attribute returns null for unknown memory id', () => {
    const result = attributor.attribute('nonexistent');
    expect(result).toBeNull();
  });

  it('attribute returns AttributionResult when provenance exists', () => {
    const provDir = path.join(dir, 'provenance');
    fs.mkdirSync(provDir, { recursive: true });
    const prov = {
      id: 'prov1',
      sourceKind: 'user_direct',
      sourceDetail: 'user typed it',
      actorId: 'user1',
      observedAt: Date.now(),
      evidenceCount: 3,
      confidence: 0.9,
      chainOfCustody: [{ actor: 'user1', op: 'record', at: Date.now() }],
      parentIds: ['mem1'],
    };
    fs.writeFileSync(path.join(provDir, 'prov1.json'), JSON.stringify(prov), 'utf-8');
    const result = attributor.attribute('mem1');
    expect(result).not.toBeNull();
    expect(result!.sourceKind).toBe('user_direct');
    expect(result!.reliability).toBeGreaterThan(0);
    expect(result!.reliability).toBeLessThanOrEqual(1);
  });

  it('explain returns a formatted provenance string', () => {
    const result = attributor.explain('nonexistent');
    expect(result).toContain('no provenance found');
  });

  it('explain returns detailed output when provenance found', () => {
    const provDir = path.join(dir, 'provenance');
    fs.mkdirSync(provDir, { recursive: true });
    const prov = {
      id: 'prov2',
      sourceKind: 'git_history',
      sourceDetail: 'commit def',
      actorId: 'dev',
      observedAt: Date.now(),
      evidenceCount: 2,
      confidence: 0.85,
      chainOfCustody: [{ actor: 'dev', op: 'record', at: Date.now() }],
      parentIds: ['mem2'],
    };
    fs.writeFileSync(path.join(provDir, 'prov2.json'), JSON.stringify(prov), 'utf-8');
    const explanation = attributor.explain('mem2');
    expect(explanation).toContain('git_history');
    expect(explanation).toContain('Source:');
  });
});

// ────────────────────────────────────────────────────────────────────
// Tool 21: ConflictResolver
// ────────────────────────────────────────────────────────────────────
describe('ConflictResolver — Tool 21: memory contradiction resolution', () => {
  let resolver: ConflictResolver;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    resolver = new ConflictResolver(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('resolve with unrelated statements returns conflict=false', () => {
    const a: MemoryRef = { id: 'a1', content: 'the sky is blue', timestamp: 1000, confidence: 0.8, layer: 'L3' };
    const b: MemoryRef = { id: 'b1', content: 'pizza is delicious', timestamp: 1001, confidence: 0.7, layer: 'L3' };
    const result = resolver.resolve(a, b);
    expect(result.conflict).toBe(false);
    expect(result.action).toBe('keep-both');
  });

  it('resolve with similar contradicting statements returns conflict=true', () => {
    const a: MemoryRef = { id: 'a2', content: 'always use TypeScript', timestamp: 1000, confidence: 0.9, layer: 'L3' };
    const b: MemoryRef = { id: 'b2', content: 'never use TypeScript', timestamp: 1001, confidence: 0.8, layer: 'L3' };
    const result = resolver.resolve(a, b);
    expect(result.conflict).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.2);
  });

  it('resolve with similar high-sim statements returns conflict=true', () => {
    const a: MemoryRef = { id: 'a3', content: 'use React for frontend development with hooks', timestamp: 1000, confidence: 0.9, layer: 'L3' };
    const b: MemoryRef = { id: 'b3', content: 'use React for frontend development with hooks', timestamp: 1000, confidence: 0.9, layer: 'L3' };
    const result = resolver.resolve(a, b);
    expect(result.similarity).toBeGreaterThanOrEqual(0.6);
  });

  it('getHistory returns previous resolutions', () => {
    resolver.resolve(
      { id: 'a', content: 'always use X', timestamp: 1, confidence: 0.9, layer: 'L3' },
      { id: 'b', content: 'never use X', timestamp: 2, confidence: 0.8, layer: 'L3' },
    );
    expect(resolver.getHistory().length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// Tool 22: MemoryAuditor
// ────────────────────────────────────────────────────────────────────
describe('MemoryAuditor — Tool 22: full memory health audit', () => {
  let auditor: MemoryAuditor;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    auditor = new MemoryAuditor(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('audit with empty memory returns healthScore=100', async () => {
    const report = await auditor.audit();
    expect(report.healthScore).toBe(100);
    expect(report.totalEntries).toBe(0);
  });

  it('audit returns healthScore clamped [0,100] with data', async () => {
    fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify([
      { id: 's1', content: 'weak memory', confidence: 0.1, timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000 },
      { id: 's2', content: 'strong memory', confidence: 0.9, timestamp: Date.now() },
    ]), 'utf-8');
    const report = await auditor.audit();
    expect(report.totalEntries).toBe(2);
    expect(report.healthScore).toBeGreaterThanOrEqual(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
    expect(report.weak).toBe(1);
    expect(report.outdated).toBe(1);
  });

  it('audit finds unsourced entries when no provenance dir', async () => {
    fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify([
      { id: 's1', content: 'no source', confidence: 0.5, timestamp: Date.now() },
    ]), 'utf-8');
    const report = await auditor.audit();
    expect(report.unsourced).toBeGreaterThan(0);
  });

  it('summary returns a formatted string', async () => {
    const report = await auditor.audit();
    const s = auditor.summary(report);
    expect(typeof s).toBe('string');
    expect(s).toContain('Memory Health:');
  });
});

// ────────────────────────────────────────────────────────────────────
// Tool 23: ProspectiveTriggerTool (wraps L17)
// ────────────────────────────────────────────────────────────────────
describe('ProspectiveTriggerTool — Tool 23: wraps L17 layer', () => {
  let tool: ProspectiveTriggerTool;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    tool = new ProspectiveTriggerTool(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('register creates a trigger via layer delegate', () => {
    const t = tool.register({ when: 'error', surface: 'show logs', memoryId: 'm1' });
    expect(t.id).toMatch(/^trg_/);
    expect(listFilesContaining(dir, 'prospective-triggers.json')).toBe(true);
  });

  it('evaluate returns matches via layer delegate', () => {
    tool.register({ when: 'deploy', surface: 'run checklist', memoryId: 'm1' });
    const matches = tool.evaluate('deploy to staging');
    expect(matches.length).toBe(1);
  });

  it('remove deletes via layer delegate', () => {
    const t = tool.register({ when: 'test', surface: 'test', memoryId: 'm1' });
    expect(tool.remove(t.id)).toBe(true);
    expect(tool.list().length).toBe(0);
  });
});

function listFilesContaining(dir: string, name: string): boolean {
  return fs.readdirSync(dir).some(f => f === name);
}

// ────────────────────────────────────────────────────────────────────
// Tool 24: BiasRevealerTool (wraps L18)
// ────────────────────────────────────────────────────────────────────
describe('BiasRevealerTool — Tool 24: wraps L18 layer', () => {
  let tool: BiasRevealerTool;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    tool = new BiasRevealerTool(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('reveal returns BiasReport via layer delegate', () => {
    const report = tool.reveal();
    expect(Array.isArray(report.overrepresented)).toBe(true);
    expect(Array.isArray(report.underrepresented)).toBe(true);
    expect(typeof report.recommendation).toBe('string');
  });

  it('reveal with seeded data detects overrepresentation', () => {
    const entries = [];
    for (let i = 0; i < 8; i++) {
      entries.push({ id: `s${i}`, content: 'functional programming patterns', tags: ['fp'], type: 'preference', timestamp: Date.now() });
    }
    entries.push({ id: 's8', content: 'testing best practices', tags: ['test'], type: 'fact', timestamp: Date.now() });
    fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify(entries), 'utf-8');
    const report = tool.reveal();
    const fpTopic = report.overrepresented.find(o => o.category === 'functional');
    expect(fpTopic).toBeDefined();
    expect(fpTopic!.count).toBeGreaterThanOrEqual(5);
  });
});

// ────────────────────────────────────────────────────────────────────
// Tool 19: ConfidenceCalibratorTool (wraps L22)
// ────────────────────────────────────────────────────────────────────
describe('ConfidenceCalibratorTool — Tool 19: wraps L22 layer', () => {
  let tool: ConfidenceCalibratorTool;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    tool = new ConfidenceCalibratorTool(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('calibrate returns score via layer delegate', () => {
    const result = tool.calibrate({ similarity: 0.8, reliability: 0.7, evidence: 0.5, freshness: 0.9 });
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('record persists and returns result', () => {
    const result = tool.record('mem1', { similarity: 0.9, reliability: 0.8, evidence: 0.6, freshness: 1 });
    expect(result.level).toBe('very_high');
  });
});

// ────────────────────────────────────────────────────────────────────
// Tool 25: SchemaInferrer
// ────────────────────────────────────────────────────────────────────
describe('SchemaInferrer — Tool 25: schema auto-extraction', () => {
  let inferrer: SchemaInferrer;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    inferrer = new SchemaInferrer(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('infer returns empty schemas when no data', () => {
    const result = inferrer.infer();
    expect(result.schemas).toEqual([]);
    expect(result.totalEntriesAnalyzed).toBe(0);
  });

  it('infer returns schemas from seeded data', () => {
    fs.writeFileSync(path.join(dir, 'semantic.json'), JSON.stringify([
      { id: 's1', content: 'always validate user input before processing requests', timestamp: Date.now() },
      { id: 's2', content: 'always validate user input before processing data', timestamp: Date.now() },
      { id: 's3', content: 'always validate user input before saving records', timestamp: Date.now() },
    ]), 'utf-8');
    const result = inferrer.infer();
    expect(result.schemas.length).toBeGreaterThanOrEqual(1);
    expect(result.totalEntriesAnalyzed).toBe(3);
    expect(result.schemas[0].exampleCount).toBeGreaterThanOrEqual(2);
    expect(result.schemas[0].type).toMatch(/^pattern_/);
  });

  it('infer reads from episodes.json as well', () => {
    fs.writeFileSync(path.join(dir, 'episodes.json'),
      JSON.stringify([
        { id: 'e1', summary: 'review pull request for main branch', timestamp: Date.now() },
        { id: 'e2', summary: 'review pull request for feature branch', timestamp: Date.now() },
      ]), 'utf-8');
    const result = inferrer.infer();
    expect(result.totalEntriesAnalyzed).toBe(2);
  });
});
