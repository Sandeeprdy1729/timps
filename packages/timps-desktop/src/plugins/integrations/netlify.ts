import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface NetlifySite {
  id: string;
  name: string;
  ssl_url: string;
  url: string;
  admin_url: string;
  github?: { repository_url: string; branch: string; cmd: string };
  ssl: boolean;
  ssl_status?: string;
  force_ssl: boolean;
  deploy_url: string;
  state: 'current' | 'ready' | 'new' | 'errored';
  build_settings?: NetlifyBuildSettings;
}

export interface NetlifyBuildSettings {
  cmd?: string;
  dir?: string;
  framework?: string;
  node_version?: string;
  go_version?: string;
  ruby_version?: string;
  python_version?: string;
  build_image?: string;
}

export interface NetlifyDeploy {
  id: string;
  site_id: string;
  site_name: string;
  state: 'ready' | 'error' | 'building' | 'new';
  branch: string;
  commit_ref: string;
  deploy_time: number;
  created_at: string;
  updated_at: string;
  summary?: string;
  commit_message?: string;
}

export interface NetlifyHook {
  id: string;
  site_id: string;
  type: string;
  name: string;
  url: string;
  active: boolean;
}

export interface NetlifyDNSZone {
  id: string;
  name: string;
  domain: string;
  updated_at?: string;
}

export interface NetlifyDNSRecord {
  id: string;
  zone_id: string;
  hostname: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  value: string;
  priority?: number;
  ttl?: number;
}

export interface NetlifyBuildHook {
  id: string;
  site_id: string;
  branch: string;
  title: string;
  url: string;
}

export interface NetlifySiteMember {
  id: string;
  email: string;
  full_name: string;
  slug?: string;
  avatar_url?: string;
}

const MANIFEST: PluginManifest = {
  id: 'netlify',
  name: 'Netlify',
  version: '1.0.0',
  description: 'Netlify integration for deploying sites, managing DNS, and CI/CD workflows',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['netlify', 'hosting', 'cdn', 'deploy', 'serverless'],
};

const SCOPES = [
  'getSites',
  'getSite',
  'createSite',
  'updateSite',
  'deleteSite',
  'getDeploys',
  'getDeploy',
  'createDeploy',
  'rollbackDeploy',
  'getDeploysByBranch',
  'getFiles',
  'getFile',
  'deleteFile',
  'getHooks',
  'createHook',
  'deleteHook',
  'getBuildHooks',
  'createBuildHook',
  'deleteBuildHook',
  'triggerBuildHook',
  'getDNSZones',
  'getDNSZone',
  'createDNSRecord',
  'updateDNSRecord',
  'deleteDNSRecord',
  'getSiteMembers',
  'addSiteMember',
  'removeSiteMember',
  'getEnvVars',
  'setEnvVar',
  'deleteEnvVar',
  'getServiceInstance',
  'createServiceInstance',
  'updateServiceInstance',
  'deleteServiceInstance',
  'getSnippets',
  'getSnippet',
  'updateSnippet',
  'getSplitTest',
  'createSplitTest',
];

export default class NetlifyIntegration extends IntegrationBase {
  private apiBase = 'https://api.netlify.com/api/v1';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['deploy_created', 'deploy_building', 'deploy_ready', 'deploy_failed', 'split_test_created'],
      dataModels: ['site', 'deploy', 'hook', 'dns_zone', 'dns_record', 'build_hook', 'env_var'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Access token is required');
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

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (action) {
      case 'getSites':
        return this.apiCall<{ sites: NetlifySite[] }>(`${this.apiBase}/sites`, {
          headers,
        });

      case 'getSite':
        return this.apiCall<NetlifySite>(`${this.apiBase}/sites/${params.siteId}`, {
          headers,
        });

      case 'createSite':
        return this.apiCall<NetlifySite>(`${this.apiBase}/sites`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.site),
        });

      case 'updateSite':
        return this.apiCall<NetlifySite>(`${this.apiBase}/sites/${params.siteId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteSite':
        return this.apiCall<{ message: string }>(`${this.apiBase}/sites/${params.siteId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getDeploys':
        return this.apiCall<{ deploys: NetlifyDeploy[] }>(
          `${this.apiBase}/sites/${params.siteId}/deploys`,
          { headers }
        );

      case 'getDeploy':
        return this.apiCall<NetlifyDeploy>(
          `${this.apiBase}/sites/${params.siteId}/deploys/${params.deployId}`,
          { headers }
        );

      case 'createDeploy':
        return this.apiCall<NetlifyDeploy>(
          `${this.apiBase}/sites/${params.siteId}/deploys`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.deploy),
          }
        );

      case 'rollbackDeploy':
        return this.apiCall<NetlifyDeploy>(
          `${this.apiBase}/sites/${params.siteId}/deploys/${params.deployId}/restore`,
          {
            method: 'POST',
            headers,
          }
        );

      case 'getDeploysByBranch':
        return this.apiCall<{ deploys: NetlifyDeploy[] }>(
          `${this.apiBase}/sites/${params.siteId}/deploys`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'getFile':
        return this.apiCall<{ path: string; content: string }>(
          `${this.apiBase}/sites/${params.siteId}/files/${params.path}`,
          { headers }
        );

      case 'getHooks':
        return this.apiCall<{ hooks: NetlifyHook[] }>(
          `${this.apiBase}/sites/${params.siteId}/hooks`,
          { headers }
        );

      case 'createHook':
        return this.apiCall<NetlifyHook>(`${this.apiBase}/sites/${params.siteId}/hooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.hook),
        });

      case 'deleteHook':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/sites/${params.siteId}/hooks/${params.hookId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getBuildHooks':
        return this.apiCall<{ hooks: NetlifyBuildHook[] }>(
          `${this.apiBase}/sites/${params.siteId}/build_hooks`,
          { headers }
        );

      case 'createBuildHook':
        return this.apiCall<NetlifyBuildHook>(
          `${this.apiBase}/sites/${params.siteId}/build_hooks`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.hook),
          }
        );

      case 'deleteBuildHook':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/sites/${params.siteId}/build_hooks/${params.hookId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'triggerBuildHook':
        return this.apiCall<{ deploy_id: string }>(
          `${this.apiBase}/build_hooks/${params.hookId}`,
          {
            method: 'POST',
            headers,
          }
        );

      case 'getDNSZones':
        return this.apiCall<{ zones: NetlifyDNSZone[] }>(`${this.apiBase}/dns_zones`, {
          headers,
        });

      case 'getDNSZone':
        return this.apiCall<{ zone: NetlifyDNSZone }>(`${this.apiBase}/dns_zones/${params.zoneId}`, {
          headers,
        });

      case 'createDNSRecord':
        return this.apiCall<NetlifyDNSRecord>(
          `${this.apiBase}/dns_zones/${params.zoneId}/dns_records`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.record),
          }
        );

      case 'getSiteMembers':
        return this.apiCall<{ members: NetlifySiteMember[] }>(
          `${this.apiBase}/sites/${params.siteId}/members`,
          { headers }
        );

      case 'getEnvVars':
        return this.apiCall<{ site: NetlifySite }>(
          `${this.apiBase}/sites/${params.siteId}/env`,
          { headers }
        );

      case 'setEnvVar':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/sites/${params.siteId}/env/${params.key}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ value: params.value }),
          }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'sites':
        return this.executeAction('getSites', options || {});
      case 'deploys':
        return this.executeAction('getDeploys', { siteId: options?.siteId });
      case 'dns-zones':
        return this.executeAction('getDNSZones', options || {});
      case 'build-hooks':
        return this.executeAction('getBuildHooks', { siteId: options?.siteId });
      case 'hooks':
        return this.executeAction('getHooks', { siteId: options?.siteId });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createNetlifyIntegration(): NetlifyIntegration {
  return new NetlifyIntegration();
}