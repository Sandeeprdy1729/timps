import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
 culprit: string;
  permalink: string;
  logger: string;
  level: string;
  status: string;
  resolutionAge?: number;
  assignee?: SentryUser;
  stats: { '24h': Array<{ count: number; ts: number }> };
}

export interface SentryUser {
  id: string;
  username?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface SentryEvent {
  id: string;
  groupID: string;
  eventID: string;
  level: string;
  location?: string;
 culprit: string;
  timestamp: number;
  dateCreated: string;
  user?: SentryUser;
  entries: SentryEntry[];
  tags: Array<{ key: string; value: string }>;
  context?: Record<string, Record<string, unknown>>;
}

export interface SentryEntry {
  type: string;
  data: Record<string, unknown>;
}

export interface SentryProject {
  id: string;
  slug: string;
  name: string;
  platform: string;
  platforms: string[];
  stats: Record<string, number[]>;
  status: string;
}

export interface SentryOrganization {
  id: string;
  slug: string;
  name: string;
  status: { id: string; name: string };
}

export interface SentryTeam {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
}

export interface SentryRelease {
  version: string;
  dateRef: string;
  tagCount: number;
  commitCount: number;
  authors: SentryUser[];
}

export interface SentryDeploy {
  id: string;
  name: string;
  environment: string;
  dateStarted: string;
  dateFinished?: string;
  status: string;
}

export interface SentryMetric {
  name: string;
  value: number;
}

export interface SentryAlertRule {
  id: string;
  name: string;
  status: string;
  conditions: SentryCondition[];
  actions: SentryAction[];
  createdBy: SentryUser;
  createdAt: string;
}

export interface SentryCondition {
  id: string;
  name: string;
  value?: string;
}

export interface SentryAction {
  id: string;
  name: string;
  type: string;
  targetDisplay?: string;
}

export interface SentryKey {
  id: string;
  name: string;
  dsn: { cname: string; public: string; secret: string };
}

export interface SentryDSN {
  protocol: string;
  public: string;
  secret: string;
  path: string;
  projectId: string;
  keys: SentryKey;
}

const MANIFEST: PluginManifest = {
  id: 'sentry',
  name: 'Sentry',
  version: '1.0.0',
  description: 'Sentry error monitoring integration for tracking issues, events, and releases',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['sentry', 'error', 'monitoring', 'debugging'],
};

const SCOPES = [
  'getIssues',
  'getIssue',
  'updateIssue',
  'deleteIssue',
  'getIssueEvents',
  'getEvent',
  'getStacktrace',
  'getUsers',
  'getUser',
  'getProjects',
  'getProject',
  'getProjectStats',
  'getReleases',
  'createRelease',
  'updateRelease',
  'deleteRelease',
  'getDeploys',
  'createDeploy',
  'getTeams',
  'getTeam',
  'createTeam',
  'deleteTeam',
  'getOrganizations',
  'getOrg',
  'getOrganizationStats',
  'getOrganizationProjects',
  'getAlertRules',
  'createAlertRule',
  'updateAlertRule',
  'deleteAlertRule',
  'getKeys',
  'getMetric',
  'getMetrics',
  'captureEvent',
  'captureMessage',
  'captureException',
];

export default class SentryIntegration extends IntegrationBase {
  private apiBase = 'https://sentry.io/api/0';
  private orgSlug: string | null = null;
  private projectSlug: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['event_received', 'event_error', 'event_processed', 'issue_resolved', 'issue_unresolved', 'issue_regressed', 'issue_assigned'],
      dataModels: ['issue', 'event', 'project', 'release', 'deploy', 'team', 'alert', 'key'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Sentry access token is required');
    }
    this.setAccessToken(config.accessToken);

    try {
      const user = await this.apiCall<SentryUser>(`${this.apiBase}/users/me/`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!user.id;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/users/me/`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  setProject(orgSlug: string, projectSlug: string): void {
    this.orgSlug = orgSlug;
    this.projectSlug = projectSlug;
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const org = params.orgSlug || this.orgSlug;
    const project = params.projectSlug || this.projectSlug;
    const headers = { Authorization: `Bearer ${this.accessToken}` };

    switch (action) {
      case 'getIssues':
        return this.apiCall<{ issues: SentryIssue[] }>(
          `${this.apiBase}/projects/${org}/${project}/issues/`,
          { headers }
        );

      case 'getIssue':
        return this.apiCall<SentryIssue>(
          `${this.apiBase}/issues/${params.issueId}/`,
          { headers }
        );

      case 'updateIssue':
        return this.apiCall<SentryIssue>(`${this.apiBase}/issues/${params.issueId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteIssue':
        return this.apiCall<{ message: string }>(`${this.apiBase}/issues/${params.issueId}/`, {
          method: 'DELETE',
          headers,
        });

      case 'getIssueEvents':
        return this.apiCall<{ events: SentryEvent[] }>(
          `${this.apiBase}/issues/${params.issueId}/events/`,
          { headers }
        );

      case 'getEvent':
        return this.apiCall<SentryEvent>(
          `${this.apiBase}/events/${params.eventId}/`,
          { headers }
        );

      case 'getStacktrace':
        return this.apiCall(
          `${this.apiBase}/events/${params.eventId}/`,
          { headers }
        );

      case 'getProjects':
        return this.apiCall<{ projects: SentryProject[] }>(
          `${this.apiBase}/organizations/${org}/projects/`,
          { headers }
        );

      case 'getProject':
        return this.apiCall<SentryProject>(
          `${this.apiBase}/projects/${org}/${project}/`,
          { headers }
        );

      case 'getProjectStats':
        return this.apiCall(
          `${this.apiBase}/projects/${org}/${project}/stats/`,
          { headers }
        );

      case 'getReleases':
        return this.apiCall<{ releases: SentryRelease[] }>(
          `${this.apiBase}/organizations/${org}/releases/`,
          { headers }
        );

      case 'createRelease':
        return this.apiCall<SentryRelease>(
          `${this.apiBase}/organizations/${org}/releases/`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              version: params.version,
              refs: params.refs,
              projects: params.projects,
            }),
          }
        );

      case 'updateRelease':
        return this.apiCall<SentryRelease>(
          `${this.apiBase}/organizations/${org}/releases/${params.version}/`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(params.updates),
          }
        );

      case 'deleteRelease':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/organizations/${org}/releases/${params.version}/`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getDeploys':
        return this.apiCall<{ deploys: SentryDeploy[] }>(
          `${this.apiBase}/organizations/${org}/deploys/',
          { headers }
        );

      case 'createDeploy':
        return this.apiCall<SentryDeploy>(
          `${this.apiBase}/organizations/${org}/deploys/`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: params.name,
              environment: params.environment,
              dateStarted: params.dateStarted,
            }),
          }
        );

      case 'getTeams':
        return this.apiCall<{ teams: SentryTeam[] }>(
          `${this.apiBase}/organizations/${org}/teams/`,
          { headers }
        );

      case 'createTeam':
        return this.apiCall<SentryTeam>(
          `${this.apiBase}/organizations/${org}/teams/`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: params.name, slug: params.slug }),
          }
        );

      case 'getAlertRules':
        return this.apiCall<{ rules: SentryAlertRule[] }>(
          `${this.apiBase}/projects/${org}/${project}/rules/`,
          { headers }
        );

      case 'createAlertRule':
        return this.apiCall<SentryAlertRule>(
          `${this.apiBase}/projects/${org}/${project}/rules/`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.rule),
          }
        );

      case 'getKeys':
        return this.apiCall<{ keys: SentryKey[] }>(
          `${this.apiBase}/projects/${org}/${project}/keys/`,
          { headers }
        );

      case 'getOrganizationStats':
        return this.apiCall(
          `${this.apiBase}/organizations/${org}/stats/`,
          { headers }
        );

      case 'captureEvent':
        return this.apiCall<SentryEvent>(
          `${this.apiBase}/projects/${org}/${project}/events/`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.event),
          }
        );

      case 'getMetric':
        return this.apiCall<SentryMetric>(
          `${this.apiBase}/organizations/${org}/metrics/`,
          { headers }
        );

      case 'getUsers':
        return this.apiCall<{ users: SentryUser[] }>(
          `${this.apiBase}/project/${org}/${project}/users/`,
          { headers }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'issues':
        return this.executeAction('getIssues', options || {});
      case 'projects':
        return this.executeAction('getProjects', options || {});
      case 'releases':
        return this.executeAction('getReleases', options || {});
      case 'teams':
        return this.executeAction('getTeams', options || {});
      case 'alert-rules':
        return this.executeAction('getAlertRules', options || {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.orgSlug = null;
    this.projectSlug = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createSentryIntegration(): SentryIntegration {
  return new SentryIntegration();
}