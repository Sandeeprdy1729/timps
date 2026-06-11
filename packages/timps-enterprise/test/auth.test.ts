import { registerUser, validatePassword, getUserById, listTeamMembers, signToken, verifyToken } from '../src/auth.js';
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

const testEmail = `alice-${Date.now()}@test.com`;
const testPassword = 'securePass123!';
const testTeam = 'team-red';

await registerUser(testEmail, testPassword, testTeam, 'member');

console.log('\nauth tests:');

await test('registerUser throws on duplicate email', async () => {
  await assert.rejects(
    () => registerUser(testEmail, 'other', testTeam),
    /already exists/
  );
});

await test('validatePassword returns user on correct password', async () => {
  const user = await validatePassword(testEmail, testPassword);
  assert.notStrictEqual(user, null);
  assert.strictEqual(user!.email, testEmail);
});

await test('validatePassword returns null on wrong password', async () => {
  const user = await validatePassword(testEmail, 'wrong');
  assert.strictEqual(user, null);
});

await test('validatePassword returns null for unknown email', async () => {
  const user = await validatePassword('nobody@test.com', testPassword);
  assert.strictEqual(user, null);
});

await test('getUserById returns undefined for unknown id', () => {
  assert.strictEqual(getUserById('nope'), undefined);
});

await test('listTeamMembers omits passwordHash', () => {
  const members = listTeamMembers(testTeam);
  assert.ok(members.length >= 1);
  assert.strictEqual('passwordHash' in members[0], false);
});

await test('signs and verifies a JWT token', async () => {
  const user = await validatePassword(testEmail, testPassword);
  const token = signToken(user!);
  const payload = verifyToken(token);
  assert.strictEqual(payload.sub, user!.id);
  assert.strictEqual(payload.teamId, testTeam);
  assert.strictEqual(payload.role, 'member');
});

await test('verifyToken throws on bad token', () => {
  assert.throws(() => verifyToken('bad.token.here'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
