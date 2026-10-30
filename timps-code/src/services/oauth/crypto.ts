// TIMPS Code — OAuth Crypto Utilities
// PKCE code generation for OAuth 2.0 flows

import { createHash, randomBytes } from 'node:crypto';

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function generateCodeVerifier(): string {
  return base64URLEncode(randomBytes(32));
}

export function generateCodeChallenge(verifier: string): string {
  // PKCE requires SHA-256 of the verifier (RFC 7636 §4.2) — this is not a
  // password hash and must stay fast and unsalted for the server to match it.
  // lgtm[js/insufficient-password-hash]
  const hash = createHash('sha256');
  hash.update(verifier);
  return base64URLEncode(hash.digest());
}

export function generateState(): string {
  return base64URLEncode(randomBytes(32));
}