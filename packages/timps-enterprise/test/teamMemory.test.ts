import { upsertMemory, getMemory, listMemory, deleteMemory, appendEpisode, getTeamFeed } from '../src/teamMemory.js';
import assert from 'node:assert';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

const teamA = 'team-unit-a';
const teamB = 'team-unit-b';
const teamC = 'team-unit-c';
const teamD = 'team-unit-d';

function cleanup() {
  for (const key of ['k1', 'k2', 'k3']) {
    for (const t of [teamA, teamB, teamC, teamD]) {
      try { deleteMemory(t, key); } catch {}
    }
  }
}

cleanup();

console.log('\nteamMemory tests:');

await test('stores and retrieves an entry', () => {
  upsertMemory({ key: 'k1', value: 'val1', importance: 0.8, tags: ['t1'], createdBy: 'u1', teamId: teamA, updatedAt: new Date().toISOString() });
  const entry = getMemory(teamA, 'k1');
  assert.ok(entry);
  assert.strictEqual(entry!.value, 'val1');
});

await test('overwrites existing key', () => {
  upsertMemory({ key: 'k1', value: 'old', importance: 0.5, tags: [], createdBy: 'u1', teamId: teamA, updatedAt: '' });
  upsertMemory({ key: 'k1', value: 'new', importance: 0.9, tags: ['urgent'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
  assert.strictEqual(getMemory(teamA, 'k1')!.value, 'new');
});

await test('isolates entries by teamId', () => {
  cleanup();
  upsertMemory({ key: 'k1', value: 'team-a-val', importance: 0.5, tags: [], createdBy: 'u1', teamId: teamB, updatedAt: '' });
  upsertMemory({ key: 'k1', value: 'team-b-val', importance: 0.5, tags: [], createdBy: 'u2', teamId: teamC, updatedAt: '' });
  assert.strictEqual(getMemory(teamB, 'k1')!.value, 'team-a-val');
  assert.strictEqual(getMemory(teamC, 'k1')!.value, 'team-b-val');
});

await test('listMemory returns all entries when no tags filter', () => {
  cleanup();
  upsertMemory({ key: 'k1', value: 'v1', importance: 0.5, tags: ['a'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
  upsertMemory({ key: 'k2', value: 'v2', importance: 0.5, tags: ['b'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
  assert.strictEqual(listMemory(teamA).length, 2);
});

await test('listMemory filters by tags', () => {
  cleanup();
  upsertMemory({ key: 'k1', value: 'v1', importance: 0.5, tags: ['frontend'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
  upsertMemory({ key: 'k2', value: 'v2', importance: 0.5, tags: ['backend'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
  const filtered = listMemory(teamA, ['frontend']);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].key, 'k1');
});

await test('deleteMemory returns false for missing key', () => {
  assert.strictEqual(deleteMemory(teamB, 'nope'), false);
});

await test('deleteMemory deletes an existing entry', () => {
  cleanup();
  upsertMemory({ key: 'k1', value: 'v1', importance: 0.5, tags: [], createdBy: 'u1', teamId: teamA, updatedAt: '' });
  assert.strictEqual(deleteMemory(teamA, 'k1'), true);
  assert.strictEqual(getMemory(teamA, 'k1'), undefined);
});

await test('appends and retrieves episodic events', () => {
  const evt = appendEpisode({ id: 'e1', teamId: teamD, userId: 'u1', action: 'test', summary: 'test event' });
  assert.ok(evt.timestamp);
  const feed = getTeamFeed(teamD);
  assert.strictEqual(feed.length, 1);
  assert.strictEqual(feed[0].action, 'test');
});

await test('isolates feed by teamId', () => {
  appendEpisode({ id: 'e2', teamId: teamC, userId: 'u2', action: 'b', summary: '' });
  appendEpisode({ id: 'e3', teamId: teamD, userId: 'u3', action: 'c', summary: '' });
  assert.strictEqual(getTeamFeed(teamC).length, 1);
  assert.strictEqual(getTeamFeed(teamD).length, 2);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
