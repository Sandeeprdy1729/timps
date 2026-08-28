import * as crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface AuthConfig {
  secret: string;
  expiresIn?: string;
  issuer?: string;
}

export interface AuthPayload {
  userId: string;
  scope?: Record<string, unknown>;
  iat?: number;
  exp?: number;
  iss?: string;
  /** Org-scope claims for multi-tenant isolation */
  orgId?: string;
  teamId?: string;
  projectId?: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

/** Stored API key record — hash is SHA-256, never plaintext after creation. */
export interface ApiKeyRecord {
  id: string;
  hash: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

const DEFAULT_EXPIRY = '24h';

// ─── API Key helpers ────────────────────────────────────────────────────────

const API_KEY_PREFIX = 'timps_';
const API_KEY_BYTES = 20; // 40 hex chars

/** Generate a new API key. Returns { key, hash, id }. The key is shown ONCE. */
export function generateApiKey(name: string): { key: string; hash: string; id: string } {
  const random = crypto.randomBytes(API_KEY_BYTES).toString('hex');
  const key = `${API_KEY_PREFIX}${random}`;
  const id = random.slice(0, 8);
  const hash = sha256(key);
  return { key, hash, id };
}

/** Hash an API key for storage/comparison. */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Constant-time comparison for API keys (timing-safe). */
export function verifyApiKey(provided: string, storedHash: string): boolean {
  const providedHash = sha256(provided);
  try {
    return crypto.timingSafeEqual(Buffer.from(providedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

/** Extract API key from request: Bearer header, ?key= query param, or x-api-key header. */
export function extractApiKey(req: Request): string | null {
  // 1. Authorization: Bearer <key>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith(API_KEY_PREFIX)) return token;
  }
  // 2. ?key=<key> query param (for WebSocket / non-header contexts)
  const queryKey = req.query?.key;
  if (typeof queryKey === 'string' && queryKey.startsWith(API_KEY_PREFIX)) {
    return queryKey;
  }
  // 3. x-api-key header
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.startsWith(API_KEY_PREFIX)) {
    return headerKey;
  }
  return null;
}

// ─── API Key middleware factory ─────────────────────────────────────────────

export interface ApiKeyAuthConfig {
  /** Map of key ID → SHA-256 hash (in-memory or loaded from storage). */
  keys: Map<string, ApiKeyRecord>;
  /** Optional: function to update lastUsedAt on successful auth. */
  onUse?: (keyId: string) => void;
}

/**
 * Creates middleware that validates API keys.
 * Checks: Bearer header, ?key= query, x-api-key header.
 * Falls through to next() if no API key is provided (so JWT middleware can try next).
 * Returns 401 if an invalid API key IS provided.
 */
export function createApiKeyMiddleware(config: ApiKeyAuthConfig) {
  return function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
    const providedKey = extractApiKey(req);
    if (!providedKey) {
      // No API key provided — let JWT middleware (or open route) handle it
      next();
      return;
    }

    // Extract the 8-char key ID from the provided key
    const keyId = providedKey.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + 8);
    const record = config.keys.get(keyId);

    if (!record || !verifyApiKey(providedKey, record.hash)) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Authenticated — attach a synthetic AuthPayload
    (req as AuthenticatedRequest).auth = {
      userId: `apikey:${keyId}`,
      iat: Math.floor(Date.now() / 1000),
    };

    // Track usage
    config.onUse?.(keyId);

    next();
  };
}

// ─── JWT Auth (existing) ───────────────────────────────────────────────────

export function createAuthMiddleware(config: AuthConfig) {
  const { secret, issuer } = config;
  const expirySeconds = parseExpiry(config.expiresIn ?? DEFAULT_EXPIRY);

  function sign(payload: Omit<AuthPayload, 'iat' | 'exp'>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(JSON.stringify({
      ...payload,
      iat: now,
      exp: now + expirySeconds,
      iss: issuer ?? 'timps-memory-server',
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  function verify(token: string): AuthPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as AuthPayload;
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      if (issuer && payload.iss !== issuer) return null;
      return payload;
    } catch {
      return null;
    }
  }

  function middleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <token>' });
      return;
    }
    const token = authHeader.slice(7);
    const payload = verify(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    (req as AuthenticatedRequest).auth = payload;
    next();
  }

  return { sign, verify, middleware };
}

/**
 * Extract OrgScope from an authenticated request.
 * Checks JWT claims first, then falls back to X-Org-Id / X-Project-ID headers.
 * Returns null if no org scope is present (backward compat).
 */
export function extractOrgScope(req: AuthenticatedRequest): { orgId: string; teamId?: string; projectId: string } | null {
  const auth = req.auth;

  // JWT claims take precedence
  if (auth?.orgId && auth?.projectId) {
    return { orgId: auth.orgId, teamId: auth.teamId, projectId: auth.projectId };
  }

  // Fall back to headers
  const hdrOrgId = req.headers['x-org-id'] as string | undefined;
  const hdrProjectId = req.headers['x-project-id'] as string | undefined;
  const hdrTeamId = req.headers['x-team-id'] as string | undefined;
  if (hdrOrgId && hdrProjectId) {
    return { orgId: hdrOrgId, teamId: hdrTeamId, projectId: hdrProjectId };
  }

  return null;
}

function parseExpiry(input: string): number {
  const match = input.match(/^(\d+)(h|m|s|d)$/);
  if (!match) return 86400;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 86400;
  }
}
