import { IntegrationBase } from './integration-base';

export interface SentryIssue {
  id: string;
  projectId: string;
  permalink: string;
  title: string;
  level: string;
  status: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  culprit: string;
  shortId: string;
}

export interface SentryEvent {
  id: string;
  eventId: string;
  projectId: string;
  title: string;
  level: string;
  timestamp: string;
  user: any;
  platform: string;
  culprit: string;
  tags: Array<{ key: string; value: string }>;
  crashFile: any;
}

export interface SentryProject {
  id: string;
  name: string;
  slug: string;
  team: string;
}

export interface SentryOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface SentryRelease {
  id: string;
  version: string;
  projects: Array<{ name: string; slug: string }>;
  dateCreated: string;
  dateReleased: string;
  commitCount: number;
}

export interface SentryDeploy {
  id: string;
  name: string;
  environment: string;
  dateStarted: string;
  dateFinished: string;
  status: string;
}

export interface SentryTeam {
  id: string;
  name: string;
  slug: string;
}

export interface SentryWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

interface SentryConfig {
  authToken: string;
  organizationSlug: string;
}

export class SentryPlugin extends IntegrationBase {
  private config: SentryConfig;
  private baseUrl = 'https://sentry.io/api/0';

  constructor() {
    super('Sentry', 'sentry', 'Application monitoring and error tracking');
  }

  setConfig(authToken: string, organizationSlug: string): void {
    this.config = { authToken, organizationSlug };
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.config.authToken}`,
      'Content-Type': 'application/json',
    };
  }

  private getOrgUrl(endpoint: string) {
    return `${this.baseUrl}/organizations/${this.config.organizationSlug}${endpoint}`;
  }

  async apiCall<T>(endpoint: string, options = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.makeRequest<T>(endpoint.startsWith('/organizations') ? url : this.getOrgUrl(endpoint), options, this.getHeaders());
  }

  async testConnection(): Promise<boolean> {
    try {
      const org = await this.apiCall<any>('/organizations/@current/');
      return !!org.slug;
    } catch { return false; }
  }

  async getIssues(options?: { query?: string; limit?: number }): Promise<{ issues: SentryIssue[] }> {
    const params = new URLSearchParams();
    if (options?.query) params.append('query', options.query);
    if (options?.limit) params.append('limit', options.limit.toString());
    return this.apiCall<{ issues: SentryIssue[] }>(`/issues/?${params}`);
  }

  async getIssue(issueId: string): Promise<SentryIssue> {
    return this.apiCall<SentryIssue>(`/issues/${issueId}/`);
  }

  async updateIssue(issueId: string, data: { status?: string; assignedTo?: string }): Promise<SentryIssue> {
    return this.apiCall<SentryIssue>(`/issues/${issueId}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteIssue(issueId: string): Promise<void> {
    return this.apiCall<void>(`/issues/${issueId}/`, { method: 'DELETE' });
  }

  async getIssueEvents(issueId: string): Promise<{ events: SentryEvent[] }> {
    return this.apiCall<{ events: SentryEvent[] }>(`/issues/${issueId}/events/`);
  }

  async getProjects(): Promise<{ projects: SentryProject[] }> {
    return this.apiCall<{ projects: SentryProject[] }>('/projects/');
  }

  async getProject(projectSlug: string): Promise<SentryProject> {
    return this.apiCall<SentryProject>(`/projects/${projectSlug}/`);
  }

  async getProjectIssues(projectSlug: string): Promise<{ issues: SentryIssue[] }> {
    return this.apiCall<{ issues: SentryIssue[] }>(`/projects/${projectSlug}/issues/`);
  }

  async getReleases(): Promise<{ releases: SentryRelease[] }> {
    return this.apiCall<{ releases: SentryRelease[] }>('/releases/');
  }

  async createRelease(version: string, projects: string[], dateReleased?: string): Promise<SentryRelease> {
    return this.apiCall<SentryRelease>('/releases/', {
      method: 'POST',
      body: JSON.stringify({ version, projects, dateReleased }),
    });
  }

  async getDeploys(): Promise<{ deploys: SentryDeploy[] }> {
    return this.apiCall<{ deploys: SentryDeploy[] }>('/deploys/');
  }

  async getTeams(): Promise<{ teams: SentryTeam[] }> {
    return this.apiCall<{ teams: SentryTeam[] }>('/teams/');
  }

  async getOrganization(): Promise<SentryOrganization> {
    return this.apiCall<SentryOrganization>('/organizations/@current/');
  }

  async captureEvent(data: { message?: string; level?: string; extra?: any }): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('/store/', { method: 'POST', body: JSON.stringify(data) });
  }

  getManifest() {
    return {
      name: 'Sentry',
      id: 'sentry',
      description: 'Application monitoring and error tracking',
      version: '1.0.0',
      actions: [
        { id: 'get_issues', name: 'Get Issues', description: 'List all issues' },
        { id: 'get_issue', name: 'Get Issue', description: 'Get issue details' },
        { id: 'update_issue', name: 'Update Issue', description: 'Update issue status' },
        { id: 'delete_issue', name: 'Delete Issue', description: 'Delete an issue' },
        { id: 'get_issue_events', name: 'Get Issue Events', description: 'List events for issue' },
        { id: 'get_projects', name: 'Get Projects', description: 'List all projects' },
        { id: 'get_project', name: 'Get Project', description: 'Get project details' },
        { id: 'get_releases', name: 'Get Releases', description: 'List all releases' },
        { id: 'create_release', name: 'Create Release', description: 'Create a new release' },
        { id: 'get_deploys', name: 'Get Deploys', description: 'List all deploys' },
        { id: 'get_teams', name: 'Get Teams', description: 'List all teams' },
        { id: 'get_organization', name: 'Get Organization', description: 'Get organization details' },
      ],
      triggers: [
        { id: 'new_issue', name: 'New Issue', description: 'Triggered when new issue created' },
        { id: 'regression', name: 'Regression', description: 'Triggered when issue regresses' },
        { id: 'resolved', name: 'Resolved', description: 'Triggered when issue resolved' },
        { id: 'escalating', name: 'Escalating', description: 'Triggered when issue escalates' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'authToken', label: 'Auth Token', description: 'Your Sentry auth token', required: true },
          { name: 'organizationSlug', label: 'Org Slug', description: 'Your Sentry organization slug', required: true },
        ],
      },
      connectionTest: { endpoint: '/organizations/@current/', method: 'GET' },
    };
  }
}

export const sentryPlugin = new SentryPlugin();