import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  productionDeployment: VercelDeployment | null;
  target?: string;
  url: string;
  updatedAt: number;
  createdAt: number;
}

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  expires: number;
  readyState: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'READY' | 'QUEUED' | 'READIED';
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'READY' | 'QUEUED' | 'CANCELED';
  type: 'LAMBDAS' | 'CROSSLOT';
  metadata: { githubCommitRef?: string; githubCommitMessage?: string };
}

export interface VercelDomain {
  uid: string;
  name: string;
  apexName: string;
  projectId: string;
  deploymentId: string;
  redirect?: string;
  renewedAt?: number;
  createdAt?: number;
  expiresAt?: number;
}

export interface VercelDNSRecord {
  id: string;
  slug: string;
  type: 'A' | 'AAAA' | 'ALIAS' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  priority?: number;
  weight?: number;
}

export interface VercelDNSZone {
  id: string;
  name: string;
  apexName: string;
  type: string;
  records: VercelDNSRecord[];
}

export interface VercelAlias {
  alias: string;
  deploymentUid: string;
  createdAt: number;
}

export interface VercelUser {
  uid: string;
  email: string;
  name: string;
  username: string;
  avatar: string;
}

export interface VercelTeam {
  uid: string;
  name: string;
  slug: string;
  avatar: string;
}

export interface VercelSecret {
  uid: string;
  name: string;
  Created: string;
  createdAt: number;
}

const MANIFEST: PluginManifest = {
  id: 'vercel',
  name: 'Vercel',
  version: '1.0.0',
  description: 'Vercel integration for deploying Next.js apps, managing domains, and serverless functions',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['vercel', 'nextjs', 'serverless', 'hosting', 'cdn'],
};

const SCOPES = [
  'getProjects',
  'getProject',
  'createProject',
  'updateProject',
  'deleteProject',
  'getDeployments',
  'getDeployment',
  'createDeployment',
  'cancelDeployment',
  'getDeploymentEvents',
  'getDomains',
  'getDomain',
  'createDomain',
  'deleteDomain',
  'getAliases',
  'createAlias',
  'deleteAlias',
  'getDNSRecords',
  'createDNSRecord',
  'deleteDNSRecord',
  'getDNSZone',
  'getEnvVars',
  'setEnvVar',
  'deleteEnvVar',
  'getSecrets',
  'createSecret',
  'deleteSecret',
  'getEdgeConfig',
  'createEdgeConfig',
  'updateEdgeConfig',
  'deleteEdgeConfig',
  'getFunctions',
  'getFunction',
  'getLogs',
  'getEvents',
  'getAnalytics',
  'createDeployHook',
  'getDeployHooks',
  'deleteDeployHook',
  'getTeam',
  'getMembers',
  'inviteMember',
  'removeMember',
];

export default class VercelIntegration extends IntegrationBase {
  private apiBase = 'https://api.vercel.com/v6';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['deployment_ready', 'deployment_error', 'deployment_canceled', 'alias_created', 'domain_created'],
      dataModels: ['project', 'deployment', 'domain', 'deployment', 'alias', 'dns_zone', 'env_var'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Access token is required');
    }
    this.setAccessToken(config.accessToken);

    try {
      const user = await this.apiCall<VercelUser>(`${this.apiBase}/user`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!user.uid;
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
      case 'getProjects':
        return this.apiCall<{ projects: VercelProject[] }>('/projects', {
          headers,
        });

      case 'getProject':
        return this.apiCall<VercelProject>(`/projects/${params.projectId}`, {
          headers,
        });

      case 'createProject':
        return this.apiCall<VercelProject>('/projects', {
          method: 'POST',
          headers,
          body: JSON.stringify(params.project),
        });

      case 'updateProject':
        return this.apiCall<VercelProject>(`/projects/${params.projectId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteProject':
        return this.apiCall<{ message: string }>(`/projects/${params.projectId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getDeployments':
        return this.apiCall<{ deployments: VercelDeployment[] }>(
          `/deployments?projectId=${params.projectId}`,
          { headers }
        );

      case 'getDeployment':
        return this.apiCall<VercelDeployment>(`/deployments/${params.deploymentId}`, {
          headers,
        });

      case 'createDeployment':
        return this.apiCall<VercelDeployment>('/deployments', {
          method: 'POST',
          headers,
          body: JSON.stringify(params.deployment),
        });

      case 'cancelDeployment':
        return this.apiCall<VercelDeployment>(
          `/deployments/${params.deploymentId}/cancel`,
          {
            method: 'PATCH',
            headers,
          }
        );

      case 'getDomains':
        return this.apiCall<{ domains: VercelDomain[] }>(
          `/domains?projectId=${params.projectId}`,
          { headers }
        );

      case 'getDomain':
        return this.apiCall<VercelDomain>(`/domains/${params.domain}`, {
          headers,
        });

      case 'createDomain':
        return this.apiCall<VercelDomain>('/domains', {
          method: 'POST',
          headers,
          body: JSON.stringify(params.domain),
        });

      case 'deleteDomain':
        return this.apiCall<{ message: string }>(
          `/domains/${params.domain}?projectId=${params.projectId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getAliases':
        return this.apiCall<{ aliases: VercelAlias[] }>(
          `/aliases?projectId=${params.projectId}`,
          { headers }
        );

      case 'createAlias':
        return this.apiCall<VercelAlias>('/aliases', {
          method: 'POST',
          headers,
          body: JSON.stringify(params.alias),
        });

      case 'getDNSRecords':
        return this.apiCall<{ records: VercelDNSRecord[] }>(
          `/domains/${params.domain}/records`,
          { headers }
        );

      case 'createDNSRecord':
        return this.apiCall<VercelDNSRecord>(
          `/domains/${params.domain}/records`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.record),
          }
        );

      case 'getDNSZone':
        return this.apiCall<VercelDNSZone>(`/domains/${params.domain}/config`, {
          headers,
        });

      case 'getEnvVars':
        return this.apiCall<{ envs: unknown[] }>(
          `/env?projectId=${params.projectId}`,
          { headers }
        );

      case 'setEnvVar':
        return this.apiCall(
          `/env?projectId=${params.projectId}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.env),
          }
        );

      case 'getSecrets':
        return this.apiCall<{ secrets: VercelSecret[] }>('/secrets', {
          headers,
        });

      case 'createSecret':
        return this.apiCall<VercelSecret>('/secrets', {
          method: 'POST',
          headers,
          body: JSON.stringify(params.secret),
        });

      case 'getDeployHooks':
        return this.apiCall<{ hooks: unknown[] }>(
          `/deploy-hooks?projectId=${params.projectId}`,
          { headers }
        );

      case 'createDeployHook':
        return this.apiCall('/deploy-hooks', {
          method: 'POST',
          headers,
          body: JSON.stringify(params.hook),
        });

      case 'getAnalytics':
        return this.apiCall(
          `/analytics/${params.projectId}/aggregated`,
          { headers }
        );

      case 'getEvents':
        return this.apiCall(
          `/v2/projectevents?projectId=${params.projectId}`,
          { headers }
        );

      case 'getTeam':
        return this.apiCall<VercelTeam>(`/teams/${params.teamId}`, {
          headers,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'projects':
        return this.executeAction('getProjects', options || {});
      case 'deployments':
        return this.executeAction('getDeployments', { projectId: options?.projectId });
      case 'domains':
        return this.executeAction('getDomains', { projectId: options?.projectId });
      case 'aliases':
        return this.executeAction('getAliases', { projectId: options?.projectId });
      case 'env-vars':
        return this.executeAction('getEnvVars', { projectId: options?.projectId });
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

export function createVercelIntegration(): VercelIntegration {
  return new VercelIntegration();
}