import { describe, it, expect, beforeEach } from 'vitest';
import { upsertMemory, getMemory, listMemory, deleteMemory, appendEpisode, getTeamFeed } from '../src/teamMemory.js';

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

beforeEach(() => {
  cleanup();
});

describe('teamMemory', () => {
  it('stores and retrieves an entry', () => {
    upsertMemory({ key: 'k1', value: 'val1', importance: 0.8, tags: ['t1'], createdBy: 'u1', teamId: teamA, updatedAt: new Date().toISOString() });
    const entry = getMemory(teamA, 'k1');
    expect(entry).toBeTruthy();
    expect(entry!.value).toBe('val1');
  });

  it('overwrites existing key', () => {
    upsertMemory({ key: 'k1', value: 'old', importance: 0.5, tags: [], createdBy: 'u1', teamId: teamA, updatedAt: '' });
    upsertMemory({ key: 'k1', value: 'new', importance: 0.9, tags: ['urgent'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
    expect(getMemory(teamA, 'k1')!.value).toBe('new');
  });

  it('isolates entries by teamId', () => {
    upsertMemory({ key: 'k1', value: 'team-a-val', importance: 0.5, tags: [], createdBy: 'u1', teamId: teamB, updatedAt: '' });
    upsertMemory({ key: 'k1', value: 'team-b-val', importance: 0.5, tags: [], createdBy: 'u2', teamId: teamC, updatedAt: '' });
    expect(getMemory(teamB, 'k1')!.value).toBe('team-a-val');
    expect(getMemory(teamC, 'k1')!.value).toBe('team-b-val');
  });

  it('listMemory returns all entries when no tags filter', () => {
    upsertMemory({ key: 'k1', value: 'v1', importance: 0.5, tags: ['a'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
    upsertMemory({ key: 'k2', value: 'v2', importance: 0.5, tags: ['b'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
    expect(listMemory(teamA).length).toBe(2);
  });

  it('listMemory filters by tags', () => {
    upsertMemory({ key: 'k1', value: 'v1', importance: 0.5, tags: ['frontend'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
    upsertMemory({ key: 'k2', value: 'v2', importance: 0.5, tags: ['backend'], createdBy: 'u1', teamId: teamA, updatedAt: '' });
    const filtered = listMemory(teamA, ['frontend']);
    expect(filtered.length).toBe(1);
    expect(filtered[0].key).toBe('k1');
  });

  it('deleteMemory returns false for missing key', () => {
    expect(deleteMemory(teamB, 'nope')).toBe(false);
  });

  it('deleteMemory deletes an existing entry', () => {
    upsertMemory({ key: 'k1', value: 'v1', importance: 0.5, tags: [], createdBy: 'u1', teamId: teamA, updatedAt: '' });
    expect(deleteMemory(teamA, 'k1')).toBe(true);
    expect(getMemory(teamA, 'k1')).toBeUndefined();
  });

  it('appends and retrieves episodic events', () => {
    const evt = appendEpisode({ id: 'e1', teamId: teamD, userId: 'u1', action: 'test', summary: 'test event' });
    expect(evt.timestamp).toBeTruthy();
    const feed = getTeamFeed(teamD);
    expect(feed.length).toBe(1);
    expect(feed[0].action).toBe('test');
  });

  it('isolates feed by teamId', () => {
    appendEpisode({ id: 'e2', teamId: teamC, userId: 'u2', action: 'b', summary: '' });
    appendEpisode({ id: 'e3', teamId: teamD, userId: 'u3', action: 'c', summary: '' });
    expect(getTeamFeed(teamC).length).toBe(1);
    expect(getTeamFeed(teamD).length).toBe(2);
  });
});
