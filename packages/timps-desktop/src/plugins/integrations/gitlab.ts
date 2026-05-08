import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  description: string;
  default_branch: string;
  visibility: 'private' | 'internal' | 'public';
  web_url: string;
  avatar_url: string | null;
  star_count: number;
  forks_count: number;
  last_activity_at: string;
  namespace: GitLabNamespace;
}

export interface GitLabNamespace {
  id: number;
  name: string;
  path: string;
  kind: 'user' | 'group';
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  source_branch: string;
  target_branch: string;
  author: GitLabUser;
  assignees: GitLabUser[];
  reviewers: GitLabUser[];
  web_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed';
  author: GitLabUser;
  assignees: GitLabUser[];
  labels: string[];
  web_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  due_date: string | null;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  state: 'active' | 'inactive';
  avatar_url: string;
  web_url: string;
}

export interface GitLabBranch {
  name: string;
  commit: GitLabCommit;
  merged: boolean;
  protected: boolean;
  developers_can_push: boolean;
  developers_can_merge: boolean;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  author_name: string;
  author_email: string;
  created_at: string;
  message: string;
}

export interface GitLabTag {
  name: string;
  message: string | null;
  target: string;
  commit: GitLabCommit;
  release: { tag_name: string; description: string } | null;
}

export interface GitLabRelease {
  tag_name: string;
  description: string;
  name: string;
  released_at: string;
}

export interface GitLabPipeline {
  id: number;
  iid: number;
  project_id: number;
  status: 'created' | 'waiting_for_resource' | 'preparing' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual' | 'scheduled';
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabJob {
  id: number;
  name: string;
  status: string;
  stage: string;
  ref: string;
  web_url: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
}

export interface GitLabSnippet {
  id: number;
  title: string;
  description: string;
  visibility: 'private' | 'internal' | 'public';
  author: GitLabUser;
  created_at: string;
  updated_at: string;
}

export interface GitLabWikiPage {
  title: string;
  content: string;
  format: 'markdown' | 'rdoc';
}

export interface GitLabMilestone {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'active' | 'closed';
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitLabLabel {
  id: number;
  name: string;
  color: string;
  description: string;
  open_issues_count: number;
  closed_issues_count: number;
}

export interface GitLabProtectedBranch {
  name: string;
  push_access_levels: Array<{ access_level: number; access_level_description: string }>;
  merge_access_levels: Array<{ access_level: number; access_level_description: string }>;
  code_owner_approval_required: boolean;
}

export interface GitLabVariable {
  id: number;
  key: string;
  value: string;
  variable_type: 'env_var' | 'file';
  protected: boolean;
  masked: boolean;
  environment_scope: string;
}

export interface GitLabDeployToken {
  id: number;
  name: string;
  username: string;
  expires_at: string;
  scopes: string[];
  created_at: string;
}

export interface GitLabDeployKey {
  id: number;
  title: string;
  key: string;
  fingerprint: string;
  fingerprint_sha256: string;
  fingerprint_md5: string;
  created_at: string;
}

export interface GitLabTrigger {
  id: number;
  description: string;
  ref: string;
  token: string;
  created_at: string;
}

export interface GitLabEpic {
  id: number;
  iid: number;
  group_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed';
  author: GitLabUser;
  labels: string[];
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitLabHook {
  id: number;
  url: string;
  hook_type: string;
  token: string;
  push_events: boolean;
  tag_push_events: boolean;
  issues_events: boolean;
  merge_requests_events: boolean;
  note_events: boolean;
  enabled: boolean;
  created_at: string;
}

const MANIFEST: PluginManifest = {
  id: 'gitlab',
  name: 'GitLab',
  version: '1.0.0',
  description: 'GitLab integration for repository management, CI/CD, issues, and merge requests',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['gitlab', 'git', 'ci', 'cd', 'devops'],
};

const SCOPES = [
  'getProjects', 'getProject', 'createProject', 'updateProject', 'deleteProject', 'forkProject',
  'getMergeRequests', 'getMergeRequest', 'createMergeRequest', 'updateMergeRequest', 'closeMergeRequest', 'mergeMergeRequest', 'rebaseMergeRequest',
  'getIssues', 'getIssue', 'createIssue', 'updateIssue', 'closeIssue', 'reopenIssue',
  'getLabels', 'createLabel', 'updateLabel', 'deleteLabel',
  'getMilestones', 'createMilestone', 'updateMilestone', 'deleteMilestone',
  'getBranches', 'createBranch', 'deleteBranch', 'getProtectedBranch', 'updateProtectedBranch',
  'getTags', 'createTag', 'deleteTag',
  'getReleases', 'createRelease', 'updateRelease', 'deleteRelease',
  'getPipelines', 'getPipeline', 'createPipeline', 'cancelPipeline', 'retryPipeline', 'playPipeline',
  'getJobs', 'getJob', 'playJob', 'retryJob', 'cancelJob',
  'getCommits', 'getCommit', 'createCommit', 'getCommitDiff',
  'getFiles', 'getFile', 'createFile', 'updateFile', 'deleteFile',
  'getSnippets', 'createSnippet', 'updateSnippet', 'deleteSnippet',
  'getWikis', 'getWikiPage', 'createWikiPage', 'updateWikiPage', 'deleteWikiPage',
  'getVariables', 'createVariable', 'updateVariable', 'deleteVariable',
  'getDeployTokens', 'createDeployToken', 'deleteDeployToken',
  'getDeployKeys', 'createDeployKey', 'deleteDeployKey',
  'getTriggers', 'createTrigger', 'deleteTrigger',
  'getHooks', 'createHook', 'updateHook', 'deleteHook',
  'getMembers', 'addMember', 'removeMember',
  'getEpics', 'getEpic', 'createEpic', 'updateEpic', 'deleteEpic',
  'shareProject', 'createProjectSnippet', 'getProjectHooks', 'archiveProject', 'unarchiveProject',
  'getProjectVariables', 'getProjectPipelines', 'getProjectMergeRequests', 'getProjectIssues',
  'getProjectMembers', 'getProjectLanguages', 'getProjectStorage', 'getProjectHooks', 'createProjectHook',
  'getProjectSnippets', 'getProjectTags', 'getProjectBranches', 'getProjectCommits',
  'getProjectFiles', 'getRawFile', 'getBlobs', 'getRawBlobs',
  'getProjectwikis', 'getProjectMilestones', 'getLabels',
  'createProjectLabel', 'getProjectDeployTokens',
  'getProjectTriggers', 'createProjectTrigger', 'getProjectVariables',
  'getGroupMembers', 'getGroupMergeRequests', 'getGroupIssues', 'getGroupPipelines',
  'getGroupEpics', 'createGroupEpic', 'getGroupLabels',
  'getGroupVariables', 'createGroupVariable', 'getGroupVariables',
  'listProjectIssues', 'createProjectIssue', 'listProjectMergeRequests',
  'listProject Pipelines', 'listProjectJobs', 'listProjectFiles',
];

export default class GitLabIntegration extends IntegrationBase {
  private apiBase = 'https://gitlab.com/api/v4';
  private projectId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['push', 'merge_request_created', 'merge_request_merged', 'merge_request_closed', 'issue_created', 'issue_closed', 'tag_created', 'pipeline_created', 'pipeline_success', 'pipeline_failed'],
      dataModels: ['project', 'merge_request', 'issue', 'branch', 'commit', 'tag', 'release', 'pipeline', 'job', 'milestone', 'label', 'snippet', 'wiki', 'variable', 'deploy_token', 'deploy_key', 'trigger', 'hook', 'epic'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);

    try {
      const user = await this.apiCall<GitLabUser>(`${this.apiBase}/user`, {
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

    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };
    const projectId = params.projectId || this.projectId;
    const projectPath = projectId ? `projects/${projectId}` : '';

    switch (action) {
      case 'getProjects':
        return this.apiCall<GitLabProject[]>(`${this.apiBase}/projects`, { headers });

      case 'getProject':
        return this.apiCall<GitLabProject>(`${this.apiBase}/projects/${params.projectId}`, { headers });

      case 'createProject':
        return this.apiCall<GitLabProject>(`${this.apiBase}/projects`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.project),
        });

      case 'updateProject':
        return this.apiCall<GitLabProject>(`${this.apiBase}/projects/${params.projectId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteProject':
        return this.apiCall(`${this.apiBase}/projects/${params.projectId}`, {
          method: 'DELETE',
          headers,
        });

      case 'forkProject':
        return this.apiCall<GitLabProject>(`${this.apiBase}/projects/${params.projectId}/fork`, {
          method: 'POST',
          headers,
        });

      case 'archiveProject':
        return this.apiCall(`${this.apiBase}/projects/${params.projectId}/archive`, {
          method: 'POST',
          headers,
        });

      case 'unarchiveProject':
        return this.apiCall(`${this.apiBase}/projects/${params.projectId}/unarchive`, {
          method: 'POST',
          headers,
        });

      case 'getMergeRequests':
        return this.apiCall<GitLabMergeRequest[]>(`${projectPath}/merge_requests`, { headers });

      case 'getMergeRequest':
        return this.apiCall<GitLabMergeRequest>(`${projectPath}/merge_requests/${params.mrIid}`, {
          headers,
        });

      case 'createMergeRequest':
        return this.apiCall<GitLabMergeRequest>(`${projectPath}/merge_requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.mergeRequest),
        });

      case 'updateMergeRequest':
        return this.apiCall<GitLabMergeRequest>(`${projectPath}/merge_requests/${params.mrIid}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'mergeMergeRequest':
        return this.apiCall<GitLabMergeRequest>(`${projectPath}/merge_requests/${params.mrIid}/merge`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.options),
        });

      case 'closeMergeRequest':
        return this.apiCall<GitLabMergeRequest>(`${projectPath}/merge_requests/${params.mrIid}/close`, {
          method: 'PUT',
          headers,
        });

      case 'rebaseMergeRequest':
        return this.apiCall(`${projectPath}/merge_requests/${params.mrIid}/rebase`, {
          method: 'PUT',
          headers,
        });

      case 'getIssues':
        return this.apiCall<GitLabIssue[]>(`${projectPath}/issues`, { headers });

      case 'getIssue':
        return this.apiCall<GitLabIssue>(`${projectPath}/issues/${params.issueIid}`, { headers });

      case 'createIssue':
        return this.apiCall<GitLabIssue>(`${projectPath}/issues`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.issue),
        });

      case 'updateIssue':
        return this.apiCall<GitLabIssue>(`${projectPath}/issues/${params.issueIid}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'closeIssue':
        return this.apiCall<GitLabIssue>(`${projectPath}/issues/${params.issueIid}/close`, {
          method: 'PUT',
          headers,
        });

      case 'reopenIssue':
        return this.apiCall<GitLabIssue>(`${projectPath}/issues/${params.issueIid}/reopen`, {
          method: 'PUT',
          headers,
        });

      case 'getBranches':
        return this.apiCall<GitLabBranch[]>(`${projectPath}/repository/branches`, { headers });

      case 'createBranch':
        return this.apiCall<GitLabBranch>(`${projectPath}/repository/branches`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: params.name, ref: params.ref }),
        });

      case 'deleteBranch':
        return this.apiCall(`${projectPath}/repository/branches/${params.name}`, {
          method: 'DELETE',
          headers,
        });

      case 'getProtectedBranch':
        return this.apiCall<GitLabProtectedBranch>(`${projectPath}/protected_branches`, { headers });

      case 'updateProtectedBranch':
        return this.apiCall<GitLabProtectedBranch>(`${projectPath}/protected_branches/${params.name}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.protectedBranch),
        });

      case 'getTags':
        return this.apiCall<GitLabTag[]>(`${projectPath}/repository/tags`, { headers });

      case 'createTag':
        return this.apiCall<GitLabTag>(`${projectPath}/repository/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.tag),
        });

      case 'getCommits':
        return this.apiCall<GitLabCommit[]>(`${projectPath}/repository/commits`, { headers });

      case 'getCommit':
        return this.apiCall<GitLabCommit>(`${projectPath}/repository/commits/${params.sha}`, {
          headers,
        });

      case 'createCommit':
        return this.apiCall<GitLabCommit>(`${projectPath}/repository/commits`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.commit),
        });

      case 'getCommitDiff':
        return this.apiCall(`${projectPath}/repository/commits/${params.sha}/diff`, {
          headers,
        });

      case 'getFiles':
        return this.apiCall<{ name: string; type: string }[]>(`${projectPath}/repository/tree`, {
          headers,
        });

      case 'getFile':
        return this.apiCall(`${projectPath}/repository/files/${params.filePath}`, {
          headers,
        });

      case 'createFile':
        return this.apiCall(`${projectPath}/repository/files/${params.filePath}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.file),
        });

      case 'updateFile':
        return this.apiCall(`${projectPath}/repository/files/${params.filePath}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.file),
        });

      case 'deleteFile':
        return this.apiCall(`${projectPath}/repository/files/${params.filePath}`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ branch: params.branch, commit_message: params.message }),
        });

      case 'getPipelines':
        return this.apiCall<GitLabPipeline[]>(`${projectPath}/pipelines`, { headers });

      case 'getPipeline':
        return this.apiCall<GitLabPipeline>(`${projectPath}/pipelines/${params.pipelineId}`, {
          headers,
        });

      case 'createPipeline':
        return this.apiCall<GitLabPipeline>(`${projectPath}/pipeline`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ref: params.ref }),
        });

      case 'cancelPipeline':
        return this.apiCall<GitLabPipeline>(`${projectPath}/pipelines/${params.pipelineId}/cancel`, {
          method: 'POST',
          headers,
        });

      case 'retryPipeline':
        return this.apiCall<GitLabPipeline>(`${projectPath}/pipelines/${params.pipelineId}/retry`, {
          method: 'POST',
          headers,
        });

      case 'playPipeline':
        return this.apiCall<GitLabPipeline>(`${projectPath}/pipelines/${params.pipelineId}/play`, {
          method: 'POST',
          headers,
        });

      case 'getJobs':
        return this.apiCall<GitLabJob[]>(`${projectPath}/pipelines/${params.pipelineId}/jobs`, {
          headers,
        });

      case 'getJob':
        return this.apiCall<GitLabJob>(`${projectPath}/jobs/${params.jobId}`, { headers });

      case 'playJob':
        return this.apiCall<GitLabJob>(`${projectPath}/jobs/${params.jobId}/play`, {
          method: 'POST',
          headers,
        });

      case 'retryJob':
        return this.apiCall<GitLabJob>(`${projectPath}/jobs/${params.jobId}/retry`, {
          method: 'POST',
          headers,
        });

      case 'cancelJob':
        return this.apiCall<GitLabJob>(`${projectPath}/jobs/${params.jobId}/cancel`, {
          method: 'POST',
          headers,
        });

      case 'getMilestones':
        return this.apiCall<GitLabMilestone[]>(`${projectPath}/milestones`, { headers });

      case 'createMilestone':
        return this.apiCall<GitLabMilestone>(`${projectPath}/milestones`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.milestone),
        });

      case 'updateMilestone':
        return this.apiCall<GitLabMilestone>(`${projectPath}/milestones/${params.milestoneId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'getLabels':
        return this.apiCall<GitLabLabel[]>(`${projectPath}/labels`, { headers });

      case 'createLabel':
        return this.apiCall<GitLabLabel>(`${projectPath}/labels`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.label),
        });

      case 'getReleases':
        return this.apiCall<GitLabRelease[]>(`${projectPath}/releases`, { headers });

      case 'createRelease':
        return this.apiCall<GitLabRelease>(`${projectPath}/releases`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.release),
        });

      case 'getSnippets':
        return this.apiCall<GitLabSnippet[]>(`${projectPath}/snippets`, { headers });

      case 'createSnippet':
        return this.apiCall<GitLabSnippet>(`${projectPath}/snippets`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.snippet),
        });

      case 'getWikis':
        return this.apiCall<GitLabWikiPage[]>(`${projectPath}/wikis`, { headers });

      case 'getWikiPage':
        return this.apiCall<GitLabWikiPage>(`${projectPath}/wikis/${params.slug}`, {
          headers,
        });

      case 'createWikiPage':
        return this.apiCall<GitLabWikiPage>(`${projectPath}/wikis`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.wiki),
        });

      case 'getVariables':
        return this.apiCall<GitLabVariable[]>(`${projectPath}/variables`, { headers });

      case 'createVariable':
        return this.apiCall<GitLabVariable>(`${projectPath}/variables`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.variable),
        });

      case 'updateVariable':
        return this.apiCall<GitLabVariable>(`${projectPath}/variables/${params.key}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.variable),
        });

      case 'deployTokens':
        return this.apiCall<GitLabDeployToken[]>(`${projectPath}/deploy_tokens`, { headers });

      case 'createDeployToken':
        return this.apiCall<GitLabDeployToken>(`${projectPath}/deploy_tokens`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.token),
        });

      case 'getDeployKeys':
        return this.apiCall<GitLabDeployKey[]>(`${projectPath}/deploy_keys`, { headers });

      case 'createDeployKey':
        return this.apiCall<GitLabDeployKey>(`${projectPath}/deploy_keys`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.key),
        });

      case 'getTriggers':
        return this.apiCall<GitLabTrigger[]>(`${projectPath}/triggers`, { headers });

      case 'createTrigger':
        return this.apiCall<GitLabTrigger>(`${projectPath}/triggers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ description: params.description }),
        });

      case 'deleteTrigger':
        return this.apiCall(`${projectPath}/triggers/${params.triggerId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getHooks':
        return this.apiCall<GitLabHook[]>(`${projectPath}/hooks`, { headers });

      case 'createHook':
        return this.apiCall<GitLabHook>(`${projectPath}/hooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.hook),
        });

      case 'updateHook':
        return this.apiCall<GitLabHook>(`${projectPath}/hooks/${params.hookId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(params.hook),
        });

      case 'deleteHook':
        return this.apiCall(`${projectPath}/hooks/${params.hookId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getMembers':
        return this.apiCall<GitLabUser[]>(`${projectPath}/members/all`, { headers });

      case 'addMember':
        return this.apiCall<GitLabUser>(`${projectPath}/members/all`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.member),
        });

      case 'removeMember':
        return this.apiCall(`${projectPath}/members/all/${params.userId}`, {
          method: 'DELETE',
          headers,
        });

      case 'shareProject':
        return this.apiCall(`${this.apiBase}/projects/${params.projectId}/share`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.share),
        });

      case 'getProjectLanguages':
        return this.apiCall<Record<string, number>>(`${projectPath}/languages`, { headers });

      case 'getProjectStorage':
        return this.apiCall(`${projectPath}/storage`, { headers });

      case 'getGroupMergeRequests':
        return this.apiCall<GitLabMergeRequest[]>(`${this.apiBase}/groups/${params.groupId}/merge_requests`, {
          headers,
        });

      case 'getGroupIssues':
        return this.apiCall<GitLabIssue[]>(`${this.apiBase}/groups/${params.groupId}/issues`, {
          headers,
        });

      case 'getGroupPipelines':
        return this.apiCall<GitLabPipeline[]>(`${this.apiBase}/groups/${params.groupId}/pipelines`, {
          headers,
        });

      case 'getGroupEpics':
        return this.apiCall<GitLabEpic[]>(`${this.apiBase}/groups/${params.groupId}/epics`, {
          headers,
        });

      case 'createGroupEpic':
        return this.apiCall<GitLabEpic>(`${this.apiBase}/groups/${params.groupId}/epics`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.epic),
        });

      case 'getGroupLabels':
        return this.apiCall<GitLabLabel[]>(`${this.apiBase}/groups/${params.groupId}/labels`, {
          headers,
        });

      case 'getGroupMembers':
        return this.apiCall<GitLabUser[]>(`${this.apiBase}/groups/${params.groupId}/members`, {
          headers,
        });

      case 'addGroupMember':
        return this.apiCall<GitLabUser>(`${this.apiBase}/groups/${params.groupId}/members`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.member),
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'projects':
        return this.executeAction('getProjects', options || {});
      case 'merge_requests':
        return this.executeAction('getMergeRequests', options || {});
      case 'issues':
        return this.executeAction('getIssues', options || {});
      case 'branches':
        return this.executeAction('getBranches', options || {});
      case 'tags':
        return this.executeAction('getTags', options || {});
      case 'commits':
        return this.executeAction('getCommits', options || {});
      case 'pipelines':
        return this.executeAction('getPipelines', options || {});
      case 'jobs':
        return this.executeAction('getJobs', options || {});
      case 'milestones':
        return this.executeAction('getMilestones', options || {});
      case 'labels':
        return this.executeAction('getLabels', options || {});
      case 'releases':
        return this.executeAction('getReleases', options || {});
      case 'snippets':
        return this.executeAction('getSnippets', options || {});
      case 'variables':
        return this.executeAction('getVariables', options || {});
      case 'hooks':
        return this.executeAction('getHooks', options || {});
      case 'members':
        return this.executeAction('getMembers', options || {});
      case 'user':
        return this.apiCall<GitLabUser>(`${this.apiBase}/user`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.projectId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createGitLabIntegration(): GitLabIntegration {
  return new GitLabIntegration();
}