import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  plan: { name: string; price: number };
  permissions: string[];
}

export interface CloudflareDNSRecord {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'SPF' | 'SRV' | 'CAA';
  name: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
}

export interface CloudflarePageRule {
  id: string;
  targets: Array<{ target: string; constraint: { operator: string; value: string } }>;
  actions: Array<{ id: string; value: unknown }>;
  priority: number;
  status: string;
}

export interface CloudflareWorker {
  id: string;
  script: string;
  etag: string;
  modified_on: string;
  created_on: string;
}

export interface CloudflareWorkerRoute {
  id: string;
  pattern: string;
  script_name?: string;
}

export interface CloudflareWorkerSecret {
  name: string;
  text: string;
  secret_text: string;
  namespace_id?: string;
}

export interface CloudflareLoadBalancer {
  id: string;
  name: string;
  description: string;
 enabled: boolean;
  protonly: boolean;
  fallback_pool: string;
  default_pools: string[];
  region_pools: Record<string, string[]>;
}

export interface CloudflareRateLimit {
  id: string;
  disabled: boolean;
  description: string;
  match: { http_version: string; method: string; scheme: string; url: string };
  visit: { limit: number; period: number; concurrently: boolean };
  response: { content_type: string;_body?: string; status: number };
}

export interface CloudflareAccessPolicy {
  id: string;
  name: string;
  decision: string;
  include: Array<{ email: { email: string } }>;
  exclude: unknown[];
  require: unknown[];
}

export interface CloudflareCertificate {
  id: string;
  issuer: string;
  signature: string;
  status: string;
  validity_requests: number;
  expires_on: string;
  uploaded_on: string;
  notes: string;
}

const MANIFEST: PluginManifest = {
  id: 'cloudflare',
  name: 'Cloudflare',
  version: '1.0.0',
  description: 'Cloudflare integration for DNS, CDN, Workers, and edge computing',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['cloudflare', 'dns', 'cdn', 'workers', 'security'],
};

const SCOPES = [
  'listZones',
  'createZone',
  'getZone',
  'deleteZone',
  'getZoneSettings',
  'updateZoneSettings',
  'getDNSRecords',
  'createDNSRecord',
  'updateDNSRecord',
  'deleteDNSRecord',
  'getPageRules',
  'createPageRule',
  'updatePageRule',
  'deletePageRule',
  'getWorkers',
  'createWorker',
  'updateWorker',
  'deleteWorker',
  'getWorkerRoutes',
  'createWorkerRoute',
  'updateWorkerRoute',
  'deleteWorkerRoute',
  'getWorkerSecrets',
  'createWorkerSecret',
  'deleteWorkerSecret',
  'getLoadBalancers',
  'createLoadBalancer',
  'updateLoadBalancer',
  'deleteLoadBalancer',
  'getRateLimits',
  'createRateLimit',
  'updateRateLimit',
  'deleteRateLimit',
  'getAccessPolicies',
  'createAccessPolicy',
  'updateAccessPolicy',
  'deleteAccessPolicy',
  'getCustomCertificates',
  'createCustomCertificate',
  'updateCustomCertificate',
  'deleteCustomCertificate',
  'getWAFRules',
  'updateWAFRule',
  'getFirewallRules',
  'createFirewallRule',
  'deleteFirewallRule',
  'purgeCache',
  'getAnalytics',
  'getIPs',
];

export default class CloudflareIntegration extends IntegrationBase {
  private apiBase = 'https://api.cloudflare.com/client/v4';
  private zoneId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['dns_changed', 'worker_created', 'worker_changed', 'firewall_changed'],
      dataModels: ['zone', 'dns_record', 'page_rule', 'worker', 'load_balancer', 'rate_limit', 'access_policy'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('API token is required');
    }
    this.setAccessToken(config.accessToken);

    try {
      const user = await this.apiCall<{ email: string }>(`${this.apiBase}/user`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!user.email;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/user`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const headers = this.getAuthHeaders();

    switch (action) {
      case 'listZones':
        return this.apiCall<{ result: CloudflareZone[] }>(`${this.apiBase}/zones`, {
          headers,
        });

      case 'createZone':
        return this.apiCall<{ result: CloudflareZone }>(`${this.apiBase}/zones`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: params.name, type: params.type }),
        });

      case 'getZone':
        return this.apiCall<{ result: CloudflareZone }>(`${this.apiBase}/zones/${params.zoneId}`, {
          headers,
        });

      case 'getZoneSettings':
        return this.apiCall<{ result: unknown }>(
          `${this.apiBase}/zones/${params.zoneId}/settings`,
          { headers }
        );

      case 'updateZoneSettings':
        return this.apiCall(
          `${this.apiBase}/zones/${params.zoneId}/settings`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(params.updates),
          }
        );

      case 'getDNSRecords':
        return this.apiCall<{ result: CloudflareDNSRecord[] }>(
          `${this.apiBase}/zones/${params.zoneId}/dns_records`,
          { headers }
        );

      case 'createDNSRecord':
        return this.apiCall<{ result: CloudflareDNSRecord }>(
          `${this.apiBase}/zones/${params.zoneId}/dns_records`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.record),
          }
        );

      case 'updateDNSRecord':
        return this.apiCall<{ result: CloudflareDNSRecord }>(
          `${this.apiBase}/zones/${params.zoneId}/dns_records/${params.recordId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(params.record),
          }
        );

      case 'deleteDNSRecord':
        return this.apiCall(
          `${this.apiBase}/zones/${params.zoneId}/dns_records/${params.recordId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getPageRules':
        return this.apiCall<{ result: CloudflarePageRule[] }>(
          `${this.apiBase}/zones/${params.zoneId}/pagerules`,
          { headers }
        );

      case 'createPageRule':
        return this.apiCall<{ result: CloudflarePageRule }>(
          `${this.apiBase}/zones/${params.zoneId}/pagerules`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.pagerule),
          }
        );

      case 'updatePageRule':
        return this.apiCall<{ result: CloudflarePageRule }>(
          `${this.apiBase}/zones/${params.zoneId}/pagerules/${params.ruleId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(params.pagerule),
          }
        );

      case 'deletePageRule':
        return this.apiCall(
          `${this.apiBase}/zones/${params.zoneId}/pagerules/${params.ruleId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getWorkers':
        return this.apiCall<{ result: CloudflareWorker[] }>(
          `${this.apiBase}/zones/${params.zoneId}/workers/routes`,
          { headers }
        );

      case 'createWorker':
        return this.apiCall<{ result: CloudflareWorker }>(
          `${this.apiBase}/zones/${params.zoneId}/workers/scripts`,
          {
            method: 'PUT',
            headers,
            body: params.script as string,
          }
        );

      case 'getWorkerRoutes':
        return this.apiCall<{ result: CloudflareWorkerRoute[] }>(
          `${this.apiBase}/zones/${params.zoneId}/workers/routes`,
          { headers }
        );

      case 'createWorkerRoute':
        return this.apiCall<{ result: CloudflareWorkerRoute }>(
          `${this.apiBase}/zones/${params.zoneId}/workers/routes`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.route),
          }
        );

      case 'getLoadBalancers':
        return this.apiCall<{ result: CloudflareLoadBalancer[] }>(
          `${this.apiBase}/zones/${params.zoneId}/load_balancers`,
          { headers }
        );

      case 'createLoadBalancer':
        return this.apiCall<{ result: CloudflareLoadBalancer }>(
          `${this.apiBase}/zones/${params.zoneId}/load_balancers`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.loadbalancer),
          }
        );

      case 'getRateLimits':
        return this.apiCall<{ result: CloudflareRateLimit[] }>(
          `${this.apiBase}/zones/${params.zoneId}/rate_limits`,
          { headers }
        );

      case 'createRateLimit':
        return this.apiCall<{ result: CloudflareRateLimit }>(
          `${this.apiBase}/zones/${params.zoneId}/rate_limits`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.ratelimit),
          }
        );

      case 'getAccessPolicies':
        return this.apiCall<{ result: CloudflareAccessPolicy[] }>(
          `${this.apiBase}/zones/${params.zoneId}/access/policies`,
          { headers }
        );

      case 'createAccessPolicy':
        return this.apiCall<{ result: CloudflareAccessPolicy }>(
          `${this.apiBase}/zones/${params.zoneId}/access/policies`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.policy),
          }
        );

      case 'purgeCache':
        return this.apiCall(
          `${this.apiBase}/zones/${params.zoneId}/purge_cache`,
          {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ everything: true }),
          }
        );

      case 'getCustomCertificates':
        return this.apiCall<{ result: CloudflareCertificate[] }>(
          `${this.apiBase}/certificates`,
          { headers }
        );

      case 'getIPs':
        return this.apiCall<{ ipv4: string[]; ipv6: string[] }>(
          `${this.apiBase}/ips`,
          { headers }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'zones':
        return this.executeAction('listZones', options || {});
      case 'dns-records':
        return this.executeAction('getDNSRecords', { zoneId: options?.zoneId });
      case 'page-rules':
        return this.executeAction('getPageRules', { zoneId: options?.zoneId });
      case 'workers':
        return this.executeAction('getWorkers', { zoneId: options?.zoneId });
      case 'load-balancers':
        return this.executeAction('getLoadBalancers', { zoneId: options?.zoneId });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.zoneId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createCloudflareIntegration(): CloudflareIntegration {
  return new CloudflareIntegration();
}