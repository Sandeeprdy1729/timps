import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  createdAt?: string;
  expires: number;
  expiresAt?: string;
  readyState: VercelDeploymentState;
  state: VercelDeploymentState;
  type: 'LAMBDAS' | 'CROSSLOT' | 'FILES' | 'k8s';
  metadata: VercelDeploymentMetadata;
  version: number;
  regions?: string[];
  build?: VercelBuildInfo;
  meta: Record<string, string>;
}

export type VercelDeploymentState = 
  | 'BUILDING'
  | 'ERROR'
  | 'INITIALIZING'
  | 'READY'
  | 'QUEUED'
  | 'CANCELED'
  | 'READY';

export interface VercelDeploymentMetadata {
  githubCommitRef?: string;
  githubCommitMessage?: string;
  githubCommitOrg?: string;
  githubCommitRepo?: string;
  githubCommitSha?: string;
  githubDeployment?: string;
  githubProdBranch?: string;
  gitLog?: string;
  gitMetadata?: Record<string, string>;
}

export interface VercelBuildInfo {
  id?: string;
  createdAt?: number;
  finishedAt?: number;
  duration?: number;
  error?: string;
  logs?: VercelLogEntry[];
}

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  autoExposeEnvironmentVariables?: string[];
  buildCommand?: string;
  commandForGenericBuilds?: string;
  createdAt?: number;
  crons?: VercelCron[];
  currentDeployment?: VercelDeployment;
  dataCache?: VercelDataCache;
  devCommand?: string;
  environment?: Record<string, string>;
  framework?: string;
  git?: VercelGitConfig;
  installCommand?: string;
  linkedToGit?: VercelGitInfo;
  nodeVersion?: string;
  outputDirectory?: string;
  productionDeployment?: VercelDeployment;
  publicMode?: boolean;
  rootDirectory?: string;
  security?: VercelSecurityConfig;
  serverlessFunctionRegion?: string;
  sourceFiles?: string;
  target?: string;
  transferCompletedAt?: number;
  transferStartedAt?: number;
  updatedAt?: number;
  url: string;
}

export interface VercelCron {
  path: string;
  schedule: string;
  createdAt?: number;
  creator?: VercelUser;
}

export interface VercelDataCache {
  enabled: boolean;
  persistent?: boolean;
}

export interface VercelGitConfig {
  enabled: boolean;
  autoJobCancelation: boolean;
  deployHooks: VercelDeployHook[];
  productionBranch?: string;
  repo?: string;
  type?: 'github' | 'gitlab' | 'bitbucket';
}

export interface VercelGitInfo {
  org: string;
  repo: string;
  repoId?: string;
  branch: string;
  type: 'github' | 'gitlab' | 'bitbucket';
}

export interface VercelSecurityConfig {
  allowList?: Record<string, string>;
  addRole?: string[];
}

export interface VercelDeployHook {
  id: string;
  createdAt?: number;
  name: string;
  ref: string;
  url: string;
}

export interface VercelDomain {
  uid: string;
  name: string;
  apexName: string;
  projectId: string;
  deploymentId?: string;
  redirect?: string;
  renewedAt?: number;
  createdAt?: number;
  expiresAt?: number;
  verified: boolean;
  cert?: VercelCertificate;
  geo?: Record<string, string>;
  misconfigured: boolean;
}

export interface VercelCertificate {
  id: string;
  autoRenew: boolean;
  createdAt: number;
  domain: string;
  expiresAt: number;
  issuer: string;
  renewAt: number;
  subjectName: string;
  type: string;
}

export interface VercelAlias {
  uid: string;
  alias: string;
  deploymentId: string;
  deploymentUid?: string;
  createdAt: number;
  config?: Record<string, unknown>;
}

export interface VercelEnvVar {
  id: string;
  key: string;
  value?: string;
  valueSourceless?: string;
  type: VercelEnvVarType;
  target: VercelEnvVarTarget[];
  createdAt: number;
  updatedAt: number;
  createdBy?: VercelUser;
  configurationId?: string;
  configurationName?: string;
}

export type VercelEnvVarType = 'encrypted' | 'plain' | 'secret';
export type VercelEnvVarTarget = 'production' | 'preview' | 'development';

export interface VercelSecret {
  uid: string;
  name: string;
  created: string;
  createdAt: number;
  createdBy?: VercelUser;
  decryptedValue?: string;
}

export interface VercelLogEntry {
  date: number;
  type: 'command' | 'stdout' | 'stderr' | 'title' | 'error' | 'debug' | 'info' | 'warning';
  title?: string;
  text: string;
  level?: string;
  metadata?: Record<string, unknown>;
}

export interface VercelLogsFilter {
  projectId?: string;
  deploymentId?: string;
  functionId?: string;
  from?: number;
  to?: number;
  limit?: number;
  direction?: 'asc' | 'desc';
  source?: 'build' | 'runtime' | 'static' | 'edge' | 'lambda';
}

export interface VercelEdgeFunction {
  id: string;
  projectId: string;
  name: string;
  memory: number;
  maxDuration?: number;
 私立?: string;
  version: string;
  runtime: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VercelServerlessFunction {
  id: string;
  projectId: string;
  deploymentId: string;
  name: string;
  slug: string;
  region: string;
  memory: number;
  maxDuration?: number;
  runtime: string;
  handler: string;
  createdAt: number;
  sourceFile?: string;
}

export interface VercelAnalytics {
  path: string;
  requests: number;
  visitedPages: number;
  uniquePages: number;
  data?: unknown[];
  start: number;
  end: number;
  breakdown?: Array<{ name: string; value: number }>;
}

export interface VercelProjectSettings {
  buildCommand?: string;
  commandForGenericBuilds?: string;
  createdAt?: number;
  devCommand?: string;
  directoryListing?: boolean;
  framework?: string;
  installCommand?: string;
  outputDirectory?: string;
  rootDirectory?: string;
  serverlessFunctionRegion?: string;
}

export interface VercelDNSRecord {
  id: string;
  slug?: string;
  type: 'A' | 'AAAA' | 'ALIAS' | 'CNAME' | 'TXT' | 'NS' | 'MX' | 'SRV';
  name: string;
  value: string;
  priority?: number;
  weight?: number;
  ttl?: number;
  createdAt?: number;
}

export interface VercelDNSZone {
  id: string;
  name: string;
  apexName: string;
  type: string;
  records: VercelDNSRecord[];
}

export interface VercelUser {
  uid: string;
  email: string;
  name: string;
  username: string;
  avatar: string;
  platformVersion?: string;
}

export interface VercelTeam {
  uid: string;
  name: string;
  slug: string;
  avatar: string;
  created?: number;
  creatorId?: string;
  description?: string;
  limited?: boolean;
  memos?: Record<string, string>;
  profileType?: string;
  ready?: boolean;
}

export interface VercelTeamMember {
  uid: string;
  email: string;
  name: string;
  role: 'OWNER' | 'MEMBER' | 'DEVELOPER' | 'VIEWER' | 'BILLING';
  avatar?: string;
  teamId?: string;
  joinedAt?: number;
}

export interface VercelProjectDeployment {
  deployment: VercelDeployment;
  check?: VercelDeploymentCheck;
}

export interface VercelDeploymentCheck {
  name: string;
  status: 'running' | 'passed' | 'failed';
  output?: string;
  conclusion?: 'success' | 'failure' | 'neutral' | 'skipped' | 'cancelled' | 'timed_out' | 'action_required';
  detailsUrl?: string;
}

export interface VercelRollback {
  deploymentId: string;
  targetDeploymentUid: string;
  createdAt: number;
}

export interface VercelBuild {
  id: string;
  createdAt: number;
  creatorId: string;
  deploymentId: string;
  meta: Record<string, string>;
  state: 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
}

export interface VercelProjectIntegration {
  id: string;
  type: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface VercelDeploymentPermission {
  allowEverywhere: boolean;
  domains?: string[];
}

export interface VercelRedirectRule {
  source: string;
  destination: string;
  statusCode?: number;
  target?: string;
}

export interface VercelHeaderRule {
  source: string;
  headers: Record<string, string>;
}

export interface VercelRewriteRule {
  source: string;
  destination: string;
}

export interface VercelMiddleware {
  id: string;
  projectId: string;
  name: string;
  version: string;
  createdAt: number;
  updatedAt: number;
}

export interface VercelProjectStorage {
  id: string;
  projectId: string;
  enabled: boolean;
  slug: string;
  createdAt: number;
  createdBy?: string;
}

export interface VercelIntegration {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  enabled: boolean;
  configuredAt?: number;
}

export interface VercelAuditLog {
  id: string;
  actor: VercelActor;
  action: string;
  target: VercelTarget[];
  createdAt: number;
  meta?: Record<string, unknown>;
}

export interface VercelActor {
  type: string;
  uid: string;
  name: string;
  email?: string;
  metadata?: Record<string, string>;
}

export interface VercelTarget {
  type: string;
  uid: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface VercelProtectionBypass {
  allowlist?: string[];
  enabled: boolean;
}

export interface VercelResponse {
  total?: number;
  deployments?: VercelDeployment[];
  projects?: VercelProject[];
  domains?: VercelDomain[];
  aliases?: VercelAlias[];
  envs?: VercelEnvVar[];
  secrets?: VercelSecret[];
  hooks?: VercelDeployHook[];
  logs?: VercelLogEntry[];
  functions?: VercelServerlessFunction[];
}

export interface VercelSettings {
  apiVersion?: string;
  timeout?: number;
  maxRetries?: number;
}

interface VercelConfig {
  accessToken: string;
  teamId?: string;
  settings?: VercelSettings;
}

export class VercelPlugin extends IntegrationBase {
  private config: VercelConfig;
  private apiBase: string;

  constructor() {
    super('vercel', 'Vercel', 'Vercel integration for deployments, projects, domains, environment variables, and logs');
    this.config = { accessToken: '' };
    this.apiBase = 'https://api.vercel.com/v6';
  }

  setConfig(accessToken: string, teamId?: string, settings?: VercelSettings): void {
    this.config = { accessToken, teamId, settings };
  }

  setSettings(settings: VercelSettings): void {
    this.config.settings = settings;
  }

  private getEndpoint(path: string): string {
    const base = this.config.teamId 
      ? `https://api.vercel.com/v6/teams/${this.config.teamId}`
      : this.apiBase;
    return `${base}${path}`;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.getEndpoint(endpoint);
    const response = await fetch(url, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vercel API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Access token is required');
    }

    this.setConfig(config.accessToken, config.teamId);
    return this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.accessToken) return false;

    try {
      const result = await this.makeRequest<{ uid: string }>('/user', {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      return !!result.uid;
    } catch {
      return false;
    }
  }

  async getProjects(options?: { limit?: number; search?: string }): Promise<{ projects: VercelProject[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);

    return this.makeRequest<{ projects: VercelProject[] }>(`/projects?${params}`);
  }

  async getProject(projectId: string): Promise<VercelProject> {
    return this.makeRequest<VercelProject>(`/projects/${projectId}`);
  }

  async createProject(project: Partial<VercelProject>): Promise<VercelProject> {
    return this.makeRequest<VercelProject>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(projectId: string, updates: Partial<VercelProject>): Promise<VercelProject> {
    return this.makeRequest<VercelProject>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(projectId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  async getProjectSettings(projectId: string): Promise<VercelProjectSettings> {
    return this.makeRequest<VercelProjectSettings>(`/projects/${projectId}/settings`);
  }

  async updateProjectSettings(projectId: string, settings: Partial<VercelProjectSettings>): Promise<VercelProjectSettings> {
    return this.makeRequest<VercelProjectSettings>(`/projects/${projectId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async getDeployments(projectId: string, options?: { limit?: number; state?: string }): Promise<{ deployments: VercelDeployment[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.state) params.append('state', options.state);

    return this.makeRequest<{ deployments: VercelDeployment[] }>(`/deployments?projectId=${projectId}&${params}`);
  }

  async getDeployment(deploymentId: string): Promise<VercelDeployment> {
    return this.makeRequest<VercelDeployment>(`/deployments/${deploymentId}`);
  }

  async createDeployment(deployment: Partial<VercelDeployment>): Promise<VercelDeployment> {
    return this.makeRequest<VercelDeployment>('/deployments', {
      method: 'POST',
      body: JSON.stringify(deployment),
    });
  }

  async cancelDeployment(deploymentId: string): Promise<VercelDeployment> {
    return this.makeRequest<VercelDeployment>(`/deployments/${deploymentId}/cancel`, {
      method: 'PATCH',
    });
  }

  async rollbackToDeployment(projectId: string, targetDeploymentId: string): Promise<VercelRollback> {
    return this.makeRequest<VercelRollback>(`/projects/${projectId}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ deploymentId: targetDeploymentId }),
    });
  }

  async getDeploymentEvents(deploymentId: string): Promise<{ events: VercelLogEntry[] }> {
    return this.makeRequest<{ events: VercelLogEntry[] }>(`/deployments/${deploymentId}/events`);
  }

  async getDeploymentLogs(deploymentId: string): Promise<{ logs: VercelLogEntry[] }> {
    return this.makeRequest<{ logs: VercelLogEntry[] }>(`/deployments/${deploymentId}/logs`);
  }

  async getDomains(projectId: string): Promise<{ domains: VercelDomain[] }> {
    return this.makeRequest<{ domains: VercelDomain[] }>(`/domains?projectId=${projectId}`);
  }

  async getDomain(domain: string): Promise<VercelDomain> {
    return this.makeRequest<VercelDomain>(`/domains/${domain}`);
  }

  async createDomain(domain: { name: string; projectId?: string }): Promise<VercelDomain> {
    return this.makeRequest<VercelDomain>('/domains', {
      method: 'POST',
      body: JSON.stringify(domain),
    });
  }

  async deleteDomain(domain: string, projectId?: string): Promise<{ message: string }> {
    const params = projectId ? `?projectId=${projectId}` : '';
    return this.makeRequest<{ message: string }>(`/domains/${domain}${params}`, {
      method: 'DELETE',
    });
  }

  async verifyDomain(domain: string): Promise<{ verified: boolean }> {
    return this.makeRequest<{ verified: boolean }>(`/domains/${domain}/verify`, {
      method: 'POST',
    });
  }

  async getDNSRecords(domain: string): Promise<{ records: VercelDNSRecord[] }> {
    return this.makeRequest<{ records: VercelDNSRecord[] }>(`/domains/${domain}/records`);
  }

  async createDNSRecord(domain: string, record: Partial<VercelDNSRecord>): Promise<VercelDNSRecord> {
    return this.makeRequest<VercelDNSRecord>(`/domains/${domain}/records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  async deleteDNSRecord(domain: string, recordId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/domains/${domain}/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  async getDNSZone(domain: string): Promise<VercelDNSZone> {
    return this.makeRequest<VercelDNSZone>(`/domains/${domain}/config`);
  }

  async getAliases(projectId: string): Promise<{ aliases: VercelAlias[] }> {
    return this.makeRequest<{ aliases: VercelAlias[] }>(`/aliases?projectId=${projectId}`);
  }

  async createAlias(alias: { alias: string; deploymentId: string }): Promise<VercelAlias> {
    return this.makeRequest<VercelAlias>('/aliases', {
      method: 'POST',
      body: JSON.stringify(alias),
    });
  }

  async deleteAlias(alias: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/aliases/${alias}`, {
      method: 'DELETE',
    });
  }

  async getEnvVars(projectId: string): Promise<{ envs: VercelEnvVar[] }> {
    return this.makeRequest<{ envs: VercelEnvVar[] }>(`/env?projectId=${projectId}`);
  }

  async getEnvVar(projectId: string, envId: string): Promise<VercelEnvVar> {
    return this.makeRequest<VercelEnvVar>(`/env/${envId}?projectId=${projectId}`);
  }

  async createEnvVar(projectId: string, env: Partial<VercelEnvVar>): Promise<VercelEnvVar> {
    return this.makeRequest<VercelEnvVar>(`/env?projectId=${projectId}`, {
      method: 'POST',
      body: JSON.stringify(env),
    });
  }

  async updateEnvVar(projectId: string, envId: string, env: Partial<VercelEnvVar>): Promise<VercelEnvVar> {
    return this.makeRequest<VercelEnvVar>(`/env/${envId}?projectId=${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(env),
    });
  }

  async deleteEnvVar(projectId: string, envId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/env/${envId}?projectId=${projectId}`, {
      method: 'DELETE',
    });
  }

  async getSecrets(): Promise<{ secrets: VercelSecret[] }> {
    return this.makeRequest<{ secrets: VercelSecret[] }>('/secrets');
  }

  async createSecret(secret: { name: string; value: string }): Promise<VercelSecret> {
    return this.makeRequest<VercelSecret>('/secrets', {
      method: 'POST',
      body: JSON.stringify(secret),
    });
  }

  async updateSecret(secretId: string, secret: { name?: string; value?: string }): Promise<VercelSecret> {
    return this.makeRequest<VercelSecret>(`/secrets/${secretId}`, {
      method: 'PATCH',
      body: JSON.stringify(secret),
    });
  }

  async deleteSecret(secretId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/secrets/${secretId}`, {
      method: 'DELETE',
    });
  }

  async getDeployHooks(projectId: string): Promise<{ hooks: VercelDeployHook[] }> {
    return this.makeRequest<{ hooks: VercelDeployHook[] }>(`/deploy-hooks?projectId=${projectId}`);
  }

  async createDeployHook(hook: { name: string; ref?: string }): Promise<VercelDeployHook> {
    return this.makeRequest<VercelDeployHook>('/deploy-hooks', {
      method: 'POST',
      body: JSON.stringify(hook),
    });
  }

  async deleteDeployHook(hookId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/deploy-hooks/${hookId}`, {
      method: 'DELETE',
    });
  }

  async getServerlessFunctions(projectId: string, deploymentId?: string): Promise<{ functions: VercelServerlessFunction[] }> {
    const params = new URLSearchParams();
    if (deploymentId) params.append('deploymentId', deploymentId);

    return this.makeRequest<{ functions: VercelServerlessFunction[] }>(`/functions?projectId=${projectId}&${params}`);
  }

  async getServerlessFunction(projectId: string, functionName: string): Promise<VercelServerlessFunction> {
    return this.makeRequest<VercelServerlessFunction>(`/functions/${functionName}?projectId=${projectId}`);
  }

  async getEdgeFunctions(projectId: string): Promise<{ functions: VercelEdgeFunction[] }> {
    return this.makeRequest<{ functions: VercelEdgeFunction[] }>(`/edge-functions?projectId=${projectId}`);
  }

  async getEdgeFunction(projectId: string, functionId: string): Promise<VercelEdgeFunction> {
    return this.makeRequest<VercelEdgeFunction>(`/edge-functions/${functionId}?projectId=${projectId}`);
  }

  async getProjectLogs(projectId: string, options?: VercelLogsFilter): Promise<{ logs: VercelLogEntry[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.from) params.append('from', options.from.toString());
    if (options?.to) params.append('to', options.to.toString());
    if (options?.direction) params.append('direction', options.direction);
    if (options?.source) params.append('source', options.source);

    return this.makeRequest<{ logs: VercelLogEntry[] }>(`/logs?projectId=${projectId}&${params}`);
  }

  async getFunctionLogs(projectId: string, functionName: string, options?: { limit?: number; from?: number; to?: number }): Promise<{ logs: VercelLogEntry[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.from) params.append('from', options.from.toString());
    if (options?.to) params.append('to', options.to.toString());

    return this.makeRequest<{ logs: VercelLogEntry[] }>(`/functions/${functionName}/logs?projectId=${projectId}&${params}`);
  }

  async getAnalytics(projectId: string, options?: { from?: number; to?: number; timezone?: string }): Promise<{ analytics: VercelAnalytics[] }> {
    const params = new URLSearchParams();
    if (options?.from) params.append('start', options.from.toString());
    if (options?.to) params.append('end', options.to.toString());
    if (options?.timezone) params.append('timezone', options.timezone);

    return this.makeRequest<{ analytics: VercelAnalytics[] }>(`/analytics/${projectId}?${params}`);
  }

  async getAnalyticsSummary(projectId: string, options?: { from?: number; to?: number }): Promise<{ summary: { requests: number; min: number; max: number; avg: number; p50: number; p90: number; p99: number } }> {
    const params = new URLSearchParams();
    if (options?.from) params.append('start', options.from.toString());
    if (options?.to) params.append('end', options.to.toString());

    return this.makeRequest<{ summary: { requests: number; min: number; max: number; avg: number; p50: number; p90: number; p99: number } }>(`/analytics/${projectId}/summary?${params}`);
  }

  async getCrons(projectId: string): Promise<{ crons: VercelCron[] }> {
    return this.makeRequest<{ crons: VercelCron[] }>(`/crons?projectId=${projectId}`);
  }

  async createCron(projectId: string, cron: { path: string; schedule: string }): Promise<VercelCron> {
    return this.makeRequest<VercelCron>(`/crons?projectId=${projectId}`, {
      method: 'POST',
      body: JSON.stringify(cron),
    });
  }

  async deleteCron(projectId: string, cronId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/crons/${cronId}?projectId=${projectId}`, {
      method: 'DELETE',
    });
  }

  async getMiddleware(projectId: string): Promise<{ middleware: VercelMiddleware[] }> {
    return this.makeRequest<{ middleware: VercelMiddleware[] }>(`/middleware?projectId=${projectId}`);
  }

  async createMiddleware(projectId: string, middleware: { name: string; entry: string }): Promise<VercelMiddleware> {
    return this.makeRequest<VercelMiddleware>(`/middleware?projectId=${projectId}`, {
      method: 'POST',
      body: JSON.stringify(middleware),
    });
  }

  async getProjectIntegrations(projectId: string): Promise<{ integrations: VercelProjectIntegration[] }> {
    return this.makeRequest<{ integrations: VercelProjectIntegration[] }>(`/projects/${projectId}/integrations`);
  }

  async getAuditLogs(options?: { limit?: number; from?: number; to?: number }): Promise<{ auditLogs: VercelAuditLog[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.from) params.append('from', options.from.toString());
    if (options?.to) params.append('to', options.to.toString());

    return this.makeRequest<{ auditLogs: VercelAuditLog[] }>(`/audit-logs?${params}`);
  }

  async getTeamMembers(teamId: string): Promise<{ members: VercelTeamMember[] }> {
    return this.makeRequest<{ members: VercelTeamMember[] }>(`/teams/${teamId}/members`);
  }

  async inviteTeamMember(teamId: string, member: { email: string; role: string }): Promise<{ uid: string }> {
    return this.makeRequest<{ uid: string }>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    });
  }

  async removeTeamMember(teamId: string, memberId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async updateTeamMemberRole(teamId: string, memberId: string, role: string): Promise<VercelTeamMember> {
    return this.makeRequest<VercelTeamMember>(`/teams/${teamId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async getProtection(projectId: string): Promise<{ bypass: VercelProtectionBypass }> {
    return this.makeRequest<{ bypass: VercelProtectionBypass }>(`/projects/${projectId}/protection`);
  }

  async updateProtection(projectId: string, protection: Partial<VercelProtectionBypass>): Promise<{ bypass: VercelProtectionBypass }> {
    return this.makeRequest<{ bypass: VercelProtectionBypass }>(`/projects/${projectId}/protection`, {
      method: 'PATCH',
      body: JSON.stringify(protection),
    });
  }

  async getProjectStorage(projectId: string): Promise<{ storage: VercelProjectStorage[] }> {
    return this.makeRequest<{ storage: VercelProjectStorage[] }>(`/projects/${projectId}/storage`);
  }

  async cleanup(): Promise<void> {
    this.config = { accessToken: '' };
  }

  getManifest(): PluginManifest {
    return {
      id: 'vercel',
      name: 'Vercel',
      version: '2.0.0',
      description: 'Vercel integration for deployments, projects, domains, environment variables, and logs',
      author: 'TIMPS Team',
      main: 'vercel-new.js',
      keywords: ['vercel', 'nextjs', 'serverless', 'hosting', 'cdn', 'deploy', 'edge'],
      actions: [
        { id: 'get_projects', name: 'Get Projects', description: 'List all projects' },
        { id: 'get_project', name: 'Get Project', description: 'Get project details' },
        { id: 'create_project', name: 'Create Project', description: 'Create a new project' },
        { id: 'update_project', name: 'Update Project', description: 'Update project settings' },
        { id: 'delete_project', name: 'Delete Project', description: 'Delete a project' },
        { id: 'get_project_settings', name: 'Get Project Settings', description: 'Get project configuration' },
        { id: 'update_project_settings', name: 'Update Project Settings', description: 'Update project configuration' },
        { id: 'get_deployments', name: 'Get Deployments', description: 'List project deployments' },
        { id: 'get_deployment', name: 'Get Deployment', description: 'Get deployment details' },
        { id: 'create_deployment', name: 'Create Deployment', description: 'Trigger a new deployment' },
        { id: 'cancel_deployment', name: 'Cancel Deployment', description: 'Cancel a running deployment' },
        { id: 'rollback_deployment', name: 'Rollback Deployment', description: 'Rollback to a previous deployment' },
        { id: 'get_deployment_events', name: 'Get Deployment Events', description: 'Get deployment event timeline' },
        { id: 'get_deployment_logs', name: 'Get Deployment Logs', description: 'Get deployment build logs' },
        { id: 'get_domains', name: 'Get Domains', description: 'List project domains' },
        { id: 'get_domain', name: 'Get Domain', description: 'Get domain details' },
        { id: 'create_domain', name: 'Create Domain', description: 'Add a new domain' },
        { id: 'delete_domain', name: 'Delete Domain', description: 'Remove a domain' },
        { id: 'verify_domain', name: 'Verify Domain', description: 'Verify domain ownership' },
        { id: 'get_dns_records', name: 'Get DNS Records', description: 'List DNS records' },
        { id: 'create_dns_record', name: 'Create DNS Record', description: 'Add a DNS record' },
        { id: 'delete_dns_record', name: 'Delete DNS Record', description: 'Remove a DNS record' },
        { id: 'get_dns_zone', name: 'Get DNS Zone', description: 'Get DNS configuration' },
        { id: 'get_aliases', name: 'Get Aliases', description: 'List aliases' },
        { id: 'create_alias', name: 'Create Alias', description: 'Create a deployment alias' },
        { id: 'delete_alias', name: 'Delete Alias', description: 'Remove an alias' },
        { id: 'get_env_vars', name: 'Get Environment Variables', description: 'List environment variables' },
        { id: 'get_env_var', name: 'Get Environment Variable', description: 'Get specific env var' },
        { id: 'create_env_var', name: 'Create Environment Variable', description: 'Add an environment variable' },
        { id: 'update_env_var', name: 'Update Environment Variable', description: 'Update an env var' },
        { id: 'delete_env_var', name: 'Delete Environment Variable', description: 'Remove an env var' },
        { id: 'get_secrets', name: 'Get Secrets', description: 'List secrets' },
        { id: 'create_secret', name: 'Create Secret', description: 'Create a secret' },
        { id: 'update_secret', name: 'Update Secret', description: 'Update a secret' },
        { id: 'delete_secret', name: 'Delete Secret', description: 'Remove a secret' },
        { id: 'get_deploy_hooks', name: 'Get Deploy Hooks', description: 'List deploy hooks' },
        { id: 'create_deploy_hook', name: 'Create Deploy Hook', description: 'Create a deploy hook' },
        { id: 'delete_deploy_hook', name: 'Delete Deploy Hook', description: 'Remove a deploy hook' },
        { id: 'get_serverless_functions', name: 'Get Serverless Functions', description: 'List serverless functions' },
        { id: 'get_serverless_function', name: 'Get Serverless Function', description: 'Get function details' },
        { id: 'get_edge_functions', name: 'Get Edge Functions', description: 'List edge functions' },
        { id: 'get_edge_function', name: 'Get Edge Function', description: 'Get edge function details' },
        { id: 'get_project_logs', name: 'Get Project Logs', description: 'Get project runtime logs' },
        { id: 'get_function_logs', name: 'Get Function Logs', description: 'Get function execution logs' },
        { id: 'get_analytics', name: 'Get Analytics', description: 'Get deployment analytics' },
        { id: 'get_analytics_summary', name: 'Get Analytics Summary', description: 'Get analytics summary' },
        { id: 'get_crons', name: 'Get Cron Jobs', description: 'List scheduled cron jobs' },
        { id: 'create_cron', name: 'Create Cron Job', description: 'Create a cron job' },
        { id: 'delete_cron', name: 'Delete Cron Job', description: 'Remove a cron job' },
        { id: 'get_middleware', name: 'Get Middleware', description: 'List middleware' },
        { id: 'create_middleware', name: 'Create Middleware', description: 'Create middleware' },
        { id: 'get_project_integrations', name: 'Get Integrations', description: 'List project integrations' },
        { id: 'get_audit_logs', name: 'Get Audit Logs', description: 'Get team audit logs' },
        { id: 'get_team_members', name: 'Get Team Members', description: 'List team members' },
        { id: 'invite_team_member', name: 'Invite Team Member', description: 'Invite a new member' },
        { id: 'remove_team_member', name: 'Remove Team Member', description: 'Remove a member' },
        { id: 'update_team_member_role', name: 'Update Member Role', description: 'Update member role' },
        { id: 'get_protection', name: 'Get Protection', description: 'Get bypass protection settings' },
        { id: 'update_protection', name: 'Update Protection', description: 'Update protection settings' },
        { id: 'get_project_storage', name: 'Get Storage', description: 'List project storage' },
        { id: 'test_connection', name: 'Test Connection', description: 'Test Vercel connection' },
      ],
      triggers: [
        { id: 'deployment_ready', name: 'Deployment Ready', description: 'Triggered when deployment is ready' },
        { id: 'deployment_error', name: 'Deployment Error', description: 'Triggered when deployment fails' },
        { id: 'deployment_cancelled', name: 'Deployment Cancelled', description: 'Triggered when deployment is cancelled' },
        { id: 'deployment_created', name: 'Deployment Created', description: 'Triggered when new deployment starts' },
        { id: 'alias_created', name: 'Alias Created', description: 'Triggered when alias is created' },
        { id: 'domain_verified', name: 'Domain Verified', description: 'Triggered when domain is verified' },
        { id: 'domain_expired', name: 'Domain Expired', description: 'Triggered when domain expires' },
        { id: 'env_var_created', name: 'Environment Variable Created', description: 'Triggered when env var is added' },
        { id: 'env_var_deleted', name: 'Environment Variable Deleted', description: 'Triggered when env var is removed' },
      ],
      auth: {
        type: 'bearer',
        fields: [
          { name: 'accessToken', label: 'Access Token', description: 'Your Vercel access token', required: true },
          { name: 'teamId', label: 'Team ID', description: 'Optional team ID for team accounts', required: false },
        ],
      },
      settings: [
        { name: 'apiVersion', label: 'API Version', type: 'select', options: ['v5', 'v6'], default: 'v6' },
        { name: 'timeout', label: 'Request Timeout', type: 'number', default: 30000 },
        { name: 'maxRetries', label: 'Max Retries', type: 'number', default: 3 },
      ],
      connectionTest: { endpoint: '/user', method: 'GET' },
    };
  }

  executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case 'get_projects':
        return this.getProjects(params as any);
      case 'get_project':
        return this.getProject(params.projectId as string);
      case 'create_project':
        return this.createProject(params.project as Partial<VercelProject>);
      case 'update_project':
        return this.updateProject(params.projectId as string, params.updates as Partial<VercelProject>);
      case 'delete_project':
        return this.deleteProject(params.projectId as string);
      case 'get_project_settings':
        return this.getProjectSettings(params.projectId as string);
      case 'update_project_settings':
        return this.updateProjectSettings(params.projectId as string, params.settings as Partial<VercelProjectSettings>);
      case 'get_deployments':
        return this.getDeployments(params.projectId as string, params as any);
      case 'get_deployment':
        return this.getDeployment(params.deploymentId as string);
      case 'create_deployment':
        return this.createDeployment(params.deployment as Partial<VercelDeployment>);
      case 'cancel_deployment':
        return this.cancelDeployment(params.deploymentId as string);
      case 'rollback_deployment':
        return this.rollbackToDeployment(params.projectId as string, params.deploymentId as string);
      case 'get_deployment_events':
        return this.getDeploymentEvents(params.deploymentId as string);
      case 'get_deployment_logs':
        return this.getDeploymentLogs(params.deploymentId as string);
      case 'get_domains':
        return this.getDomains(params.projectId as string);
      case 'get_domain':
        return this.getDomain(params.domain as string);
      case 'create_domain':
        return this.createDomain(params as any);
      case 'delete_domain':
        return this.deleteDomain(params.domain as string, params.projectId as string | undefined);
      case 'verify_domain':
        return this.verifyDomain(params.domain as string);
      case 'get_dns_records':
        return this.getDNSRecords(params.domain as string);
      case 'create_dns_record':
        return this.createDNSRecord(params.domain as string, params.record as Partial<VercelDNSRecord>);
      case 'delete_dns_record':
        return this.deleteDNSRecord(params.domain as string, params.recordId as string);
      case 'get_dns_zone':
        return this.getDNSZone(params.domain as string);
      case 'get_aliases':
        return this.getAliases(params.projectId as string);
      case 'create_alias':
        return this.createAlias(params as any);
      case 'delete_alias':
        return this.deleteAlias(params.alias as string);
      case 'get_env_vars':
        return this.getEnvVars(params.projectId as string);
      case 'get_env_var':
        return this.getEnvVar(params.projectId as string, params.envId as string);
      case 'create_env_var':
        return this.createEnvVar(params.projectId as string, params.env as Partial<VercelEnvVar>);
      case 'update_env_var':
        return this.updateEnvVar(params.projectId as string, params.envId as string, params.env as Partial<VercelEnvVar>);
      case 'delete_env_var':
        return this.deleteEnvVar(params.projectId as string, params.envId as string);
      case 'get_secrets':
        return this.getSecrets();
      case 'create_secret':
        return this.createSecret(params as any);
      case 'update_secret':
        return this.updateSecret(params.secretId as string, params as any);
      case 'delete_secret':
        return this.deleteSecret(params.secretId as string);
      case 'get_deploy_hooks':
        return this.getDeployHooks(params.projectId as string);
      case 'create_deploy_hook':
        return this.createDeployHook(params as any);
      case 'delete_deploy_hook':
        return this.deleteDeployHook(params.hookId as string);
      case 'get_serverless_functions':
        return this.getServerlessFunctions(params.projectId as string, params.deploymentId as string);
      case 'get_serverless_function':
        return this.getServerlessFunction(params.projectId as string, params.functionName as string);
      case 'get_edge_functions':
        return this.getEdgeFunctions(params.projectId as string);
      case 'get_edge_function':
        return this.getEdgeFunction(params.projectId as string, params.functionId as string);
      case 'get_project_logs':
        return this.getProjectLogs(params.projectId as string, params as any);
      case 'get_function_logs':
        return this.getFunctionLogs(params.projectId as string, params.functionName as string, params as any);
      case 'get_analytics':
        return this.getAnalytics(params.projectId as string, params as any);
      case 'get_analytics_summary':
        return this.getAnalyticsSummary(params.projectId as string, params as any);
      case 'get_crons':
        return this.getCrons(params.projectId as string);
      case 'create_cron':
        return this.createCron(params.projectId as string, params as any);
      case 'delete_cron':
        return this.deleteCron(params.projectId as string, params.cronId as string);
      case 'get_middleware':
        return this.getMiddleware(params.projectId as string);
      case 'create_middleware':
        return this.createMiddleware(params.projectId as string, params as any);
      case 'get_project_integrations':
        return this.getProjectIntegrations(params.projectId as string);
      case 'get_audit_logs':
        return this.getAuditLogs(params as any);
      case 'get_team_members':
        return this.getTeamMembers(params.teamId as string);
      case 'invite_team_member':
        return this.inviteTeamMember(params.teamId as string, params as any);
      case 'remove_team_member':
        return this.removeTeamMember(params.teamId as string, params.memberId as string);
      case 'update_team_member_role':
        return this.updateTeamMemberRole(params.teamId as string, params.memberId as string, params.role as string);
      case 'get_protection':
        return this.getProtection(params.projectId as string);
      case 'update_protection':
        return this.updateProtection(params.projectId as string, params as any);
      case 'get_project_storage':
        return this.getProjectStorage(params.projectId as string);
      case 'test_connection':
        return this.testConnection();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'projects':
        return this.getProjects(options as any);
      case 'project':
        return this.getProject(options?.projectId as string);
      case 'deployments':
        return this.getDeployments(options?.projectId as string, options as any);
      case 'deployment':
        return this.getDeployment(options?.deploymentId as string);
      case 'domains':
        return this.getDomains(options?.projectId as string);
      case 'domain':
        return this.getDomain(options?.domain as string);
      case 'aliases':
        return this.getAliases(options?.projectId as string);
      case 'env-vars':
        return this.getEnvVars(options?.projectId as string);
      case 'secrets':
        return this.getSecrets();
      case 'deploy-hooks':
        return this.getDeployHooks(options?.projectId as string);
      case 'functions':
        return this.getServerlessFunctions(options?.projectId as string);
      case 'edge-functions':
        return this.getEdgeFunctions(options?.projectId as string);
      case 'analytics':
        return this.getAnalytics(options?.projectId as string, options as any);
      case 'crons':
        return this.getCrons(options?.projectId as string);
      case 'middleware':
        return this.getMiddleware(options?.projectId as string);
      case 'audit-logs':
        return this.getAuditLogs(options as any);
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}

export const vercelPlugin = new VercelPlugin();

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  keywords: string[];
  actions?: Array<{ id: string; name: string; description: string }>;
  triggers?: Array<{ id: string; name: string; description: string }>;
  auth?: {
    type: string;
    fields: Array<{ name: string; label: string; description: string; required?: boolean; type?: string; options?: string[]; default?: any }>;
  };
  settings?: Array<{ name: string; label: string; type: string; default?: any; options?: string[] }>;
  connectionTest?: { endpoint: string; method: string };
}