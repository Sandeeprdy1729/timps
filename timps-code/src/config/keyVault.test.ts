import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted, reEncryptAll } from './keyVault.js';

describe('KeyVault', () => {
  it('encrypts and decrypts a string', () => {
    const original = 'sk-test-api-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toMatch(/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertexts for same plaintext', () => {
    const original = 'same-key';
    const a = encrypt(original);
    const b = encrypt(original);
    expect(a).not.toBe(b);
  });

  it('detects encrypted strings', () => {
    expect(isEncrypted(encrypt('test'))).toBe(true);
    expect(isEncrypted('plaintext-key')).toBe(false);
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted('sk-proj-openai')).toBe(false);
  });

  it('reEncryptAll converts plaintext to encrypted', () => {
    const keys = { openai: 'sk-openai', anthropic: 'sk-anthropic' };
    const result = reEncryptAll(keys);
    expect(isEncrypted(result.openai)).toBe(true);
    expect(isEncrypted(result.anthropic)).toBe(true);
    expect(decrypt(result.openai)).toBe('sk-openai');
  });

  it('reEncryptAll skips already encrypted values', () => {
    const encrypted = encrypt('already-encrypted');
    const keys = { openai: encrypted, claude: 'plain' };
    const result = reEncryptAll(keys);
    expect(result.openai).toBe(encrypted);
    expect(isEncrypted(result.claude)).toBe(true);
    expect(decrypt(result.claude)).toBe('plain');
  });

  it('throws on decrypting invalid payload', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted payload');
    expect(() => decrypt('a:b:c')).toThrow();
  });
});
