import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  teamId: string;
  createdAt: number;
  lastLogin?: number;
  avatar?: string;
  phone?: string;
  timezone?: string;
  settings?: UserSettings;
}

export interface UserSettings {
  notifications: boolean;
  emailDigest: 'daily' | 'weekly' | 'never';
  theme: 'light' | 'dark' | 'system';
  language: string;
  defaultOrg?: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  features: string[];
  createdAt: number;
  settings?: TeamSettings;
  subscription?: Subscription;
}

export interface TeamSettings {
  allowGuestInvite: boolean;
  require2FA: boolean;
  sessionTimeout: number;
  ipWhitelist?: string[];
  domain?: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
  };
}

export interface Subscription {
  id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token: string;
  expiresAt: number;
  usedBy?: string;
  invitedBy?: string;
  message?: string;
}

export interface ApiKey {
  id: string;
  teamId: string;
  userId: string;
  name: string;
  key: string;
  lastUsed?: number;
  expiresAt?: number;
  createdAt: number;
  permissions: string[];
}

export interface AuditLog {
  id: string;
  teamId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

export interface UsageMetrics {
  teamId: string;
  month: string;
  apiCalls: number;
  tokensUsed: number;
  storageMB: number;
  activeUsers: number;
  workflowsRun: number;
  integrationsUsed: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const users: Map<string, User> = new Map();
const teams: Map<string, Team> = new Map();
const invitations: Map<string, TeamInvitation> = new Map();
const apiKeys: Map<string, ApiKey> = new Map();
const auditLogs: Map<string, AuditLog[]> = new Map();
const usageMetrics: Map<string, UsageMetrics> = new Map();

export const authRouter = Router();
export const adminRouter = Router();
export const analyticsRouter = Router();
export const auditRouter = Router();

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = users.get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    (req as any).user = decoded;
    (req as any).fullUser = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireTeam(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user.teamId) {
    return res.status(403).json({ error: 'No team association' });
  }
  next();
}

function logAudit(teamId: string, userId: string, action: string, resource: string, req: Request, metadata?: any) {
  const key = teamId;
  if (!auditLogs.has(key)) {
    auditLogs.set(key, []);
  }
  const logs = auditLogs.get(key)!;
  logs.push({
    id: generateId('audit'),
    teamId,
    userId,
    action,
    resource,
    metadata,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: Date.now(),
  });
  if (logs.length > 10000) {
    logs.splice(0, logs.length - 10000);
  }
}

authRouter.post('/register', async (req, res) => {
  const { email, password, name, teamName, inviteToken } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const existingUser = Array.from(users.values()).find((u) => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const userId = generateId('user');
  const passwordHash = await bcrypt.hash(password, 10);

  let teamId: string;
  let role: User['role'] = 'member';

  if (teamName) {
    teamId = generateId('team');
    role = 'owner';
    teams.set(teamId, {
      id: teamId,
      name: teamName,
      ownerId: userId,
      plan: 'free',
      features: ['basic-memory'],
      createdAt: Date.now(),
      settings: {
        allowGuestInvite: true,
        require2FA: false,
        sessionTimeout: 86400,
      },
    });

    logAudit(teamId, userId, 'create', 'team', req);
  } else if (inviteToken) {
    const invitation = invitations.get(inviteToken);
    if (!invitation || invitation.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }
    teamId = invitation.teamId;
    role = invitation.role;
    invitation.usedBy = userId;
    invitations.delete(inviteToken);
  } else {
    const existingTeam = Array.from(teams.values()).find((t) => t.ownerId === userId);
    teamId = existingTeam?.id || '';
    role = existingTeam ? 'owner' : 'member';
  }

  const user: User = {
    id: userId,
    email,
    passwordHash,
    name,
    role,
    teamId,
    createdAt: Date.now(),
    settings: {
      notifications: true,
      emailDigest: 'daily',
      theme: 'system',
      language: 'en',
    },
  };

  users.set(userId, user);
  logAudit(teamId, userId, 'register', 'user', req);

  const token = jwt.sign({ userId, teamId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: { id: userId, email, name, role, teamId: teamId || undefined } });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = Array.from(users.values()).find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    logAudit(user.teamId, user.id, 'login_failed', 'user', req, { reason: 'invalid_password' });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  user.lastLogin = Date.now();
  users.set(user.id, user);

  const token = jwt.sign({ userId: user.id, teamId: user.teamId, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  logAudit(user.teamId, user.id, 'login', 'user', req);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.name,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
      avatar: user.avatar,
      settings: user.settings,
    },
  });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  const user = (req as any).fullUser;
  logAudit(user.teamId, user.id, 'logout', 'user', req);
  res.json({ success: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = (req as any).fullUser;
  res.json({
    id: user.id,
    email: user.name,
    name: user.name,
    role: user.role,
    teamId: user.teamId,
    avatar: user.avatar,
    phone: user.phone,
    timezone: user.timezone,
    settings: user.settings,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  });
});

authRouter.put('/me', requireAuth, async (req, res) => {
  const user = (req as any).fullUser;
  const { name, phone, timezone, settings } = req.body;

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (timezone) user.timezone = timezone;
  if (settings) user.settings = { ...user.settings, ...settings };

  users.set(user.id, user);
  logAudit(user.teamId, user.id, 'update', 'user', req);

  res.json({ success: true, user });
});

authRouter.post('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = (req as any).fullUser;

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  users.set(user.id, user);
  logAudit(user.teamId, user.id, 'password_change', 'user', req);

  res.json({ success: true });
});

authRouter.post('/invite', requireAuth, requireRole('owner', 'admin'), (req, res) => {
  const { email, role, message } = req.body;
  const user = (req as any).user;
  const team = teams.get(user.teamId);

  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const invitation: TeamInvitation = {
    id: generateId('inv'),
    teamId: team.id,
    email,
    role: role || 'member',
    token: Math.random().toString(36).substr(2, 16),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    invitedBy: user.userId,
    message,
  };

  invitations.set(invitation.token, invitation);
  logAudit(team.id, user.userId, 'invite', 'team', req, { email, role });

  res.json({ invitation: invitation.token });
});

authRouter.post('/accept-invite', async (req, res) => {
  const { token, password, name } = req.body;

  const invitation = invitations.get(token);
  if (!invitation) {
    return res.status(400).json({ error: 'Invalid invitation' });
  }

  if (invitation.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Invitation expired' });
  }

  const userId = generateId('user');
  const passwordHash = await bcrypt.hash(password, 10);

  const user: User = {
    id: userId,
    email: invitation.email,
    passwordHash,
    name,
    role: invitation.role as any,
    teamId: invitation.teamId,
    createdAt: Date.now(),
    settings: {
      notifications: true,
      emailDigest: 'daily',
      theme: 'system',
      language: 'en',
    },
  };

  users.set(userId, user);
  invitation.usedBy = userId;
  invitations.delete(token);
  logAudit(invitation.teamId, userId, 'accept_invite', 'team', req);

  const jwtToken = jwt.sign({ userId, teamId: invitation.teamId, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token: jwtToken, user: { id: userId, email: user.email, name: user.name, role: user.role } });
});

authRouter.get('/team', requireAuth, requireTeam, (req, res) => {
  const user = (req as any).user;
  const team = teams.get(user.teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const teamUsers = Array.from(users.values()).filter((u) => u.teamId === team.id);
  res.json({
    team: { ...team, memberCount: teamUsers.length },
    members: teamUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      lastLogin: u.lastLogin,
    })),
  });
});

authRouter.get('/team/usage', requireAuth, requireTeam, (req, res) => {
  const user = (req as any).user;
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const key = `${user.teamId}_${month}`;
  const metrics = usageMetrics.get(key);

  const team = teams.get(user.teamId);
  res.json({
    month,
    plan: team?.plan || 'free',
    features: team?.features || [],
    metrics: metrics || {
      teamId: user.teamId,
      month,
      apiCalls: 0,
      tokensUsed: 0,
      storageMB: 0,
      activeUsers: 0,
      workflowsRun: 0,
      integrationsUsed: 0,
    },
  });
});

authRouter.get('/team/billing', requireAuth, requireRole('owner'), (req, res) => {
  const user = (req as any).user;
  const team = teams.get(user.teamId);

  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  res.json({
    plan: team.plan,
    subscription: team.subscription,
    features: team.features,
  });
});

authRouter.post('/api-keys', requireAuth, requireTeam, (req, res) => {
  const { name, permissions, expiresIn } = req.body;
  const user = (req as any).fullUser;

  const keyId = generateId('key');
  const key = `tk_${Math.random().toString(36).substr(2, 24)}`;

  const apiKey: ApiKey = {
    id: keyId,
    teamId: user.teamId,
    userId: user.id,
    name,
    key,
    createdAt: Date.now(),
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    permissions: permissions || ['read'],
  };

  apiKeys.set(key, apiKey);
  logAudit(user.teamId, user.id, 'create', 'api_key', req, { name });

  res.json({ keyId, key: key, name, expiresAt: apiKey.expiresAt });
});

authRouter.get('/api-keys', requireAuth, requireTeam, (req, res) => {
  const user = (req as any).fullUser;

  const keys = Array.from(apiKeys.values())
    .filter((k) => k.teamId === user.teamId)
    .map((k) => ({
      id: k.id,
      name: k.name,
      lastUsed: k.lastUsed,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
      permissions: k.permissions,
    }));

  res.json({ keys });
});

authRouter.delete('/api-keys/:keyId', requireAuth, requireTeam, (req, res) => {
  const { keyId } = req.params;
  const user = (req as any).fullUser;

  const key = Array.from(apiKeys.values()).find((k) => k.id === keyId && k.teamId === user.teamId);
  if (!key) {
    return res.status(404).json({ error: 'API key not found' });
  }

  apiKeys.delete(key.key);
  logAudit(user.teamId, user.id, 'delete', 'api_key', req, { keyId });

  res.json({ success: true });
});

adminRouter.get('/users', requireAuth, requireRole('owner', 'admin'), requireTeam, (req, res) => {
  const user = (req as any).user;
  const teamUsers = Array.from(users.values()).filter((u) => u.teamId === user.teamId);

  res.json({
    users: teamUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    })),
  });
});

adminRouter.post('/users/:userId/role', requireAuth, requireRole('owner', 'admin'), requireTeam, (req, res) => {
  const { role } = req.body;
  const { userId } = req.params;
  const user = (req as any).user;

  const targetUser = users.get(userId);
  if (!targetUser || targetUser.teamId !== user.teamId) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role !== 'owner' && targetUser.role === 'owner') {
    return res.status(403).json({ error: 'Cannot change owner role' });
  }

  targetUser.role = role;
  users.set(userId, targetUser);
  logAudit(user.teamId, user.userId, 'role_change', 'user', req, { targetUserId: userId, newRole: role });

  res.json({ user: { id: targetUser.id, name: targetUser.name, role: targetUser.role } });
});

adminRouter.delete('/users/:userId', requireAuth, requireRole('owner'), requireTeam, (req, res) => {
  const { userId } = req.params;
  const user = (req as any).user;

  if (userId === user.userId) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  const targetUser = users.get(userId);
  if (!targetUser || targetUser.teamId !== user.teamId) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (targetUser.role === 'owner') {
    return res.status(403).json({ error: 'Cannot delete team owner' });
  }

  users.delete(userId);
  logAudit(user.teamId, user.userId, 'delete', 'user', req, { targetUserId: userId });

  res.json({ success: true });
});

analyticsRouter.get('/overview', requireAuth, requireTeam, (req, res) => {
  const user = (req as any).user;
  const team = teams.get(user.teamId);

  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const teamUsers = Array.from(users.values()).filter((u) => u.teamId === user.teamId);
  const activeUsers = teamUsers.filter((u) => u.lastLogin && u.lastLogin > Date.now() - 7 * 24 * 60 * 60 * 1000);

  const months: UsageMetrics[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.toISOString().slice(0, 7);
    const key = `${team.id}_${month}`;
    months.push(usageMetrics.get(key) || {
      teamId: team.id,
      month,
      apiCalls: 0,
      tokensUsed: 0,
      storageMB: 0,
      activeUsers: 0,
      workflowsRun: 0,
      integrationsUsed: 0,
    });
  }

  res.json({
    plan: team.plan,
    members: {
      total: teamUsers.length,
      active: activeUsers.length,
    },
    usage: {
      current: months[0] || {
        teamId: team.id,
        month: new Date().toISOString().slice(0, 7),
        apiCalls: 0,
        tokensUsed: 0,
        storageMB: 0,
        activeUsers: 0,
        workflowsRun: 0,
        integrationsUsed: 0,
      },
      history: months.slice(1, 6),
    },
  });
});

auditRouter.get('/logs', requireAuth, requireRole('owner', 'admin'), requireTeam, (req, res) => {
  const user = (req as any).user;
  const logs = auditLogs.get(user.teamId) || [];
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  const action = req.query.action as string;
  const resource = req.query.resource as string;

  let filtered = logs;
  if (action) {
    filtered = filtered.filter((l) => l.action === action);
  }
  if (resource) {
    filtered = filtered.filter((l) => l.resource === resource);
  }

  res.json({
    logs: filtered.slice(offset, offset + limit),
    total: filtered.length,
  });
});

export function createEnterpriseRouter(): Router {
  return Router()
    .use('/auth', authRouter)
    .use('/admin', adminRouter)
    .use('/analytics', analyticsRouter)
    .use('/audit', auditRouter);
}