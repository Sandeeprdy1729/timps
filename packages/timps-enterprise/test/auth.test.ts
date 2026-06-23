import { describe, it, expect, beforeAll } from 'vitest';
import { registerUser, validatePassword, getUserById, listTeamMembers, signToken, verifyToken } from '../src/auth.js';

const testEmail = `alice-${Date.now()}@test.com`;
const testPassword = 'securePass123!';
const testTeam = 'team-red';

beforeAll(async () => {
  await registerUser(testEmail, testPassword, testTeam, 'member');
});

describe('auth', () => {
  it('registerUser throws on duplicate email', async () => {
    await expect(() => registerUser(testEmail, 'other', testTeam)).rejects.toThrow(/already exists/);
  });

  it('validatePassword returns user on correct password', async () => {
    const user = await validatePassword(testEmail, testPassword);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(testEmail);
  });

  it('validatePassword returns null on wrong password', async () => {
    const user = await validatePassword(testEmail, 'wrong');
    expect(user).toBeNull();
  });

  it('validatePassword returns null for unknown email', async () => {
    const user = await validatePassword('nobody@test.com', testPassword);
    expect(user).toBeNull();
  });

  it('getUserById returns undefined for unknown id', () => {
    expect(getUserById('nope')).toBeUndefined();
  });

  it('listTeamMembers omits passwordHash', () => {
    const members = listTeamMembers(testTeam);
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect('passwordHash' in members[0]).toBe(false);
  });

  it('signs and verifies a JWT token', async () => {
    const user = await validatePassword(testEmail, testPassword);
    const token = signToken(user!);
    const payload = verifyToken(token);
    expect(payload.sub).toBe(user!.id);
    expect(payload.teamId).toBe(testTeam);
    expect(payload.role).toBe('member');
  });

  it('verifyToken throws on bad token', () => {
    expect(() => verifyToken('bad.token.here')).toThrow();
  });
});
