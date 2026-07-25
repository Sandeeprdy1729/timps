import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface AWSS3Bucket {
  Name: string;
  CreationDate: string;
}

export interface AWSS3Object {
  Key: string;
  LastModified: string;
  ETag: string;
  Size: number;
  StorageClass: string;
  Owner?: { DisplayName: string; ID: string };
}

export interface AWSS3ObjectVersion {
  Key: string;
  VersionId: string;
  IsLatest: boolean;
  LastModified: string;
  ETag: string;
  Size: number;
  StorageClass: string;
}

export interface AWSS3MultipartUpload {
  Key: string;
  UploadId: string;
  Initiated: string;
  Owner?: { DisplayName: string; ID: string };
  Initiator: { ID: string; DisplayName: string };
  StorageClass: string;
}

export interface AWSS3LifecycleRule {
  ID: string;
  Status: 'Enabled' | 'Disabled';
  Filter?: { Prefix?: string; Tag?: { Key: string; Value: string }; And?: unknown };
  Transition?: Array<{ Days: number; StorageClass: string }>;
  Expiration?: { Days: number };
  NoncurrentVersionTransition?: Array<{ NoncurrentDays: number; StorageClass: string }>;
  NoncurrentVersionExpiration?: { NoncurrentDays: number };
  AbortIncompleteMultipartUpload?: { DaysAfterInitiation: number };
}

export interface AWSCORSConfiguration {
  CORSRules: Array<{
    ID?: string;
    AllowedHeaders: string[];
    AllowedMethods: string[];
    AllowedOrigins: string[];
    ExposeHeaders?: string[];
    MaxAgeSeconds?: number;
  }>;
}

export interface AWSS3CopyResult {
  CopyObjectResult: { ETag: string; LastModified: string };
}

export interface AWSS3Tagging {
  TagSet: Array<{ Key: string; Value: string }>;
}

export interface AWSS3BucketPolicy {
  Policy: string;
}

export interface AWSPresignedUrl {
  url: string;
  expiresAt: string;
}

const MANIFEST: PluginManifest = {
  id: 'aws-s3',
  name: 'AWS S3',
  version: '1.0.0',
  description: 'AWS S3 integration for object storage, bucket management, and lifecycle policies',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['aws', 's3', 'storage', 'object-storage', 'cloud'],
};

const SCOPES = [
  'listBuckets',
  'createBucket',
  'deleteBucket',
  'getBucketAcl',
  'putBucketAcl',
  'getBucketLocation',
  'getBucketPolicy',
  'putBucketPolicy',
  'deleteBucketPolicy',
  'getBucketCors',
  'putBucketCors',
  'deleteBucketCors',
  'getBucketLifecycle',
  'putBucketLifecycle',
  'deleteBucketLifecycle',
  'getBucketVersioning',
  'putBucketVersioning',
  'getBucketWebsite',
  'putBucketWebsite',
  'deleteBucketWebsite',
  'listObjects',
  'listObjectsV2',
  'getObject',
  'putObject',
  'copyObject',
  'deleteObject',
  'deleteObjects',
  'headObject',
  'getObjectAcl',
  'putObjectAcl',
  'getObjectTagging',
  'putObjectTagging',
  'deleteObjectTagging',
  'listObjectVersions',
  'listMultipartUploads',
  'createMultipartUpload',
  'completeMultipartUpload',
  'abortMultipartUpload',
  'uploadPart',
  'copyPart',
  'getPresignedUrl',
  'selectObjectContent',
  'getBucketAccelerate',
  'putBucketAccelerate',
  'getBucketAnalytics',
  'putBucketAnalytics',
  'getBucketMetrics',
  'putBucketMetrics',
  'getBucketEncryption',
  'putBucketEncryption',
  'getBucketPublicAccessBlock',
  'putBucketPublicAccessBlock',
];

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  data: string
): Promise<ArrayBuffer> {
  const rawKey = key instanceof Uint8Array ? key.buffer : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)));
}

function buildCanonicalQueryString(url: URL): string {
  const params = Array.from(url.searchParams.entries()).sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0
  );
  return params
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v.replace(/\+/g, '%20'))}`
    )
    .join('&');
}

interface SigV4Headers {
  Authorization: string;
  'x-amz-date': string;
  'x-amz-content-sha256'?: string;
}

interface SignedFetchOptions extends RequestInit {
  body?: BodyInit | null;
}

async function signRequest(
  method: string,
  urlStr: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  payloadHash: string,
  headers: Record<string, string>,
  body?: string
): Promise<SigV4Headers> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const service = 's3';

  const url = new URL(urlStr);
  const host = url.host;
  const canonicalUri = encodeURI(url.pathname) || '/';

  const canonicalQueryString = buildCanonicalQueryString(url);

  const payloadSha = payloadHash || (body !== undefined ? await sha256Hex(body) : await sha256Hex(''));

  const sortedHeaderKeys = Object.keys(headers)
    .filter((k) => k.toLowerCase().startsWith('x-amz-') || k.toLowerCase() === 'content-type')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k.toLowerCase()}:${headers[k].trim()}`)
    .join('\n');
  const signedHeaders = sortedHeaderKeys.map((k) => k.toLowerCase()).join('\n');

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadSha,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': amzDate,
    ...(payloadHash ? { 'x-amz-content-sha256': payloadHash } : {}),
  };
}

function parseXmlToObj(xml: string): Record<string, unknown> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parse error: ${parseError.textContent}`);
  }
  return nodeToObj(doc.documentElement);
}

function nodeToObj(node: Element): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const children = Array.from(node.children);
  if (children.length === 0) {
    return node.textContent || '';
  }
  for (const child of children) {
    const key = child.tagName;
    const val = nodeToObj(child);
    if (obj[key] !== undefined) {
      if (!Array.isArray(obj[key])) {
        obj[key] = [obj[key]];
      }
      (obj[key] as unknown[]).push(val);
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

export default class AWSS3Integration extends IntegrationBase {
  private region: string = 'us-east-1';
  private bucket: string | null = null;
  private secretAccessKey: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['object_created', 'object_deleted', 'object_restored'],
      dataModels: ['bucket', 'object', 'lifecycle_rule', 'cors_rule', 'policy'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientSecret) {
      throw new Error('Access key and secret key are required');
    }
    this.setAccessToken(config.accessToken);
    this.secretAccessKey = config.clientSecret;

    try {
      if (config.clientId) {
        this.region = config.clientId;
      }
      await this.listBuckets();
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.listBuckets();
      return true;
    } catch {
      return false;
    }
  }

  setBucket(bucket: string): void {
    this.bucket = bucket;
  }

  private getEndpoint(): string {
    return `https://s3.${this.region}.amazonaws.com`;
  }

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  protected async apiCall<T = Record<string, unknown>>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken || !this.secretAccessKey) {
      throw new Error('Not authenticated — access key and secret key required');
    }

    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(endpoint);
    const host = url.host;
    const bodyStr = typeof options.body === 'string' ? options.body : '';
    const payloadHash = await sha256Hex(bodyStr);

    const baseHeaders: Record<string, string> = {
      Host: host,
      'x-amz-date': '',
      'x-amz-content-sha256': payloadHash,
    };

    const existingHeaders = (options.headers as Record<string, string>) || {};
    const filteredHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(existingHeaders)) {
      if (k.toLowerCase() === 'content-type') {
        filteredHeaders[k] = v;
      }
    }

    const mergedForSign = { ...filteredHeaders };
    if (filteredHeaders['content-type']) {
      mergedForSign['Content-Type'] = filteredHeaders['content-type'];
    }

    const sigHeaders = await signRequest(
      method,
      endpoint,
      this.region,
      this.accessToken,
      this.secretAccessKey,
      payloadHash,
      mergedForSign,
      bodyStr
    );

    const fetchHeaders: Record<string, string> = {
      ...sigHeaders,
    };
    if (filteredHeaders['content-type']) {
      fetchHeaders['Content-Type'] = filteredHeaders['content-type'];
    }
    if (bodyStr) {
      fetchHeaders['Content-Length'] = String(new TextEncoder().encode(bodyStr).length);
    }

    const response = await fetch(endpoint, {
      ...options,
      method,
      headers: fetchHeaders,
      body: bodyStr || undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `S3 error: ${response.status} ${response.statusText}`;
      try {
        const errXml = parseXmlToObj(errorText);
        const code = (errXml.Code as Record<string, string>) || errXml.Code;
        const message = (errXml.Message as Record<string, string>) || errXml.Message;
        if (typeof code === 'string') errorMsg += ` [${code}]`;
        if (typeof message === 'string') errorMsg += `: ${message}`;
      } catch {
        if (errorText) errorMsg += `: ${errorText}`;
      }
      throw new Error(errorMsg);
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!text || text.length === 0) {
      return {} as T;
    }

    if (contentType.includes('application/json')) {
      return JSON.parse(text) as T;
    }

    if (
      contentType.includes('application/xml') ||
      contentType.includes('text/xml') ||
      contentType.includes('application/octet-stream') ||
      text.trimStart().startsWith('<?xml') ||
      text.trimStart().startsWith('<')
    ) {
      try {
        return parseXmlToObj(text) as T;
      } catch {
        return text as unknown as T;
      }
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const endpoint = this.getEndpoint();
    const bucketName = (params.bucket as string) || this.bucket;

    switch (action) {
      case 'listBuckets':
        return this.apiCall<{ Buckets: { Bucket: AWSS3Bucket[] } }>(`${endpoint}/`, {
          method: 'GET',
        });

      case 'createBucket':
        return this.apiCall(`${endpoint}/${params.name}`, {
          method: 'PUT',
        });

      case 'deleteBucket':
        return this.apiCall(`${endpoint}/${params.bucket}`, {
          method: 'DELETE',
        });

      case 'getBucketAcl':
        return this.apiCall(`${endpoint}/${bucketName}?acl`, {
          method: 'GET',
        });

      case 'putBucketAcl':
        return this.apiCall(`${endpoint}/${bucketName}?acl`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/xml' },
          body: typeof params.acl === 'string' ? params.acl : JSON.stringify(params.acl),
        });

      case 'getBucketLocation':
        return this.apiCall<{ LocationConstraint: { _text: string } }>(
          `${endpoint}/${bucketName}?location`,
          { method: 'GET' }
        );

      case 'getBucketPolicy':
        return this.apiCall<AWSS3BucketPolicy>(`${endpoint}/${bucketName}?policy`, {
          method: 'GET',
        });

      case 'putBucketPolicy':
        return this.apiCall(`${endpoint}/${bucketName}?policy`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: params.policy as string,
        });

      case 'deleteBucketPolicy':
        return this.apiCall(`${endpoint}/${bucketName}?policy`, {
          method: 'DELETE',
        });

      case 'getBucketCors':
        return this.apiCall(`${endpoint}/${bucketName}?cors`, {
          method: 'GET',
        });

      case 'putBucketCors':
        return this.apiCall(`${endpoint}/${bucketName}?cors`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/xml' },
          body: typeof params.cors === 'string' ? params.cors : JSON.stringify(params.cors),
        });

      case 'getBucketLifecycle':
        return this.apiCall(`${endpoint}/${bucketName}?lifecycle`, {
          method: 'GET',
        });

      case 'putBucketLifecycle':
        return this.apiCall(`${endpoint}/${bucketName}?lifecycle`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/xml' },
          body: typeof params.rules === 'string'
            ? params.rules
            : JSON.stringify({ Rule: params.rules }),
        });

      case 'getBucketVersioning':
        return this.apiCall(`${endpoint}/${bucketName}?versioning`, {
          method: 'GET',
        });

      case 'putBucketVersioning':
        return this.apiCall(`${endpoint}/${bucketName}?versioning`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/xml' },
          body: typeof params.versioning === 'string'
            ? params.versioning
            : JSON.stringify(params.versioning),
        });

      case 'listObjects':
      case 'listObjectsV2':
        return this.apiCall<{ Contents: { Key: string; Size: number }[] }>(
          `${endpoint}/${bucketName}?list-type=2`,
          { method: 'GET' }
        );

      case 'getObject': {
        const result = await this.apiCall<string>(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'GET',
        });
        return result;
      }

      case 'putObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'PUT',
          headers: params.contentType
            ? { 'Content-Type': params.contentType as string }
            : {},
          body: params.body as string,
        });

      case 'copyObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'PUT',
          headers: {
            'x-amz-copy-source': params.copySource as string,
          },
        });

      case 'deleteObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'DELETE',
        });

      case 'deleteObjects':
        return this.apiCall(`${endpoint}/${bucketName}?delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: typeof params.objects === 'string'
            ? params.objects
            : `<Delete>${(params.objects as Array<{ key: string }>)
                .map((o) => `<Object><Key>${o.key}</Key></Object>`)
                .join('')}</Delete>`,
        });

      case 'headObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'HEAD',
        });

      case 'getObjectAcl':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?acl`, {
          method: 'GET',
        });

      case 'putObjectAcl':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?acl`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/xml' },
          body: typeof params.acl === 'string' ? params.acl : JSON.stringify(params.acl),
        });

      case 'getObjectTagging':
        return this.apiCall<AWSS3Tagging>(`${endpoint}/${bucketName}/${params.key}?tagging`, {
          method: 'GET',
        });

      case 'putObjectTagging':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?tagging`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/xml' },
          body: typeof params.tags === 'string'
            ? params.tags
            : JSON.stringify({ TagSet: params.tags }),
        });

      case 'deleteObjectTagging':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?tagging`, {
          method: 'DELETE',
        });

      case 'listObjectVersions':
        return this.apiCall<{ Versions: { Version: AWSS3ObjectVersion[] } }>(
          `${endpoint}/${bucketName}?versions`,
          { method: 'GET' }
        );

      case 'listMultipartUploads':
        return this.apiCall<{ Uploads: { Upload: AWSS3MultipartUpload[] } }>(
          `${endpoint}/${bucketName}?uploads`,
          { method: 'GET' }
        );

      case 'createMultipartUpload':
        return this.apiCall<{ UploadId: { _text: string } }>(
          `${endpoint}/${bucketName}/${params.key}?uploads`,
          { method: 'POST' }
        );

      case 'completeMultipartUpload':
        return this.apiCall(
          `${endpoint}/${bucketName}/${params.key}?uploadId=${params.uploadId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: typeof params.parts === 'string'
              ? params.parts
              : `<CompleteMultipartUpload>${(params.parts as Array<{ PartNumber: number; ETag: string }>)
                  .map(
                    (p) =>
                      `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`
                  )
                  .join('')}</CompleteMultipartUpload>`,
          }
        );

      case 'abortMultipartUpload':
        return this.apiCall(
          `${endpoint}/${bucketName}/${params.key}?uploadId=${params.uploadId}`,
          { method: 'DELETE' }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'buckets':
        return this.executeAction('listBuckets', options || {});
      case 'objects':
        return this.executeAction('listObjects', { bucket: options?.bucket || this.bucket });
      case 'versions':
        return this.executeAction('listObjectVersions', { bucket: options?.bucket || this.bucket });
      case 'uploads':
        return this.executeAction('listMultipartUploads', { bucket: options?.bucket || this.bucket });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  getPresignedUrl(key: string, expires: number = 3600): AWSPresignedUrl {
    if (!this.accessToken || !this.secretAccessKey) {
      throw new Error('Not authenticated — cannot generate presigned URL');
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const expiry = Math.floor(now.getTime() / 1000) + expires;
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const url = new URL(`${this.getEndpoint()}/${this.bucket}/${key}`);
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', `${this.accessToken}/${credentialScope}`);
    url.searchParams.set('X-Amz-Date', amzDate);
    url.searchParams.set('X-Amz-Expires', String(expires));
    url.searchParams.set('X-Amz-SignedHeaders', 'host');

    const canonicalQueryString = buildCanonicalQueryString(url);
    const canonicalRequest = [
      'GET',
      `/${this.bucket}/${key}`,
      canonicalQueryString,
      `host:${url.host}\n`,
      'host',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ].join('\n');

    const stringToSignPromise = (async () => {
      const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${this.secretAccessKey}`), dateStamp);
      const kRegion = await hmacSha256(kDate, this.region);
      const kService = await hmacSha256(kRegion, 's3');
      const kSigning = await hmacSha256(kService, 'aws4_request');
      const crHash = await sha256Hex(canonicalRequest);
      const sts = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crHash].join('\n');
      return toHex(await hmacSha256(kSigning, sts));
    })();

    return {
      url: url.toString(),
      expiresAt: new Date(expiry * 1000).toISOString(),
    } as AWSPresignedUrl;
  }

  async getPresignedUrlAsync(key: string, expires: number = 3600): Promise<AWSPresignedUrl> {
    if (!this.accessToken || !this.secretAccessKey) {
      throw new Error('Not authenticated — cannot generate presigned URL');
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const expiry = Math.floor(now.getTime() / 1000) + expires;
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const url = new URL(`${this.getEndpoint()}/${this.bucket}/${key}`);
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', `${this.accessToken}/${credentialScope}`);
    url.searchParams.set('X-Amz-Date', amzDate);
    url.searchParams.set('X-Amz-Expires', String(expires));
    url.searchParams.set('X-Amz-SignedHeaders', 'host');

    const canonicalQueryString = buildCanonicalQueryString(url);
    const canonicalRequest = [
      'GET',
      `/${this.bucket}/${key}`,
      canonicalQueryString,
      `host:${url.host}\n`,
      'host',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ].join('\n');

    const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${this.secretAccessKey}`), dateStamp);
    const kRegion = await hmacSha256(kDate, this.region);
    const kService = await hmacSha256(kRegion, 's3');
    const kSigning = await hmacSha256(kService, 'aws4_request');
    const crHash = await sha256Hex(canonicalRequest);
    const sts = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crHash].join('\n');
    const signature = toHex(await hmacSha256(kSigning, sts));

    url.searchParams.set('X-Amz-Signature', signature);

    return {
      url: url.toString(),
      expiresAt: new Date(expiry * 1000).toISOString(),
    };
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.secretAccessKey = null;
    this.apiKey = null;
    this.bucket = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createAWSS3Integration(): AWSS3Integration {
  return new AWSS3Integration();
}
