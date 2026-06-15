import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface StoredCredentials {
  [integrationId: string]: {
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    instanceUrl?: string;
    organization?: string;
    expiresAt?: number;
  };
}

const CREDENTIALS_PATH = path.join(
  process.cwd(),
  '.timps',
  'marketplace',
  'credentials.json'
);

function getEncryptionKey(): Buffer {
  const key = process.env.MARKETPLACE_ENCRYPTION_KEY || 'timps-marketplace-dev-key-32chars!';
  return crypto.scryptSync(key, 'timps-salt', 32);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function ensureDir(): void {
  const dir = path.dirname(CREDENTIALS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore(): StoredCredentials {
  ensureDir();
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const decrypted: StoredCredentials = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        decrypted[key] = JSON.parse(decrypt(value));
      }
    }
    return decrypted;
  } catch {
    return {};
  }
}

function writeStore(store: StoredCredentials): void {
  ensureDir();
  const encrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(store)) {
    encrypted[key] = encrypt(JSON.stringify(value));
  }
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(encrypted, null, 2));
}

export function getCredentials(id: string): StoredCredentials[string] | null {
  const store = readStore();
  return store[id] || null;
}

export function setCredentials(
  id: string,
  creds: StoredCredentials[string]
): void {
  const store = readStore();
  store[id] = creds;
  writeStore(store);
}

export function deleteCredentials(id: string): void {
  const store = readStore();
  delete store[id];
  writeStore(store);
}

export function getAllCredentials(): string[] {
  return Object.keys(readStore());
}

export function hasCredentials(id: string): boolean {
  return getCredentials(id) !== null;
}
