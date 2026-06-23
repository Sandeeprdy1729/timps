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
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

const DEFAULT_EXPIRY = '24h';

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
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
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
