import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';

export type UserRole = 'admin' | 'member' | 'viewer';

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: number;
}

interface UsersFile {
  users: StoredUser[];
}

const USERS_FILE = path.join(os.homedir(), '.timps', 'users.json');
const TOKEN_FILE = path.join(os.homedir(), '.timps', 'auth-token.json');
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;

function loadUsers(): UsersFile {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { users: [] };
}

function saveUsers(data: UsersFile): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

function generateId(): string {
  return crypto.randomBytes(6).toString('hex');
}

export function createUser(username: string, password: string, role: UserRole = 'member'): StoredUser {
  const data = loadUsers();
  if (data.users.find(u => u.username === username)) {
    throw new Error(`User "${username}" already exists`);
  }
  const salt = generateSalt();
  const user: StoredUser = {
    id: generateId(),
    username,
    passwordHash: hashPassword(password, salt),
    salt,
    role,
    createdAt: Date.now(),
  };
  data.users.push(user);
  saveUsers(data);
  return { ...user, passwordHash: '[redacted]', salt: '[redacted]' } as StoredUser;
}

export function verifyPassword(username: string, password: string): StoredUser | null {
  const data = loadUsers();
  const user = data.users.find(u => u.username === username);
  if (!user) return null;
  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return null;
  return { ...user, passwordHash: '[redacted]', salt: '[redacted]' } as StoredUser;
}

export function getUser(username: string): StoredUser | null {
  const data = loadUsers();
  const user = data.users.find(u => u.username === username);
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe as StoredUser;
}

export function listUsers(): StoredUser[] {
  const data = loadUsers();
  return data.users.map(({ passwordHash, salt, ...safe }) => safe as StoredUser);
}

export function deleteUser(username: string): boolean {
  const data = loadUsers();
  const idx = data.users.findIndex(u => u.username === username);
  if (idx === -1) return false;
  data.users.splice(idx, 1);
  saveUsers(data);
  return true;
}

export function setUserRole(username: string, role: UserRole): StoredUser | null {
  const data = loadUsers();
  const user = data.users.find(u => u.username === username);
  if (!user) return null;
  user.role = role;
  saveUsers(data);
  const { passwordHash, salt, ...safe } = user;
  return safe as StoredUser;
}

export interface SessionToken {
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: number;
}

export function createSession(username: string): SessionToken {
  const data = loadUsers();
  const user = data.users.find(u => u.username === username);
  if (!user) throw new Error(`User "${username}" not found`);

  const token: SessionToken = {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  const tokenPayload = JSON.stringify(token);
  const signature = crypto.createHmac('sha256', user.salt).update(tokenPayload).digest('hex');
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, signature }, null, 2), 'utf-8');
  return token;
}

export function getSession(): SessionToken | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const stored = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    if (!stored.token || !stored.signature) return null;
    if (stored.token.expiresAt < Date.now()) {
      fs.unlinkSync(TOKEN_FILE);
      return null;
    }
    const data = loadUsers();
    const user = data.users.find(u => u.id === stored.token.userId);
    if (!user) return null;
    const payload = JSON.stringify(stored.token);
    const expectedSig = crypto.createHmac('sha256', user.salt).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(stored.signature), Buffer.from(expectedSig))) return null;
    return stored.token as SessionToken;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
  } catch { /* ignore */ }
}
