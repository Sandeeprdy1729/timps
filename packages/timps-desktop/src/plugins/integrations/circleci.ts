import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface CircleCIProject {
  slug: string;
  name: string;
  id: string;
  vcs_info: { branch: string; tag: string; repo_type: string; provider: string };
  ssh_keys?: Array<{ fingerprint: string; type: string }>;
}

export interface CircleCIPipeline {
  id: string;
  project_slug: string;
  number: number;
  state: 'pending' | 'running' | 'not_run' | 'queued' | 'scheduled' | 'waiting_for_resource' | 'failed' | 'fixed' | 'success' | 'canceled';
  created_at: string;
  stop_time?: string;
}

export interface CircleCIWorkflow {
  id: string;
  name: string;
  project_name: string;
  status: 'pending' | 'running' | 'not_run' | 'queued' | 'scheduled' | 'waiting_for_resource' | 'failed' | 'fixed' | 'success' | 'canceled';
  created_at: string;
  stopped_at?: string;
  pipeline_id: string;
}

export interface CircleCIJob {
  id: string;
  name: string;
  type: string;
  status: string;
  started_at: string;
  stopped_at?: string;
  job_number?: number;
  workflow?: { id: string; name: string };
}

export interface CircleCITestMetadata {
  namespace: string;
  name: string;
  source: string;
  focus: string[];
  siblings: string[];
}

export interface CircleCIArtifact {
  path: string;
  url: string;
  node_index: number;
  pretty_path: string;
}

export interface CircleCIUser {
  id: string;
  login: string;
  name: string;
  avatar_url: string;
}

export interface CircleCIEnvironmentVariable {
  variable: string;
  value: string;
}

const MANIFEST: PluginManifest = {
  id: 'circleci',
  name: 'CircleCI',
  version: '1.0.0',
  description: 'CircleCI integration for CI/CD pipelines, workflows, and job management',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['circleci', 'ci', 'cd', 'pipeline', 'devops'],
};

const SCOPES = [
  'getProjects',
  'getProject',
  'getProjectConfig',
  'getPipelines',
  'getPipeline',
  'triggerPipeline',
  'cancelPipeline',
  'getWorkflows',
  'getWorkflow',
  'rerunWorkflow',
  'cancelWorkflow',
  'getWorkflowJobs',
  'getJobs',
  'getJob',
  'cancelJob',
  'rerunJob',
  'artifacts',
  'getArtifact',
  'downloadArtifact',
  'getTestMetadata',
  'getUser',
  'getSSHKeys',
  'addSSHKey',
  'getEnvVars',
  'addEnvVar',
  'deleteEnvVar',
  'getInsights',
  'getJobLogs',
  'getJobRequirements',
];

export default class CircleCIIntegration extends IntegrationBase {
  private apiBase = 'https://circleci.com/api/v2';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['workflow_completed', 'workflow_failed', 'job_started', 'job_completed', 'job_failed'],
      dataModels: ['project', 'pipeline', 'workflow', 'job', 'artifact', 'test'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey) {
      throw new Error('API token is required');
    }
    this.setApiKey(config.apiKey);

    try {
      const user = await this.apiCall<CircleCIUser>(`${this.apiBase}/me`, {
        headers: { 'Circle-Token': config.apiKey },
      });
      return !!user.id;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.apiCall(`${this.apiBase}/me`, {
        headers: { 'Circle-Token': this.apiKey },
      });
      return true;
    } catch {
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return { 'Circle-Token': this.apiKey || '' };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey) throw new Error('Not authenticated');

    const headers = this.getAuthHeaders();

    switch (action) {
      case 'getProjects':
        return this.apiCall<{ items: CircleCIProject[] }>(`${this.apiBase}/projects`, {
          headers,
        });

      case 'getProject':
        return this.apiCall<CircleCIProject>(
          `${this.apiBase}/project/${params.projectSlug}`,
          { headers }
        );

      case 'getProjectConfig':
        return this.apiCall<{ config: string }>(
          `${this.apiBase}/project/${params.projectSlug}/config`,
          { headers }
        );

      case 'getPipelines':
        return this.apiCall<{ items: CircleCIPipeline[] }>(
          `${this.apiBase}/project/${params.projectSlug}/pipeline`,
          { headers }
        );

      case 'getPipeline':
        return this.apiCall<CircleCIPipeline>(
          `${this.apiBase}/pipeline/${params.pipelineId}`,
          { headers }
        );

      case 'triggerPipeline':
        return this.apiCall<CircleCIPipeline>(
          `${this.apiBase}/project/${params.projectSlug}/pipeline`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.config),
          }
        );

      case 'cancelPipeline':
        return this.apiCall<CircleCIPipeline>(
          `${this.apiBase}/pipeline/${params.pipelineId}/cancel`,
          {
            method: 'POST',
            headers,
          }
        );

      case 'getWorkflows':
        return this.apiCall<{ items: CircleCIWorkflow[] }>(
          `${this.apiBase}/project/${params.projectSlug}/workflow`,
          { headers }
        );

      case 'getWorkflow':
        return this.apiCall<CircleCIWorkflow>(
          `${this.apiBase}/workflow/${params.workflowId}`,
          { headers }
        );

      case 'rerunWorkflow':
        return this.apiCall<CircleCIWorkflow>(
          `${this.apiBase}/workflow/${params.workflowId}/rerun`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ from_failed: params.fromFailed }),
          }
        );

      case 'cancelWorkflow':
        return this.apiCall<CircleCIWorkflow>(
          `${this.apiBase}/workflow/${params.workflowId}/cancel`,
          {
            method: 'POST',
            headers,
          }
        );

      case 'getWorkflowJobs':
        return this.apiCall<{ items: CircleCIJob[] }>(
          `${this.apiBase}/workflow/${params.workflowId}/job`,
          { headers }
        );

      case 'getJobs':
        return this.apiCall<{ items: CircleCIJob[] }>(
          `${this.apiBase}/project/${params.projectSlug}/job`,
          { headers }
        );

      case 'getJob':
        return this.apiCall<CircleCIJob>(
          `${this.apiBase}/project/${params.projectSlug}/job/${params.jobNumber}`,
          { headers }
        );

      case 'cancelJob':
        return this.apiCall<CircleCIJob>(
          `${this.apiBase}/project/${params.projectSlug}/job/${params.jobNumber}/cancel`,
          {
            method: 'POST',
            headers,
          }
        );

      case 'rerunJob':
        return this.apiCall<CircleCIJob>(
          `${this.apiBase}/project/${params.projectSlug}/job/${params.jobNumber}/rerun`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ from_failed: params.fromFailed }),
          }
        );

      case 'artifacts':
        return this.apiCall<{ items: CircleCIArtifact[] }>(
          `${this.apiBase}/project/${params.projectSlug}/job/${params.jobNumber}/artifacts`,
          { headers }
        );

      case 'getArtifact':
        return this.apiCall<CircleCIArtifact>(
          `${this.apiBase}/project/${params.projectSlug}/job/${params.jobNumber}/artifacts/${params.path}`,
          { headers }
        );

      case 'getTestMetadata':
        return this.apiCall<CircleCITestMetadata>(
          `${this.apiBase}/project/${params.projectSlug}/job/${params.jobNumber}/tests`,
          { headers }
        );

      case 'getUser':
        return this.apiCall<CircleCIUser>(`${this.apiBase}/me`, { headers });

      case 'getSSHKeys':
        return this.apiCall<{ items: unknown[] }>(`${this.apiBase}/user/ssh-keys`, {
          headers,
        });

      case 'addSSHKey':
        return this.apiCall<{ message: string }>(`${this.apiBase}/user/ssh-keys`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.sshKey),
        });

      case 'getEnvVars':
        return this.apiCall<{ items: CircleCIEnvironmentVariable[] }>(
          `${this.apiBase}/project/${params.projectSlug}/envvar`,
          { headers }
        );

      case 'addEnvVar':
        return this.apiCall<{ name: string; value: string }>(
          `${this.apiBase}/project/${params.projectSlug}/envvar`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.envVar),
          }
        );

      case 'deleteEnvVar':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/project/${params.projectSlug}/envvar/${params.variable}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getInsights':
        return this.apiCall<{ workflow: unknown }>(
          `${this.apiBase}/insights/${params.projectSlug}/${params.workflowName}`,
          { headers }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'projects':
        return this.executeAction('getProjects', options || {});
      case 'pipelines':
        return this.executeAction('getPipelines', { projectSlug: options?.projectSlug });
      case 'workflows':
        return this.executeAction('getWorkflows', { projectSlug: options?.projectSlug });
      case 'jobs':
        return this.executeAction('getJobs', { projectSlug: options?.projectSlug });
      case 'user':
        return this.executeAction('getUser', options || {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.apiKey = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createCircleCIIntegration(): CircleCIIntegration {
  return new CircleCIIntegration();
}