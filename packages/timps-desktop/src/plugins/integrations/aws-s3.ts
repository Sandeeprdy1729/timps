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
  Transition?: Array<{ Days: number; StorageClass: string }];
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

export default class AWSS3Integration extends IntegrationBase {
  private region: string = 'us-east-1';
  private bucket: string | null = null;

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
    this.setApiKey(config.clientSecret);

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

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const endpoint = this.getEndpoint();
    const bucketName = params.bucket || this.bucket;

    switch (action) {
      case 'listBuckets':
        return this.apiCall<{ Buckets: AWSS3Bucket[] }>(`${endpoint}/`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'createBucket':
        return this.apiCall(`${endpoint}/${params.name}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
        });

      case 'deleteBucket':
        return this.apiCall(`${endpoint}/${params.bucket}`, {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        });

      case 'getBucketAcl':
        return this.apiCall(`${endpoint}/${bucketName}?acl`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putBucketAcl':
        return this.apiCall(`${endpoint}/${bucketName}?acl`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(params.acl),
        });

      case 'getBucketLocation':
        return this.apiCall<{ LocationConstraint: string }>(`${endpoint}/${bucketName}?location`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'getBucketPolicy':
        return this.apiCall<AWSS3BucketPolicy>(`${endpoint}/${bucketName}?policy`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putBucketPolicy':
        return this.apiCall(`${endpoint}/${bucketName}?policy`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: params.policy as string,
        });

      case 'deleteBucketPolicy':
        return this.apiCall(`${endpoint}/${bucketName}?policy`, {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        });

      case 'getBucketCors':
        return this.apiCall<AWSCORSConfiguration>(`${endpoint}/${bucketName}?cors`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putBucketCors':
        return this.apiCall(`${endpoint}/${bucketName}?cors`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(params.cors),
        });

      case 'getBucketLifecycle':
        return this.apiCall(`${endpoint}/${bucketName}?lifecycle`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putBucketLifecycle':
        return this.apiCall(`${endpoint}/${bucketName}?lifecycle`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ Rule: params.rules }),
        });

      case 'getBucketVersioning':
        return this.apiCall(`${endpoint}/${bucketName}?versioning`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putBucketVersioning':
        return this.apiCall(`${endpoint}/${bucketName}?versioning`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(params.versioning),
        });

      case 'listObjects':
      case 'listObjectsV2':
        return this.apiCall<{ Contents: AWSS3Object[] }>(
          `${endpoint}/${bucketName}?list-type=2`,
          {
            method: 'GET',
            headers: this.getAuthHeaders(),
          }
        );

      case 'getObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: params.body as string,
        });

      case 'copyObject':
        return this.apiCall<AWSS3CopyResult>(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ CopySource: params.copySource }),
        });

      case 'deleteObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        });

      case 'deleteObjects':
        return this.apiCall(`${endpoint}/${bucketName}?delete`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ Object: params.objects }),
        });

      case 'headObject':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}`, {
          method: 'HEAD',
          headers: this.getAuthHeaders(),
        });

      case 'getObjectAcl':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?acl`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putObjectAcl':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?acl`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(params.acl),
        });

      case 'getObjectTagging':
        return this.apiCall<AWSS3Tagging>(`${endpoint}/${bucketName}/${params.key}?tagging`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

      case 'putObjectTagging':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?tagging`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ Tagging: params.tags }),
        });

      case 'deleteObjectTagging':
        return this.apiCall(`${endpoint}/${bucketName}/${params.key}?tagging`, {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        });

      case 'listObjectVersions':
        return this.apiCall<{ Versions: AWSS3ObjectVersion[] }>(
          `${endpoint}/${bucketName}?versions`,
          {
            method: 'GET',
            headers: this.getAuthHeaders(),
          }
        );

      case 'listMultipartUploads':
        return this.apiCall<{ Upload: AWSS3MultipartUpload[] }>(
          `${endpoint}/${bucketName}?uploads`,
          {
            method: 'GET',
            headers: this.getAuthHeaders(),
          }
        );

      case 'createMultipartUpload':
        return this.apiCall<{ UploadId: string }>(
          `${endpoint}/${bucketName}/${params.key}?uploads`,
          {
            method: 'POST',
            headers: this.getAuthHeaders(),
          }
        );

      case 'completeMultipartUpload':
        return this.apiCall(
          `${endpoint}/${bucketName}/${params.key}?uploadId=${params.uploadId}`,
          {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(params.parts),
          }
        );

      case 'abortMultipartUpload':
        return this.apiCall(
          `${endpoint}/${bucketName}/${params.key}?uploadId=${params.uploadId}`,
          {
            method: 'DELETE',
            headers: this.getAuthHeaders(),
          }
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
    const expiration = Math.floor(Date.now() / 1000) + expires;
    return {
      url: `${this.getEndpoint()}/${this.bucket}/${key}?Expires=${expiration}`,
      expiresAt: new Date(expiration * 1000).toISOString(),
    };
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
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