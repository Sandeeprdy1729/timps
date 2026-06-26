import { describe, it, expect, beforeEach } from 'vitest';
import {
  createUser, verifyPassword, listUsers, deleteUser,
  setUserRole, createSession, getSession, clearSession,
} from './userStore.js';

describe('UserStore', () => {
  const testUsername = `testuser-${Date.now()}`;

  it('creates a user', () => {
    const user = createUser(testUsername, 'password123', 'member');
    expect(user.username).toBe(testUsername);
    expect(user.role).toBe('member');
    expect(user.id).toBeTruthy();
  });

  it('rejects duplicate username', () => {
    expect(() => createUser(testUsername, 'other')).toThrow('already exists');
  });

  it('verifies correct password', () => {
    const user = verifyPassword(testUsername, 'password123');
    expect(user).not.toBeNull();
    expect(user!.username).toBe(testUsername);
  });

  it('rejects wrong password', () => {
    const result = verifyPassword(testUsername, 'wrong-password');
    expect(result).toBeNull();
  });

  it('rejects unknown user', () => {
    const result = verifyPassword('nonexistent-user', 'password');
    expect(result).toBeNull();
  });

  it('does not expose password hash or salt', () => {
    const user = verifyPassword(testUsername, 'password123');
    expect(user).not.toBeNull();
    expect((user as any).passwordHash).toBe('[redacted]');
    expect((user as any).salt).toBe('[redacted]');
  });

  it('lists users', () => {
    const users = listUsers();
    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users.some(u => u.username === testUsername)).toBe(true);
  });

  it('sets user role', () => {
    const updated = setUserRole(testUsername, 'admin');
    expect(updated).not.toBeNull();
    expect(updated!.role).toBe('admin');
    // Reset for other tests
    setUserRole(testUsername, 'member');
  });

  it('deletes user', () => {
    const tempUser = `temp-${Date.now()}`;
    createUser(tempUser, 'pass');
    expect(deleteUser(tempUser)).toBe(true);
    expect(deleteUser(tempUser)).toBe(false);
  });

  it('creates and reads session', () => {
    const session = createSession(testUsername);
    expect(session.username).toBe(testUsername);
    expect(session.expiresAt).toBeGreaterThan(Date.now());

    const read = getSession();
    expect(read).not.toBeNull();
    expect(read!.username).toBe(testUsername);
  });

  it('clears session', () => {
    clearSession();
    const read = getSession();
    expect(read).toBeNull();
  });
});
