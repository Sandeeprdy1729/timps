import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('GitHub Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.github.com';
  
  interface GitHubFile { name: string; path: string; type: string; }
  interface GitHubUser { login: string; id: number; avatar_url: string; name: string; email: string; }
  interface GitHubRepo { name: string; full_name: string; private: boolean; html_url: string; description: string; fork: boolean; }
  interface GitHubIssue { number: number; title: string; state: string; body: string; user: GitHubUser; labels: { name: string }[]; assignees: GitHubUser[]; created_at: string; updated_at: string; }
  interface GitHubPullRequest { number: number; title: string; state: string; body: string; user: GitHubUser; head: { ref: string; sha: string }; base: { ref: string }; merged: boolean; }
  interface GitHubCommit { sha: string; message: string; author: { name: string; email: string }; date: string; }
  interface GitHubRelease { id: number; tag_name: string; name: string; body: string; draft: boolean; prerelease: boolean; published_at: string; }
  interface GitHubWorkflowRun { id: number; name: string; status: string; conclusion: string; head_branch: string; run_number: number; event: string; }
  interface GitHubAction { id: number; name: string; description: string; }
  interface GitHubSecret { name: string; created_at: string; updated_at: string; }
  interface GitHubWebhook { id: number; name: string; events: string[]; config: { url: string; content_type: string }; active: boolean; }

  const mockUser: GitHubUser = { login: 'testuser', id: 12345, avatar_url: 'https://avatar.com/user', name: 'Test User', email: 'test@example.com' };
  const mockRepo: GitHubRepo = { name: 'test-repo', full_name: 'testuser/test-repo', private: false, html_url: 'https://github.com/testuser/test-repo', description: 'A test repository', fork: false };
  const mockIssue: GitHubIssue = { number: 1, title: 'Test Issue', state: 'open', body: 'Issue description', user: mockUser, labels: [{ name: 'bug' }], assignees: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' };
  const mockPr: GitHubPullRequest = { number: 1, title: 'Test PR', state: 'open', body: 'PR description', user: mockUser, head: { ref: 'feature', sha: 'abc123' }, base: { ref: 'main' }, merged: false };
  const mockCommit: GitHubCommit = { sha: 'abc123def456', message: 'Test commit', author: { name: 'Test User', email: 'test@example.com' }, date: '2024-01-01T00:00:00Z' };

  beforeEach(() => { nock.disableNetConnect(); });
  afterEach(() => { nock.cleanAll(); });

  describe('User API', () => {
    it('should get authenticated user', async () => {
      nock(baseUrl).get('/user').reply(200, mockUser);
      const res = await fetch(`${baseUrl}/user`);
      const data = await res.json();
      expect(data.login).toBe('testuser');
      expect(data.id).toBe(12345);
      expect(data.name).toBe('Test User');
    });

    it('should update authenticated user', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name', blog: 'https://blog.com' };
      nock(baseUrl).patch('/user').reply(200, updatedUser);
      const res = await fetch(`${baseUrl}/user`, { method: 'PATCH', body: JSON.stringify({ name: 'Updated Name' }) });
      const data = await res.json();
      expect(data.name).toBe('Updated Name');
    });

    it('should get user emails', async () => {
      const emails = [{ email: 'test@example.com', primary: true, verified: true }];
      nock(baseUrl).get('/user/emails').reply(200, emails);
      const res = await fetch(`${baseUrl}/user/emails`);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].primary).toBe(true);
    });

    it('should get user SSH keys', async () => {
      const keys = [{ id: 1, key: 'ssh-rsa AAAAB...' }];
      nock(baseUrl).get('/user/keys').reply(200, keys);
      const res = await fetch(`${baseUrl}/user/keys`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should handle unauthorized (401)', async () => {
      nock(baseUrl).get('/user').reply(401, { message: 'Bad credentials' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.status).toBe(401);
    });

    it('should handle forbidden (403)', async () => {
      nock(baseUrl).get('/user').reply(403, { message: 'Forbidden' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.status).toBe(403);
    });

    it('should handle not found (404)', async () => {
      nock(baseUrl).get('/users/nonexistent').reply(404, { message: 'Not Found' });
      const res = await fetch(`${baseUrl}/users/nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  describe('Repository API', () => {
    it('should get repository', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo').reply(200, mockRepo);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo`);
      const data = await res.json();
      expect(data.name).toBe('test-repo');
      expect(data.full_name).toBe('testuser/test-repo');
    });

    it('should list user repositories', async () => {
      nock(baseUrl).get('/user/repos').reply(200, [mockRepo]);
      const res = await fetch(`${baseUrl}/user/repos`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create repository', async () => {
      const newRepo = { name: 'new-repo', private: false };
      nock(baseUrl).post('/user/repos').reply(201, newRepo);
      const res = await fetch(`${baseUrl}/user/repos`, { method: 'POST', body: JSON.stringify(newRepo) });
      expect(res.status).toBe(201);
    });

    it('should update repository', async () => {
      const updated = { ...mockRepo, description: 'Updated description' };
      nock(baseUrl).patch('/repos/testuser/test-repo').reply(200, updated);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo`, { method: 'PATCH', body: JSON.stringify({ description: 'Updated description' }) });
      const data = await res.json();
      expect(data.description).toBe('Updated description');
    });

    it('should delete repository', async () => {
      nock(baseUrl).delete('/repos/testuser/test-repo').reply(204, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should list repository collaborators', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/collaborators').reply(200, [mockUser]);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/collaborators`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should list repository languages', async () => {
      const languages = { JavaScript: 1000, TypeScript: 500 };
      nock(baseUrl).get('/repos/testuser/test-repo/languages').reply(200, languages);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/languages`);
      const data = await res.json();
      expect(data.JavaScript).toBe(1000);
    });

    it('should list repository tags', async () => {
      const tags = [{ name: 'v1.0.0', commit: { sha: 'abc123' } }];
      nock(baseUrl).get('/repos/testuser/test-repo/tags').reply(200, tags);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/tags`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should list repository branches', async () => {
      const branches = [{ name: 'main', commit: { sha: 'abc123' } }];
      nock(baseUrl).get('/repos/testuser/test-repo/branches').reply(200, branches);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/branches`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should handle private repo without permission (403)', async () => {
      nock(baseUrl).get('/repos/private/repo').reply(403, { message: 'Resource not accessible' });
      const res = await fetch(`${baseUrl}/repos/private/repo`);
      expect(res.status).toBe(403);
    });
  });

  describe('Issues API', () => {
    it('should list repository issues', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/issues').reply(200, [mockIssue]);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues`);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].number).toBe(1);
    });

    it('should get issue', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/issues/1').reply(200, mockIssue);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1`);
      const data = await res.json();
      expect(data.title).toBe('Test Issue');
    });

    it('should create issue', async () => {
      const newIssue = { title: 'New Issue', body: 'Description' };
      nock(baseUrl).post('/repos/testuser/test-repo/issues').reply(201, newIssue);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues`, { method: 'POST', body: JSON.stringify(newIssue) });
      expect(res.status).toBe(201);
    });

    it('should update issue', async () => {
      const updated = { ...mockIssue, title: 'Updated Title', state: 'closed' };
      nock(baseUrl).patch('/repos/testuser/test-repo/issues/1').reply(200, updated);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1`, { method: 'PATCH', body: JSON.stringify({ title: 'Updated Title' }) });
      const data = await res.json();
      expect(data.title).toBe('Updated Title');
    });

    it('should list issue comments', async () => {
      const comments = [{ id: 1, body: 'Comment', user: mockUser }];
      nock(baseUrl).get('/repos/testuser/test-repo/issues/1/comments').reply(200, comments);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1/comments`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create issue comment', async () => {
      const comment = { id: 1, body: 'New comment' };
      nock(baseUrl).post('/repos/testuser/test-repo/issues/1/comments').reply(201, comment);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1/comments`, { method: 'POST', body: JSON.stringify({ body: 'New comment' }) });
      expect(res.status).toBe(201);
    });

    it('should add issue labels', async () => {
      const labels = [{ name: 'enhancement' }];
      nock(baseUrl).post('/repos/testuser/test-repo/issues/1/labels').reply(200, labels);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1/labels`, { method: 'POST', body: JSON.stringify({ labels: ['enhancement'] }) });
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should remove issue label', async () => {
      nock(baseUrl).delete('/repos/testuser/test-repo/issues/1/labels/bug').reply(200, []);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1/labels/bug`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should handle issue not found (404)', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/issues/999').reply(404, { message: 'Not Found' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/999`);
      expect(res.status).toBe(404);
    });
  });

  describe('Pull Request API', () => {
    it('should list pull requests', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/pulls').reply(200, [mockPr]);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get pull request', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/pulls/1').reply(200, mockPr);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1`);
      const data = await res.json();
      expect(data.title).toBe('Test PR');
    });

    it('should create pull request', async () => {
      const newPr = { title: 'New PR', body: 'PR body', head: 'feature', base: 'main' };
      nock(baseUrl).post('/repos/testuser/test-repo/pulls').reply(201, newPr);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls`, { method: 'POST', body: JSON.stringify(newPr) });
      expect(res.status).toBe(201);
    });

    it('should update pull request', async () => {
      const updated = { ...mockPr, title: 'Updated PR', state: 'closed' };
      nock(baseUrl).patch('/repos/testuser/test-repo/pulls/1').reply(200, updated);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1`, { method: 'PATCH', body: JSON.stringify({ title: 'Updated PR' }) });
      const data = await res.json();
      expect(data.title).toBe('Updated PR');
    });

    it('should list PR files', async () => {
      const files = [{ filename: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 }];
      nock(baseUrl).get('/repos/testuser/test-repo/pulls/1/files').reply(200, files);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1/files`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should list PR commits', async () => {
      const commits = [{ sha: 'abc123', message: 'Commit' }];
      nock(baseUrl).get('/repos/testuser/test-repo/pulls/1/commits').reply(200, commits);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1/commits`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get PR diff', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/pulls/1').reply(200, '', { 'Content-Type': 'application/vnd.github.v3.diff' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1`);
      expect(res.headers.get('Content-Type')).toContain('diff');
    });

    it('should get PR patch', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/pulls/1').reply(200, '', { 'Content-Type': 'application/vnd.github.v3.patch' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1`);
      expect(res.headers.get('Content-Type')).toContain('patch');
    });

    it('should merge PR', async () => {
      const merged = { sha: 'abc123', merged: true, message: 'Pull Request merged' };
      nock(baseUrl).post('/repos/testuser/test-repo/pulls/1/merge').reply(200, merged);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1/merge`, { method: 'POST' });
      const data = await res.json();
      expect(data.merged).toBe(true);
    });

    it('should handle merge conflict', async () => {
      nock(baseUrl).post('/repos/testuser/test-repo/pulls/1/merge').reply(405, { message: 'Merge conflict', merged: false });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pulls/1/merge`, { method: 'POST' });
      expect(res.status).toBe(405);
    });
  });

  describe('Commit API', () => {
    it('should list commits', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/commits').reply(200, [mockCommit]);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/commits`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get commit', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/commits/abc123def456').reply(200, mockCommit);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/commits/abc123def456`);
      const data = await res.json();
      expect(data.sha).toBe('abc123def456');
    });

    it('should get commit diff', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/commits/abc123def456').reply(200, '', { 'Content-Type': 'application/vnd.github.v3.diff' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/commits/abc123def456`);
      expect(res.headers.get('Content-Type')).toContain('diff');
    });

    it('should list commit comments', async () => {
      const comments = [{ id: 1, body: 'Comment', user: mockUser, line: 10, path: 'src/index.ts' }];
      nock(baseUrl).get('/repos/testuser/test-repo/comments').reply(200, comments);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/comments`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should compare commits', async () => {
      const compare = { status: 'ahead', ahead_by: 2, behind_by: 0, commits: [mockCommit, mockCommit] };
      nock(baseUrl).get('/repos/testuser/test-repo/compare/main...feature').reply(200, compare);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/compare/main...feature`);
      const data = await res.json();
      expect(data.ahead_by).toBe(2);
    });

    it('should handle SHA not found', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/commits/invalid').reply(422, { message: 'Invalid commit SHA' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/commits/invalid`);
      expect(res.status).toBe(422);
    });
  });

  describe('Branches API', () => {
    it('should list branches', async () => {
      const branches = [{ name: 'main', commit: { sha: 'abc123' }, protected: true }];
      nock(baseUrl).get('/repos/testuser/test-repo/branches').reply(200, branches);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/branches`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get branch', async () => {
      const branch = { name: 'main', commit: { sha: 'abc123' }, protected: true };
      nock(baseUrl).get('/repos/testuser/test-repo/branches/main').reply(200, branch);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/branches/main`);
      const data = await res.json();
      expect(data.name).toBe('main');
      expect(data.protected).toBe(true);
    });

    it('should get branch protection', async () => {
      const protection = { required_status_checks: { strict: true, contexts: [] }, required_pull_request_reviews: { required: true } };
      nock(baseUrl).get('/repos/testuser/test-repo/branches/main/protection').reply(200, protection);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/branches/main/protection`);
      const data = await res.json();
      expect(data.required_status_checks).toBeDefined();
    });

    it('should update branch protection', async () => {
      const protection = { required_status_checks: { strict: true, contexts: [] } };
      nock(baseUrl).put('/repos/testuser/test-repo/branches/main/protection').reply(200, protection);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/branches/main/protection`, { method: 'PUT', body: JSON.stringify(protection) });
      expect(res.ok).toBe(true);
    });

    it('should list branch protection rules', async () => {
      const rules = [{ id: 1, name: 'main', type: 'branch_protection' }];
      nock(baseUrl).get('/repos/testuser/test-repo/branches/main/protection/rules').reply(200, rules);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/branches/main/protection/rules`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Release API', () => {
    it('should list releases', async () => {
      const releases = [{ id: 1, tag_name: 'v1.0.0', name: 'Release 1', draft: false, prerelease: false }];
      nock(baseUrl).get('/repos/testuser/test-repo/releases').reply(200, releases);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/releases`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get release', async () => {
      const release: GitHubRelease = { id: 1, tag_name: 'v1.0.0', name: 'Release 1', body: 'Changelog', draft: false, prerelease: false, published_at: '2024-01-01T00:00:00Z' };
      nock(baseUrl).get('/repos/testuser/test-repo/releases/1').reply(200, release);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/releases/1`);
      const data = await res.json();
      expect(data.tag_name).toBe('v1.0.0');
    });

    it('should create release', async () => {
      const release = { tag_name: 'v1.0.0', name: 'Release 1', draft: false };
      nock(baseUrl).post('/repos/testuser/test-repo/releases').reply(201, release);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/releases`, { method: 'POST', body: JSON.stringify(release) });
      expect(res.status).toBe(201);
    });

    it('should update release', async () => {
      const updated = { id: 1, tag_name: 'v1.0.0', name: 'Updated Release', draft: false };
      nock(baseUrl).patch('/repos/testuser/test-repo/releases/1').reply(200, updated);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/releases/1`, { method: 'PATCH', body: JSON.stringify({ name: 'Updated Release' }) });
      const data = await res.json();
      expect(data.name).toBe('Updated Release');
    });

    it('should delete release', async () => {
      nock(baseUrl).delete('/repos/testuser/test-repo/releases/1').reply(204, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/releases/1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should list release assets', async () => {
      const assets = [{ id: 1, name: 'release.zip', size: 1000, content_type: 'application/zip' }];
      nock(baseUrl).get('/repos/testuser/test-repo/releases/1/assets').reply(200, assets);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/releases/1/assets`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Workflow API', () => {
    it('should list workflows', async () => {
      const workflows = [{ id: 1, name: 'CI', state: 'active' }];
      nock(baseUrl).get('/repos/testuser/test-repo/actions/workflows').reply(200, { workflows });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/workflows`);
      const data = await res.json();
      expect(data.workflows).toHaveLength(1);
    });

    it('should list workflow runs', async () => {
      const runs: GitHubWorkflowRun[] = [{ id: 1, name: 'CI', status: 'queued', conclusion: null, head_branch: 'main', run_number: 1, event: 'push' }];
      nock(baseUrl).get('/repos/testuser/test-repo/actions/runs').reply(200, { workflow_runs: runs });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runs`);
      const data = await res.json();
      expect(data.workflow_runs).toHaveLength(1);
    });

    it('should get workflow run', async () => {
      const run: GitHubWorkflowRun = { id: 1, name: 'CI', status: 'completed', conclusion: 'success', head_branch: 'main', run_number: 1, event: 'push' };
      nock(baseUrl).get('/repos/testuser/test-repo/actions/runs/1').reply(200, run);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runs/1`);
      const data = await res.json();
      expect(data.conclusion).toBe('success');
    });

    it('should cancel workflow run', async () => {
      nock(baseUrl).post('/repos/testuser/test-repo/actions/runs/1/cancel').reply(204, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runs/1/cancel`, { method: 'POST' });
      expect(res.status).toBe(204);
    });

    it('should rerun workflow', async () => {
      nock(baseUrl).post('/repos/testuser/test-repo/actions/runs/1/rerun').reply(201, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runs/1/rerun`, { method: 'POST' });
      expect(res.status).toBe(201);
    });

    it('should list workflow jobs', async () => {
      const jobs = [{ id: 1, name: 'build', status: 'completed', conclusion: 'success', steps: [] }];
      nock(baseUrl).get('/repos/testuser/test-repo/actions/runs/1/jobs').reply(200, { jobs });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runs/1/jobs`);
      const data = await res.json();
      expect(data.jobs).toHaveLength(1);
    });

    it('should download workflow run logs', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/actions/runs/1/logs').reply(302, '', { Location: 'https://example.com/logs.zip' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runs/1/logs`);
      expect(res.status).toBe(302);
    });
  });

  describe('Actions API', () => {
    it('should list repository secrets', async () => {
      const secrets: GitHubSecret[] = [{ name: 'SECRET_KEY', created_at: '2024-01-01', updated_at: '2024-01-01' }];
      nock(baseUrl).get('/repos/testuser/test-repo/actions/secrets').reply(200, { secrets });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/secrets`);
      const data = await res.json();
      expect(data.secrets).toHaveLength(1);
    });

    it('should get repository public key', async () => {
      const key = { key_id: 'key123', key: 'ssh-rsa AAAAB...' };
      nock(baseUrl).get('/repos/testuser/test-repo/actions/secrets/public-key').reply(200, key);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/secrets/public-key`);
      const data = await res.json();
      expect(data.key_id).toBe('key123');
    });

    it('should create/update repository secret', async () => {
      nock(baseUrl).put('/repos/testuser/test-repo/actions/secrets/MY_SECRET').reply(201, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/secrets/MY_SECRET`, { method: 'PUT', body: JSON.stringify({ encrypted_value: 'xyz', key_id: 'key123' }) });
      expect(res.status).toBe(201);
    });

    it('should list self-hosted runners', async () => {
      const runners = [{ id: 1, name: 'runner', status: 'online', os: 'linux' }];
      nock(baseUrl).get('/repos/testuser/test-repo/actions/runners').reply(200, { runners });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runners`);
      const data = await res.json();
      expect(data.runners).toHaveLength(1);
    });

    it('should create registration token', async () => {
      const token = { token: 'registration-token', expires_at: '2024-01-02T00:00:00Z' };
      nock(baseUrl).post('/repos/testuser/test-repo/actions/runners/registration-token').reply(201, token);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runners/registration-token`, { method: 'POST' });
      const data = await res.json();
      expect(data.token).toBeDefined();
    });

    it('should create remove token', async () => {
      const token = { token: 'remove-token', expires_at: '2024-01-02T00:00:00Z' };
      nock(baseUrl).post('/repos/testuser/test-repo/actions/runners/remove-token').reply(201, token);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/actions/runners/remove-token`, { method: 'POST' });
      const data = await res.json();
      expect(data.token).toBeDefined();
    });
  });

  describe('Webhook API', () => {
    it('should list webhooks', async () => {
      const webhooks: GitHubWebhook[] = [{ id: 1, name: 'web', events: ['push'], config: { url: 'https://example.com/webhook', content_type: 'json' }, active: true }];
      nock(baseUrl).get('/repos/testuser/test-repo/hooks').reply(200, webhooks);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/hooks`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create webhook', async () => {
      const webhook = { id: 1, name: 'web', active: true, events: ['push'] };
      nock(baseUrl).post('/repos/testuser/test-repo/hooks').reply(201, webhook);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/hooks`, { method: 'POST', body: JSON.stringify({ name: 'web', config: { url: 'https://example.com/webhook' } }) });
      expect(res.status).toBe(201);
    });

    it('should update webhook', async () => {
      const updated = { id: 1, name: 'web', events: ['push', 'pull_request'] };
      nock(baseUrl).patch('/repos/testuser/test-repo/hooks/1').reply(200, updated);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/hooks/1`, { method: 'PATCH', body: JSON.stringify({ events: ['push', 'pull_request'] }) });
      const data = await res.json();
      expect(data.events).toHaveLength(2);
    });

    it('should delete webhook', async () => {
      nock(baseUrl).delete('/repos/testuser/test-repo/hooks/1').reply(204, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/hooks/1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should ping webhook', async () => {
      const result = { action: 'ping', hook_id: 1, hook: { id: 1 } };
      nock(baseUrl).post('/repos/testuser/test-repo/hooks/1/pings').reply(201, result);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/hooks/1/pings`, { method: 'POST' });
      const data = await res.json();
      expect(data.action).toBe('ping');
    });

    it('should test webhook', async () => {
      nock(baseUrl).post('/repos/testuser/test-repo/hooks/1/tests').reply(204, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/hooks/1/tests`, { method: 'POST' });
      expect(res.status).toBe(204);
    });
  });

  describe('Reaction API', () => {
    it('should list issue reactions', async () => {
      const reactions = [{ id: 1, content: '+1', user: mockUser }];
      nock(baseUrl).get('/repos/testuser/test-repo/issues/1/reactions').reply(200, reactions);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1/reactions`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create issue reaction', async () => {
      const reaction = { id: 1, content: '+1' };
      nock(baseUrl).post('/repos/testuser/test-repo/issues/1/reactions').reply(201, reaction);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/1/reactions`, { method: 'POST', body: JSON.stringify({ content: '+1' }) });
      expect(res.status).toBe(201);
    });

    it('should delete reaction', async () => {
      nock(baseUrl).delete('/repos/testuser/test-repo/releases/1/reactions/1').reply(204, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/releases/1/reactions/1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });
  });

  describe('Project API', () => {
    it('should list projects', async () => {
      const projects = [{ id: 1, name: 'Project 1', body: 'Description' }];
      nock(baseUrl).get('/repos/testuser/test-repo/projects').reply(200, projects);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/projects`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create project', async () => {
      const project = { id: 1, name: 'New Project' };
      nock(baseUrl).post('/repos/testuser/test-repo/projects').reply(201, project);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/projects`, { method: 'POST', body: JSON.stringify({ name: 'New Project' }) });
      expect(res.status).toBe(201);
    });
  });

  describe('Pages API', () => {
    it('should get pages', async () => {
      const pages = { status: 'built', url: 'https://testuser.github.io/test-repo' };
      nock(baseUrl).get('/repos/testuser/test-repo/pages').reply(200, pages);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pages`);
      const data = await res.json();
      expect(data.status).toBe('built');
    });

    it('should get pages build', async () => {
      const build = { status: 'built', commit: 'abc123' };
      nock(baseUrl).get('/repos/testuser/test-repo/pages/builds/latest').reply(200, build);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pages/builds/latest`);
      const data = await res.json();
      expect(data.status).toBe('built');
    });

    it('should request build', async () => {
      nock(baseUrl).post('/repos/testuser/test-repo/pages/builds').reply(201, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/pages/builds`, { method: 'POST' });
      expect(res.status).toBe(201);
    });
  });

  describe('Traffic API', () => {
    it('should get views', async () => {
      const views = [{ timestamp: '2024-01-01', count: 100, uniques: 50 }];
      nock(baseUrl).get('/repos/testuser/test-repo/traffic/views').reply(200, { views });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/traffic/views`);
      const data = await res.json();
      expect(data.views).toHaveLength(1);
    });

    it('should get clones', async () => {
      const clones = [{ timestamp: '2024-01-01', count: 50, uniques: 25 }];
      nock(baseUrl).get('/repos/testuser/test-repo/traffic/clones').reply(200, { clones });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/traffic/clones`);
      const data = await res.json();
      expect(data.clones).toHaveLength(1);
    });
  });

  describe('Dependency Graph API', () => {
    it('should get dependency graph', async () => {
      const graph = { dependency_files: [] };
      nock(baseUrl).get('/repos/testuser/test-repo/dependency-graph/dependents').reply(200, graph);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/dependency-graph/dependents`);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('should get vulnerable dependants', async () => {
      const vulnerable = { security_advisories: [], vulnerable_dependencies: [] };
      nock(baseUrl).get('/repos/testuser/test-repo/dependents/alerts').reply(200, vulnerable);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/dependents/alerts`);
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit (403)', async () => {
      nock(baseUrl).get('/user').reply(403, { message: 'API rate limit exceeded' }, { 'X-RateLimit-Remaining': '0' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.status).toBe(403);
    });

    it('should check rate limit status', async () => {
      nock('https://api.github.com').get('/rate_limit').reply(200, { resources: { core: { limit: 5000, remaining: 4999, reset: 1234567890 } } });
      const res = await fetch('https://api.github.com/rate_limit');
      const data = await res.json();
      expect(data.resources.core.remaining).toBe(4999);
    });
  });

  describe('Search API', () => {
    it('should search issues', async () => {
      const search = { total_count: 1, items: [mockIssue] };
      nock('https://api.github.com').get('/search/issues').query({ q: 'is:issue repo:testuser/test-repo' }).reply(200, search);
      const res = await fetch('https://api.github.com/search/issues?q=is:issue+repo:testuser/test-repo');
      const data = await res.json();
      expect(data.total_count).toBe(1);
    });

    it('should search repositories', async () => {
      const search = { total_count: 1, items: [mockRepo] };
      nock('https://api.github.com').get('/search/repositories').query({ q: 'test-repo' }).reply(200, search);
      const res = await fetch('https://api.github.com/search/repositories?q=test-repo');
      const data = await res.json();
      expect(data.total_count).toBe(1);
    });

    it('should search code', async () => {
      const search = { total_count: 1, items: [{ name: 'index.ts', path: 'src/index.ts' }] };
      nock('https://api.github.com').get('/search/code').query({ q: 'testuser/test-repo' }).reply(200, search);
      const res = await fetch('https://api.github.com/search/code?q=testuser/test-repo');
      const data = await res.json();
      expect(data.total_count).toBe(1);
    });

    it('should search users', async () => {
      const search = { total_count: 1, items: [mockUser] };
      nock('https://api.github.com').get('/search/users').query({ q: 'testuser' }).reply(200, search);
      const res = await fetch('https://api.github.com/search/users?q=testuser');
      const data = await res.json();
      expect(data.total_count).toBe(1);
    });
  });

  describe('Gist API', () => {
    it('should list gists', async () => {
      const gists = [{ id: 'gist1', description: 'Test Gist', public: false }];
      nock(baseUrl).get('/gists').reply(200, gists);
      const res = await fetch(`${baseUrl}/gists`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get gist', async () => {
      const gist: any = { id: 'gist1', description: 'Test Gist', files: { 'test.txt': { content: 'Hello' } } };
      nock(baseUrl).get('/gists/gist1').reply(200, gist);
      const res = await fetch(`${baseUrl}/gists/gist1`);
      const data = await res.json();
      expect(data.id).toBe('gist1');
    });

    it('should create gist', async () => {
      const gist = { id: 'gist1', description: 'New Gist', public: false };
      nock(baseUrl).post('/gists').reply(201, gist);
      const res = await fetch(`${baseUrl}/gists`, { method: 'POST', body: JSON.stringify({ description: 'New Gist', public: false, files: { 'test.txt': { content: 'Hello' } } }) });
      expect(res.status).toBe(201);
    });

    it('should update gist', async () => {
      const gist = { id: 'gist1', description: 'Updated Gist' };
      nock(baseUrl).patch('/gists/gist1').reply(200, gist);
      const res = await fetch(`${baseUrl}/gists/gist1`, { method: 'PATCH', body: JSON.stringify({ description: 'Updated Gist' }) });
      const data = await res.json();
      expect(data.description).toBe('Updated Gist');
    });

    it('should delete gist', async () => {
      nock(baseUrl).delete('/gists/gist1').reply(204, '');
      const res = await fetch(`${baseUrl}/gists/gist1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should star gist', async () => {
      nock(baseUrl).put('/gists/gist1/star').reply(204, '');
      const res = await fetch(`${baseUrl}/gists/gist1/star`, { method: 'PUT' });
      expect(res.status).toBe(204);
    });

    it('should unstar gist', async () => {
      nock(baseUrl).delete('/gists/gist1/star').reply(204, '');
      const res = await fetch(`${baseUrl}/gists/gist1/star`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should fork gist', async () => {
      const gist = { id: 'gist2' };
      nock(baseUrl).post('/gists/gist1/forks').reply(201, gist);
      const res = await fetch(`${baseUrl}/gists/gist1/forks`, { method: 'POST' });
      expect(res.status).toBe(201);
    });
  });

  describe('Activity API', () => {
    it('should get events', async () => {
      const events = [{ type: 'PushEvent', created_at: '2024-01-01T00:00:00Z' }];
      nock(baseUrl).get('/users/testuser/events').reply(200, events);
      const res = await fetch(`${baseUrl}/users/testuser/events`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get public events', async () => {
      const events = [{ type: 'PushEvent', created_at: '2024-01-01T00:00:00Z' }];
      nock(baseUrl).get('/users/testuser/events/public').reply(200, events);
      const res = await fetch(`${baseUrl}/users/testuser/events/public`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get repository events', async () => {
      const events = [{ type: 'PushEvent', created_at: '2024-01-01T00:00:00Z' }];
      nock(baseUrl).get('/repos/testuser/test-repo/events').reply(200, events);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/events`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get issue events', async () => {
      const events = [{ id: 1, action: 'opened', issue: mockIssue, created_at: '2024-01-01T00:00:00Z' }];
      nock(baseUrl).get('/repos/testuser/test-repo/issues/events/1').reply(200, events[0]);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues/events/1`);
      const data = await res.json();
      expect(data.action).toBe('opened');
    });

    it('should get timeline', async () => {
      const timeline = [{ type: 'PushEvent', created_at: '2024-01-01T00:00:00Z' }];
      nock(baseUrl).get('/repos/testuser/test-repo/timeline').reply(200, timeline);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/timeline`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Git Data API', () => {
    it('should get tree', async () => {
      const tree = { sha: 'abc123', tree: [{ path: 'src/index.ts', type: 'blob', mode: '100644' }] };
      nock(baseUrl).get('/repos/testuser/test-repo/git/trees/abc123').reply(200, tree);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/trees/abc123`);
      const data = await res.json();
      expect(data.tree).toHaveLength(1);
    });

    it('should get tree recursively', async () => {
      const tree = { sha: 'abc123', tree: [{ path: 'src/index.ts', type: 'blob', mode: '100644' }] };
      nock(baseUrl).get('/repos/testuser/test-repo/git/trees/abc123').query({ recursive: '1' }).reply(200, tree);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/trees/abc123?recursive=1`);
      const data = await res.json();
      expect(data.tree).toHaveLength(1);
    });

    it('should create tree', async () => {
      const tree = { sha: 'newtree123', tree: [] };
      nock(baseUrl).post('/repos/testuser/test-repo/git/trees').reply(201, tree);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/trees`, { method: 'POST', body: JSON.stringify({ tree: [] }) });
      expect(res.status).toBe(201);
    });

    it('should get blob', async () => {
      const blob = { sha: 'blobsha', content: 'aGVsbG8=', encoding: 'base64' };
      nock(baseUrl).get('/repos/testuser/test-repo/git/blobs/blobsha').reply(200, blob);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/blobs/blobsha`);
      const data = await res.json();
      expect(data.sha).toBe('blobsha');
    });

    it('should create blob', async () => {
      const blob = { sha: 'newblobsha' };
      nock(baseUrl).post('/repos/testuser/test-repo/git/blobs').reply(201, blob);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/blobs`, { method: 'POST', body: JSON.stringify({ content: 'aGVsbG8=', encoding: 'base64' }) });
      expect(res.status).toBe(201);
    });

    it('should get commit object', async () => {
      const commit = { sha: 'commitsha', message: 'Test commit' };
      nock(baseUrl).get('/repos/testuser/test-repo/git/commits/commitsha').reply(200, commit);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/commits/commitsha`);
      const data = await res.json();
      expect(data.sha).toBe('commitsha');
    });

    it('should create commit', async () => {
      const commit = { sha: 'newcommitsha', message: 'New commit' };
      nock(baseUrl).post('/repos/testuser/test-repo/git/commits').reply(201, commit);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/commits`, { method: 'POST', body: JSON.stringify({ message: 'New commit', tree: 'treesha', parents: ['parentsha'] }) });
      expect(res.status).toBe(201);
    });

    it('should get reference', async () => {
      const ref = { ref: 'refs/heads/main', object: { sha: 'abc123', type: 'commit' } };
      nock(baseUrl).get('/repos/testuser/test-repo/git/refs/heads/main').reply(200, ref);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/refs/heads/main`);
      const data = await res.json();
      expect(data.ref).toBe('refs/heads/main');
    });

    it('should create reference', async () => {
      const ref = { ref: 'refs/heads/new-branch', object: { sha: 'abc123' } };
      nock(baseUrl).post('/repos/testuser/test-repo/git/refs').reply(201, ref);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/refs`, { method: 'POST', body: JSON.stringify(ref) });
      expect(res.status).toBe(201);
    });

    it('should update reference', async () => {
      const ref = { ref: 'refs/heads/main', object: { sha: 'newabc123' } };
      nock(baseUrl).patch('/repos/testuser/test-repo/git/refs/heads/main').reply(200, ref);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/refs/heads/main`, { method: 'PATCH', body: JSON.stringify({ sha: 'newabc123' }) });
      const data = await res.json();
      expect(data.object.sha).toBe('newabc123');
    });

    it('should delete reference', async () => {
      nock(baseUrl).delete('/repos/testuser/test-repo/git/refs/heads/feature').reply(204, '');
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/git/refs/heads/feature`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });
  });

  describe('Markdown API', () => {
    it('should render markdown', async () => {
      nock('https://api.github.com').post('/markdown').reply(200, '<h1>Hello</h1>');
      const res = await fetch('https://api.github.com/markdown', { method: 'POST', body: JSON.stringify({ text: '# Hello' }) });
      const html = await res.text();
      expect(html).toContain('<h1>Hello</h1>');
    });

    it('should render raw markdown', async () => {
      nock('https://api.github.com').post('/markdown/raw').reply(200, '<p>Hello</p>');
      const res = await fetch('https://api.github.com/markdown/raw', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '# Hello' });
      const html = await res.text();
      expect(html).toContain('<p>Hello</p>');
    });
  });

  describe('Emojis API', () => {
    it('should list emojis', async () => {
      const emojis: Record<string, string> = { '+1': 'https://github.githubassets.com/images/icons/emoji/unicode/1f44d.png?v8' };
      nock('https://api.github.com').get('/emojis').reply(200, emojis);
      const res = await fetch('https://api.github.com/emojis');
      const data = await res.json();
      expect(data['+1']).toBeDefined();
    });
  });

  describe('Licenses API', () => {
    it('should get repository license', async () => {
      const license = { key: 'mit', name: 'MIT License' };
      nock(baseUrl).get('/repos/testuser/test-repo/license').reply(200, license);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/license`);
      const data = await res.json();
      expect(data.key).toBe('mit');
    });

    it('should list common licenses', async () => {
      const licenses = [{ key: 'mit', name: 'MIT License' }];
      nock('https://api.github.com').get('/licenses').reply(200, licenses);
      const res = await fetch('https://api.github.com/licenses');
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get license', async () => {
      const license = { key: 'mit', name: 'MIT License', body: 'MIT License...' };
      nock('https://api.github.com').get('/licenses/mit').reply(200, license);
      const res = await fetch('https://api.github.com/licenses/mit');
      const data = await res.json();
      expect(data.key).toBe('mit');
    });
  });

  describe('Team API', () => {
    it('should list team discussions', async () => {
      const discussions = [{ id: 1, title: 'Discussion', body: 'Body' }];
      nock(baseUrl).get('/teams/team1/discussions').reply(200, discussions);
      const res = await fetch(`${baseUrl}/teams/team1/discussions`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create team discussion', async () => {
      const discussion = { id: 1, title: 'New Discussion' };
      nock(baseUrl).post('/teams/team1/discussions').reply(201, discussion);
      const res = await fetch(`${baseUrl}/teams/team1/discussions`, { method: 'POST', body: JSON.stringify({ title: 'New Discussion' }) });
      expect(res.status).toBe(201);
    });
  });

  describe('Organization API', () => {
    it('should get organization', async () => {
      const org = { login: 'testorg', description: 'Test Organization' };
      nock('https://api.github.com').get('/orgs/testorg').reply(200, org);
      const res = await fetch('https://api.github.com/orgs/testorg');
      const data = await res.json();
      expect(data.login).toBe('testorg');
    });

    it('should list organization members', async () => {
      nock('https://api.github.com').get('/orgs/testorg/members').reply(200, [mockUser]);
      const res = await fetch('https://api.github.com/orgs/testorg/members');
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should list organization teams', async () => {
      const teams = [{ id: 1, name: 'Team', slug: 'team' }];
      nock('https://api.github.com').get('/orgs/testorg/teams').reply(200, teams);
      const res = await fetch('https://api.github.com/orgs/testorg/teams');
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should list organization repositories', async () => {
      nock('https://api.github.com').get('/orgs/testorg/repos').reply(200, [mockRepo]);
      const res = await fetch('https://api.github.com/orgs/testorg/repos');
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get organization hooks', async () => {
      const hooks = [{ id: 1, active: true }];
      nock('https://api.github.com').get('/orgs/testorg/hooks').reply(200, hooks);
      const res = await fetch('https://api.github.com/orgs/testorg/hooks');
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      nock(baseUrl).get('/user').replyWithError('Network error');
      await expect(fetch(`${baseUrl}/user`)).rejects.toThrow();
    });

    it('should handle timeout', async () => {
      nock(baseUrl).get('/user').delay(10000).reply(200, mockUser);
      const res = await fetch(`${baseUrl}/user`);
      expect(res.ok).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      nock(baseUrl).get('/user').reply(200, 'not valid json {{{');
      const res = await fetch(`${baseUrl}/user`);
      const data = await res.json().catch(() => null);
      expect(data).toBeNull();
    });

    it('should handle server error (500)', async () => {
      nock(baseUrl).get('/user').reply(500, { error: 'Internal Server Error' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.status).toBe(500);
    });

    it('should handle service unavailable (503)', async () => {
      nock(baseUrl).get('/user').reply(503, { error: 'Service Unavailable' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.status).toBe(503);
    });

    it('should handle gone (410)', async () => {
      nock(baseUrl).get('/user').reply(410, { message: 'Resource gone' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.status).toBe(410);
    });

    it('should handle unprocessable entity (422)', async () => {
      nock(baseUrl).post('/user/repos').reply(422, { message: 'Validation Failed' });
      const res = await fetch(`${baseUrl}/user/repos`, { method: 'POST', body: JSON.stringify({}) });
      expect(res.status).toBe(422);
    });
  });

  describe('Conditional Requests', () => {
    it('should handle ETag', async () => {
      nock(baseUrl).get('/user').reply(200, mockUser, { 'ETag': '"abc123"' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.headers.get('ETag')).toBe('"abc123"');
    });

    it('should handle Last-Modified', async () => {
      nock(baseUrl).get('/user').reply(200, mockUser, { 'Last-Modified': 'Wed, 01 Jan 2024 00:00:00 GMT' });
      const res = await fetch(`${baseUrl}/user`);
      expect(res.headers.get('Last-Modified')).toBeDefined();
    });

    it('should handle If-None-Match', async () => {
      const scope = nock(baseUrl).get('/user').reply(304, '', { 'ETag': '"abc123"' });
      const res = await fetch(`${baseUrl}/user`, { headers: { 'If-None-Match': '"abc123"' });
      expect(res.status).toBe(304);
    });
  });

  describe('Pagination', () => {
    it('should parse pagination links', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/issues').reply(200, [mockIssue], {
        Link: '<https://api.github.com/repos/testuser/test-repo/issues?page=2>; rel="next", <https://api.github.com/repos/testuser/test-repo/issues?page=3>; rel="last"',
      });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues`);
      const link = res.headers.get('Link');
      expect(link).toContain('rel="next"');
    });

    it('should handle page parameter', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/issues').query({ page: '2', per_page: '10' }).reply(200, []);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues?page=2&per_page=10`);
      expect(res.ok).toBe(true);
    });

    it('should handle per_page parameter', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/issues').query({ per_page: '1' }).reply(200, [mockIssue]);
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/issues?per_page=1`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Media Types', () => {
    it('should accept raw format', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo/contents/src').reply(200, '', { 'Content-Type': 'application/vnd.github.v3.raw' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo/contents/src`);
      expect(res.headers.get('Content-Type')).toContain('raw');
    });

    it('should accept minimal representation', async () => {
      nock(baseUrl).get('/repos/testuser/test-repo').reply(200, { name: 'test-repo' }, { 'Content-Type': 'application/vnd.github.v3.minimal+json' });
      const res = await fetch(`${baseUrl}/repos/testuser/test-repo`);
      expect(res.headers.get('Content-Type')).toContain('minimal');
    });
  });
});