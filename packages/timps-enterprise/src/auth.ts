/**
 * timps-enterprise — JWT authentication middleware and user registry.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = (() => {
  const secret = process.env.TIMPS_JWT_SECRET;
  if (!secret || secret === 'timps-dev-secret-change-in-prod') {
    throw new Error(
      'TIMPS_JWT_SECRET environment variable is required. ' +
      'Generate a secure secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return secret;
})();
const JWT_EXPIRY = process.env.TIMPS_JWT_EXPIRY ?? '7d';

// ── In-memory user registry (replace with DB in production) ───────────────

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  teamId: string;
  role: 'admin' | 'member' | 'viewer';
  createdAt: string;
}

const users = new Map<string, User>(); // id → user
const emailIndex = new Map<string, string>(); // email → id

export async function registerUser(email: string, password: string, teamId: string, role: User['role'] = 'member'): Promise<User> {
  if (emailIndex.has(email)) throw new Error('User already exists');
  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = {
    id: randomUUID(),
    email,
    passwordHash,
    teamId,
    role,
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  emailIndex.set(email, user.id);
  return user;
}

export async function validatePassword(email: string, password: string): Promise<User | null> {
  const userId = emailIndex.get(email);
  if (!userId) return null;
  const user = users.get(userId);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function listTeamMembers(teamId: string): Omit<User, 'passwordHash'>[] {
  return [...users.values()]
    .filter((u) => u.teamId === teamId)
    .map(({ passwordHash: _omit, ...rest }) => rest);
}

// ── Invitation system ──────────────────────────────────────────────────

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

const invitations = new Map<string, TeamInvitation>(); // id → invitation
const teamInvites = new Map<string, Set<string>>(); // teamId → set of invitation ids

export function createInvitation(
  teamId: string,
  email: string,
  role: 'admin' | 'member' | 'viewer',
  createdByUserId: string
): TeamInvitation {
  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8);
  const invitation: TeamInvitation = {
    id: randomUUID(),
    teamId,
    email,
    role,
    token,
    createdBy: createdByUserId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    used: false,
  };
  invitations.set(invitation.id, invitation);
  if (!teamInvites.has(teamId)) teamInvites.set(teamId, new Set());
  teamInvites.get(teamId)!.add(invitation.id);
  return invitation;
}

export function validateInvitation(token: string, teamId: string, email: string): TeamInvitation | null {
  for (const inv of invitations.values()) {
    if (inv.token === token && inv.teamId === teamId && inv.email === email && !inv.used) {
      if (new Date(inv.expiresAt) < new Date()) return null; // expired
      return inv;
    }
  }
  return null;
}

export function consumeInvitation(invitationId: string): void {
  const inv = invitations.get(invitationId);
  if (inv) inv.used = true;
}

export function teamHasMembers(teamId: string): boolean {
  return [...users.values()].some((u) => u.teamId === teamId);
}

// ── JWT helpers ────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;       // user ID
  teamId: string;
  role: User['role'];
}

export function signToken(user: User): string {
  const payload: JwtPayload = { sub: user.id, teamId: user.teamId, role: user.role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ── Express middleware ─────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(role: User['role']) {
  const roleOrder: Record<User['role'], number> = { viewer: 0, member: 1, admin: 2 };
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || roleOrder[req.user.role] < roleOrder[role]) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
