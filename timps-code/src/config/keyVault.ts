import * as crypto from 'node:crypto';
import * as os from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = 'timps-key-vault-v1';

function deriveKey(): Buffer {
  const machineFingerprint = [
    os.hostname(),
    os.userInfo().username,
    (os as any).machine ? (os as any).machine() : '',
    require('child_process').execSync('echo $HOME', { encoding: 'utf-8' }).trim(),
  ].join('|');
  return crypto.scryptSync(machineFingerprint, SALT, KEY_LENGTH);
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) cachedKey = deriveKey();
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length < 3) throw new Error('Invalid encrypted payload');
  const ivHex = parts[0];
  const tagHex = parts[1];
  const encrypted = parts.slice(2).join(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/.test(value);
}

export function reEncryptAll(keys: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [provider, value] of Object.entries(keys)) {
    if (!value) continue;
    result[provider] = isEncrypted(value) ? value : encrypt(value);
  }
  return result;
}
