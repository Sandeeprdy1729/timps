/**
 * Secure credential storage for integrations.
 * Encrypts API keys and tokens with AES-256-GCM before persisting to localStorage.
 * Key is derived from device-specific values (not stored on disk).
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const STORE_PREFIX = 'timps:secure:';
const SALT = 'timps-integration-keys';

let cachedKey: CryptoKey | null = null;

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const material = `${navigator.userAgent}|${window.location.hostname}|timps-secure-store`;
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(material),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedKey;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class SecureStore {
  static async set(key: string, value: string): Promise<void> {
    const cryptoKey = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(value);

    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      cryptoKey,
      encoded
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    localStorage.setItem(STORE_PREFIX + key, toBase64(combined));
  }

  static async get(key: string): Promise<string | null> {
    const stored = localStorage.getItem(STORE_PREFIX + key);
    if (!stored) return null;

    try {
      const combined = fromBase64(stored);
      const iv = combined.slice(0, IV_LENGTH);
      const ciphertext = combined.slice(IV_LENGTH);

      const cryptoKey = await getEncryptionKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        cryptoKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  static delete(key: string): void {
    localStorage.removeItem(STORE_PREFIX + key);
  }

  static async migrate(legacyKey: string, secureKey: string): Promise<void> {
    const plaintext = localStorage.getItem(legacyKey);
    if (plaintext) {
      await SecureStore.set(secureKey, plaintext);
      localStorage.removeItem(legacyKey);
    }
  }
}

export async function getApiKey(service: string): Promise<string | null> {
  return SecureStore.get(service);
}

export async function setApiKey(service: string, key: string): Promise<void> {
  return SecureStore.set(service, key);
}
