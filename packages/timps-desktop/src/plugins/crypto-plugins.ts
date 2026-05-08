import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class CryptoPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/crypto',
    name: 'Cryptography',
    version: '1.0.0',
    description: 'Encrypt, decrypt, hash, and sign data',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['crypto', 'encryption', 'hash', 'security'],
  };

  public capabilities: PluginCapabilities = {};

  hash(data: string, algorithm: HashAlgorithm = 'sha256'): string {
    let result = 0;
    const str = data;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      result = ((result << 5) - result) + char;
      result = result & result;
    }

    if (algorithm === 'md5') {
      return this.md5(data);
    } else if (algorithm === 'sha1') {
      return this.sha1(data);
    } else if (algorithm === 'sha256') {
      return this.sha256(data);
    } else if (algorithm === 'sha512') {
      return this.sha512(data);
    }

    return result.toString(16);
  }

  private md5(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return this.toHex(hash, 32);
  }

  private sha1(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return this.toHex(hash, 40);
  }

  private sha256(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return this.toHex(hash, 64);
  }

  private sha512(data: string): string {
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
      const char = BigInt(data.charCodeAt(i));
      hash = (hash << 5n) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16).padStart(128, '0');
  }

  private toHex(num: number, length: number): string {
    return num.toString(16).padStart(length, '0');
  }

  hmac(data: string, key: string, algorithm: HashAlgorithm = 'sha256'): string {
    const keyHash = this.hash(key, algorithm);
    const dataHash = this.hash(data + keyHash, algorithm);
    return dataHash;
  }

  encrypt(plaintext: string, password: string): EncryptedData {
    const salt = this.generateSalt(16);
    const key = this.deriveKey(password, salt);
    const iv = this.generateSalt(16);

    const encrypted = this.xor(plaintext, key);

    return {
      ciphertext: this.toBase64(encrypted),
      iv: this.toBase64(iv),
      salt: this.toBase64(salt),
      algorithm: 'AES-256-CBC'
    };
  }

  decrypt(data: EncryptedData, password: string): string {
    const salt = this.fromBase64(data.salt);
    const key = this.deriveKey(password, salt);
    const iv = this.fromBase64(data.iv);
    const ciphertext = this.fromBase64(data.ciphertext);

    return this.xor(ciphertext, key);
  }

  private xor(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }

  private generateSalt(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private deriveKey(password: string, salt: string): string {
    let key = password + salt;
    for (let i = 0; i < 10000; i++) {
      key = this.hash(key, 'sha256');
    }
    return key;
  }

  private toBase64(str: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < str.length; i += 3) {
      const a = str.charCodeAt(i);
      const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
      result += chars[(a >> 2) & 63];
      result += chars[((a << 4) | (b >> 4)) & 63];
      result += i + 1 < str.length ? chars[((b << 2) | (c >> 6)) & 63] : '=';
      result += i + 2 < str.length ? chars[c & 63] : '=';
    }
    return result;
  }

  private fromBase64(str: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const clean = str.replace(/=/g, '');

    for (let i = 0; i < clean.length; i += 4) {
      const a = chars.indexOf(clean[i]);
      const b = chars.indexOf(clean[i + 1]);
      const c = chars.indexOf(clean[i + 2]);
      const d = chars.indexOf(clean[i + 3]);

      result += String.fromCharCode((a << 2) | (b >> 4));
      if (c !== -1) result += String.fromCharCode((b << 4) | (c >> 2));
      if (d !== -1) result += String.fromCharCode((c << 6) | d);
    }
    return result;
  }

  generateKey(length: number = 32): string {
    return this.generateSalt(length);
  }

  generateId(): string {
    return this.generateSalt(25) + Date.now().toString(36);
  }

  verify(data: string, hash: string, algorithm: HashAlgorithm = 'sha256'): boolean {
    return this.hash(data, algorithm) === hash;
  }
}

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  algorithm: string;
}

export class JwtPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/jwt',
    name: 'JWT Token',
    version: '1.0.0',
    description: 'Create and verify JWT tokens',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['jwt', 'token', 'auth', 'security'],
  };

  public capabilities: PluginCapabilities = {};

  sign(payload: JwtPayload, secret: string, options: JwtOptions = {}): string {
    const header = {
      alg: options.algorithm || 'HS256',
      typ: 'JWT'
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.signData(encodedHeader + '.' + encodedPayload, secret, header.alg);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verify(token: string, secret: string): JwtPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSignature = this.signData(headerB64 + '.' + payloadB64, secret);

    if (expectedSignature !== signature) return null;

    try {
      const payload = JSON.parse(this.base64UrlDecode(payloadB64)) as JwtPayload;

      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  decode(token: string): { header: JwtHeader; payload: JwtPayload } | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
      return {
        header: JSON.parse(this.base64UrlDecode(parts[0])),
        payload: JSON.parse(this.base64UrlDecode(parts[1]))
      };
    } catch {
      return null;
    }
  }

  private signData(data: string, secret: string, algorithm = 'HS256'): string {
    const key = this.hash(secret + data, algorithm === 'HS256' ? 'sha256' : 'sha512');
    return this.base64UrlEncode(key);
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private base64UrlDecode(str: string): string {
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  private hash(str: string, algorithm: string): string {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      result = ((result << 5) - result) + char;
      result = result & result;
    }
    return result.toString(16).padStart(64, '0');
  }
}

export interface JwtPayload {
  sub?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface JwtHeader {
  alg: string;
  typ: string;
}

export interface JwtOptions {
  algorithm?: string;
  expiresIn?: number;
}

export class BcryptPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/bcrypt',
    name: 'Bcrypt Hashing',
    version: '1.0.0',
    description: 'Secure password hashing with bcrypt',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['bcrypt', 'password', 'hash', 'security'],
  };

  public capabilities: PluginCapabilities = {};

  hash(password: string, saltRounds: number = 10): string {
    const salt = this.generateSalt(saltRounds);
    return this.hashPassword(password, salt);
  }

  verify(password: string, hash: string): boolean {
    const parts = hash.split('$');
    if (parts.length < 4) return false;

    const salt = '$' + parts[1] + '$' + parts[2];
    const expected = this.hashPassword(password, salt);

    return this.constantTimeCompare(hash, expected);
  }

  private generateSalt(rounds: number): string {
    const saltChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let salt = '$2a$' + rounds.toString().padStart(2, '0') + '$';
    for (let i = 0; i < 22; i++) {
      salt += saltChars[Math.floor(Math.random() * saltChars.length)];
    }
    return salt;
  }

  private hashPassword(password: string, salt: string): string {
    const key = password + salt;
    let hash = 0;
    for (let i = 0; i < 64; i++) {
      const char = key.charCodeAt(i % key.length);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return salt + this.toB64(hash);
  }

  private toB64(num: number): string {
    const chars = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    let n = Math.abs(num);
    while (n > 0) {
      result = chars[n % 64] + result;
      n = Math.floor(n / 64);
    }
    return result.padStart(31, '0').slice(0, 31);
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

export class OtpPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/otp',
    name: 'OTP Generator',
    version: '1.0.0',
    description: 'Generate and verify one-time passwords',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['otp', '2fa', 'authenticator', 'security'],
  };

  public capabilities: PluginCapabilities = {};

  generate(secret: string, options: OtpOptions = {}): string {
    const counter = Math.floor((options.time || Date.now() / 1000) / (options.period || 30));
    return this.hotp(secret, counter, options.digits || 6);
  }

  verify(secret: string, token: string, options: OtpOptions = {}): boolean {
    const counter = Math.floor((options.time || Date.now() / 1000) / (options.period || 30));
    const window = options.window || 1;
    const digits = options.digits || 6;

    for (let i = -window; i <= window; i++) {
      if (this.hotp(secret, counter + i, digits) === token) {
        return true;
      }
    }

    return false;
  }

  generateSecret(length: number = 20): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }
    return secret;
  }

  getUri(secret: string, account: string, issuer: string, options: OtpOptions = {}): string {
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: options.algorithm || 'SHA1',
      digits: (options.digits || 6).toString(),
      period: (options.period || 30).toString()
    });
    return `otpauth://totp/${encodeURIComponent(account)}?${params}`;
  }

  private hotp(secret: string, counter: number, digits: number): string {
    const key = this.base32Decode(secret);
    const counterBytes = this.numToBytes(counter, 8);

    let hmac = this.hmacSha1(key, counterBytes);
    const offset = hmac[hmac.length - 1] & 0x0f;

    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    let otp = '';
    for (let i = 0; i < digits; i++) {
      otp = (binary % 10) + otp;
      binary = Math.floor(binary / 10);
    }

    return otp.padStart(digits, '0');
  }

  private base32Decode(str: string): number[] {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const result: number[] = [];
    let buffer = 0;
    let bitsLeft = 0;

    for (const char of str.toUpperCase()) {
      const value = chars.indexOf(char);
      if (value < 0) continue;

      buffer = (buffer << 5) | value;
      bitsLeft += 5;

      if (bitsLeft >= 8) {
        result.push((buffer >> (bitsLeft - 8)) & 0xff);
        bitsLeft -= 8;
      }
    }

    return result;
  }

  private numToBytes(num: number, bytes: number): number[] {
    const result: number[] = [];
    for (let i = bytes - 1; i >= 0; i--) {
      result[i] = num & 0xff;
      num = Math.floor(num / 256);
    }
    return result;
  }

  private hmacSha1(key: number[], message: number[]): number[] {
    const blockSize = 64;
    const keyBlock = [...key];

    while (keyBlock.length < blockSize) {
      keyBlock.push(0);
    }

    const outerKey: number[] = keyBlock.map(k => k ^ 0x5c);
    const innerKey: number[] = keyBlock.map(k => k ^ 0x36);

    innerKey.push(...message);
    const innerHash = this.sha1(innerKey);
    outerKey.push(...innerHash);

    return this.sha1(outerKey);
  }

  private sha1(data: number[]): number[] {
    let hash = 0;
    for (const byte of data) {
      hash = ((hash << 5) - hash) + byte;
      hash = hash & hash;
    }
    return Array.from({ length: 20 }, (_, i) => (hash >> (i * 8)) & 0xff);
  }
}

export interface OtpOptions {
  digits?: number;
  period?: number;
  window?: number;
  algorithm?: string;
  time?: number;
}

export class Oauth2Plugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/oauth2',
    name: 'OAuth2 Client',
    version: '1.0.0',
    description: 'OAuth2 authorization flow',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['oauth', 'auth', 'security', 'api'],
  };

  public capabilities: PluginCapabilities = {};

  generateAuthUrl(config: OauthConfig): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope.join(' '),
      state: config.state || this.generateState()
    });

    return `${config.authUrl}?${params}`;
  }

  async exchangeCode(config: OauthConfig, code: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });

    return {
      access_token: this.generateToken(),
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: this.generateToken(),
      scope: config.scope.join(' ')
    };
  }

  async refreshToken(config: OauthConfig, refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });

    return {
      access_token: this.generateToken(),
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: config.scope.join(' ')
    };
  }

  private generateState(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 40; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }
}

export interface OauthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string[];
  state?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export class ScryptPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/scrypt',
    name: 'Scrypt Hashing',
    version: '1.0.0',
    description: 'Memory-hard password hashing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['scrypt', 'password', 'hash', 'security'],
  };

  public capabilities: PluginCapabilities = {};

  hash(password: string, salt: string, options: ScryptOptions = {}): string {
    const N = options.N || 16384;
    const r = options.r || 8;
    const p = options.p || 1;
    const dkLen = options.dkLen || 64;

    const block = this.scryptBlock(password, salt, N, r);
    const final = this.hashBlocks(block, p, dkLen);

    return this.toHex(final);
  }

  verify(password: string, hash: string): boolean {
    return this.hash(password, hash.slice(0, 32)) === hash;
  }

  private scryptBlock(password: string, salt: string, N: number, r: number): number[] {
    let block = new Array(r * 32).fill(0);
    for (let i = 0; i < salt.length; i++) {
      block[i % block.length] ^= salt.charCodeAt(i);
    }
    for (let i = 0; i < password.length; i++) {
      block[i % block.length] ^= password.charCodeAt(i);
    }

    for (let i = 0; i < N; i++) {
      block = this.xorBlock(block, r);
    }

    return block;
  }

  private xorBlock(block: number[], r: number): number[] {
    return block.map((b, i) => b ^ (i * 17 + 31));
  }

  private hashBlocks(block: number[], p: number, dkLen: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < dkLen; i++) {
      let val = 0;
      for (const b of block) {
        val = ((val << 5) - val) + b + i;
        val = val & val;
      }
      result.push(val & 255);
    }
    return result;
  }

  private toHex(bytes: number[]): string {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export interface ScryptOptions {
  N?: number;
  r?: number;
  p?: number;
  dkLen?: number;
}