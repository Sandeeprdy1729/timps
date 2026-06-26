// ── Object Storage Abstraction ──
// Phase 6d: Multi-Modal Memory — local-first with optional S3 support
// S3 support is opt-in; without it, all storage is local filesystem.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';

export interface StoredObject {
  id: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: number;
  lastAccessed: number;
  checksum: string;
  metadata: Record<string, string>;
}

export interface ObjectStorageConfig {
  baseDir?: string;
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
}

interface ObjectIndexEntry {
  id: string;
  localPath: string;
  size: number;
  mimeType: string;
  createdAt: number;
  lastAccessed: number;
  checksum: string;
  metadata: Record<string, string>;
}

export class ObjectStorage {
  private baseDir: string;
  private index: Map<string, ObjectIndexEntry> = new Map();
  private indexFile: string;
  private s3Config: ObjectStorageConfig['s3'] | null = null;
  private s3Client: any = null;

  constructor(config: ObjectStorageConfig = {}) {
    this.baseDir = config.baseDir ?? path.join(os.homedir(), '.timps', 'objects');
    this.indexFile = path.join(this.baseDir, 'index.json');
    this.s3Config = config.s3 ?? null;
    fs.mkdirSync(this.baseDir, { recursive: true });
    this.loadIndex();
    if (this.s3Config) {
      this.initS3();
    }
  }

  private async initS3(): Promise<void> {
    try {
      const { S3Client } = await requireS3();
      this.s3Client = new S3Client({
        region: this.s3Config!.region,
        endpoint: this.s3Config!.endpoint,
        credentials: {
          accessKeyId: this.s3Config!.accessKeyId,
          secretAccessKey: this.s3Config!.secretAccessKey,
        },
      });
    } catch {
      this.s3Client = null;
    }
  }

  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = JSON.parse(fs.readFileSync(this.indexFile, 'utf-8')) as ObjectIndexEntry[];
        for (const entry of data) {
          this.index.set(entry.id, entry);
        }
      }
    } catch {}
  }

  private saveIndex(): void {
    const data = Array.from(this.index.values());
    fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
  }

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private computeChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async store(
    data: Buffer | string,
    options: {
      mimeType?: string;
      metadata?: Record<string, string>;
      prefix?: string;
    } = {}
  ): Promise<StoredObject> {
    const id = this.generateId();
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const checksum = this.computeChecksum(buffer);
    const prefix = options.prefix ? `${options.prefix}/` : '';
    const ext = this.mimeToExt(options.mimeType || 'application/octet-stream');
    const fileName = `${prefix}${id}${ext}`;
    const filePath = path.join(this.baseDir, fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);

    const now = Date.now();
    const entry: ObjectIndexEntry = {
      id,
      localPath: fileName,
      size: buffer.length,
      mimeType: options.mimeType || 'application/octet-stream',
      createdAt: now,
      lastAccessed: now,
      checksum,
      metadata: options.metadata || {},
    };

    this.index.set(id, entry);
    this.saveIndex();

    if (this.s3Client && this.s3Config) {
      await this.storeToS3(id, buffer, entry.mimeType).catch(() => {});
    }

    return { ...entry, path: filePath };
  }

  async retrieve(id: string): Promise<StoredObject | null> {
    const entry = this.index.get(id);
    if (!entry) return null;

    const filePath = path.join(this.baseDir, entry.localPath);
    if (!fs.existsSync(filePath)) {
      if (this.s3Client) {
        await this.retrieveFromS3(id, filePath).catch(() => {});
      }
      if (!fs.existsSync(filePath)) return null;
    }

    entry.lastAccessed = Date.now();
    this.saveIndex();

    return { ...entry, path: filePath };
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.index.get(id);
    if (!entry) return false;

    const filePath = path.join(this.baseDir, entry.localPath);
    try { fs.unlinkSync(filePath); } catch {}

    this.index.delete(id);
    this.saveIndex();

    if (this.s3Client && this.s3Config) {
      await this.deleteFromS3(id).catch(() => {});
    }

    return true;
  }

  list(prefix?: string): StoredObject[] {
    const entries = Array.from(this.index.values());
    const filtered = prefix
      ? entries.filter(e => e.localPath.startsWith(prefix))
      : entries;

    return filtered.map(e => ({ ...e, path: path.join(this.baseDir, e.localPath) }));
  }

  getStats(): { totalObjects: number; totalSize: number; oldestObject: number; newestObject: number } {
    const entries = Array.from(this.index.values());
    if (entries.length === 0) {
      return { totalObjects: 0, totalSize: 0, oldestObject: 0, newestObject: 0 };
    }

    return {
      totalObjects: entries.length,
      totalSize: entries.reduce((s, e) => s + e.size, 0),
      oldestObject: Math.min(...entries.map(e => e.createdAt)),
      newestObject: Math.max(...entries.map(e => e.createdAt)),
    };
  }

  async getObjectPath(id: string): Promise<string | null> {
    const entry = this.index.get(id);
    if (!entry) return null;
    const filePath = path.join(this.baseDir, entry.localPath);
    if (fs.existsSync(filePath)) return filePath;
    if (this.s3Client) {
      await this.retrieveFromS3(id, filePath).catch(() => {});
      return fs.existsSync(filePath) ? filePath : null;
    }
    return null;
  }

  idFromPath(filePath: string): string | null {
    for (const [id, entry] of this.index) {
      if (path.join(this.baseDir, entry.localPath) === filePath) return id;
    }
    return null;
  }

  private async storeToS3(id: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (!this.s3Client || !this.s3Config) return;
    const { PutObjectCommand } = await requireS3();
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: `objects/${id}`,
      Body: buffer,
      ContentType: mimeType,
    }));
  }

  private async retrieveFromS3(id: string, localPath: string): Promise<void> {
    if (!this.s3Client || !this.s3Config) return;
    const { GetObjectCommand } = await requireS3();
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: `objects/${id}`,
    }));
    const body = await response.Body.transformToByteArray();
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, Buffer.from(body));
  }

  private async deleteFromS3(id: string): Promise<void> {
    if (!this.s3Client || !this.s3Config) return;
    const { DeleteObjectCommand } = await requireS3();
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.s3Config.bucket,
      Key: `objects/${id}`,
    }));
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'audio/wav': '.wav',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'text/plain': '.txt',
      'text/markdown': '.md',
      'application/json': '.json',
      'application/pdf': '.pdf',
    };
    return map[mime] || '.bin';
  }
}

async function requireS3(): Promise<any> {
  return require('@aws-sdk/client-s3');
}
