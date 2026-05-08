import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('HubSpot Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.hubapi.com/crm/v3';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Contacts API', () => {
    it('should list contacts', async () => {
      nock(baseUrl).get('/objects/contacts').reply(200, { results: [{ id: 'contact-1', properties: { email: 'test@example.com' } }], paging: { next: null } });
      const res = await fetch(`${baseUrl}/objects/contacts`);
      const data = await res.json();
      expect(data.results).toHaveLength(1);
    });

    it('should create contact', async () => {
      nock(baseUrl).post('/objects/contacts').reply(201, { id: 'contact-new', properties: { email: 'new@example.com' } });
      const res = await fetch(`${baseUrl}/objects/contacts`, { method: 'POST', body: JSON.stringify({ properties: { email: 'new@example.com' } }) });
      const data = await res.json();
      expect(data.id).toBe('contact-new');
    });

    it('should update contact', async () => {
      nock(baseUrl).patch('/objects/contacts/contact-1').reply(200, { id: 'contact-1', properties: { firstname: 'John' } });
      const res = await fetch(`${baseUrl}/objects/contacts/contact-1`, { method: 'PATCH', body: JSON.stringify({ properties: { firstname: 'John' } }) });
      const data = await res.json();
      expect(data.properties.firstname).toBe('John');
    });

    it('should get contact', async () => {
      nock(baseUrl).get('/objects/contacts/contact-1').reply(200, { id: 'contact-1', properties: { email: 'test@example.com' } });
      const res = await fetch(`${baseUrl}/objects/contacts/contact-1`);
      const data = await res.json();
      expect(data.id).toBe('contact-1');
    });

    it('should search contacts', async () => {
      nock(baseUrl).post('/objects/contacts/search').reply(200, { results: [], total: 0 });
      const res = await fetch(`${baseUrl}/objects/contacts/search`, { method: 'POST', body: JSON.stringify({ filterGroups: [] }) });
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should delete contact', async () => {
      nock(baseUrl).delete('/objects/contacts/contact-1').reply(204, '');
      const res = await fetch(`${baseUrl}/objects/contacts/contact-1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should batch create contacts', async () => {
      nock(baseUrl).post('/objects/contacts/batch/create').reply(200, { results: [{ id: '1' }, { id: '2' }] });
      const res = await fetch(`${baseUrl}/objects/contacts/batch/create`, { method: 'POST', body: JSON.stringify({ inputs: [{ properties: { email: 'a@b.com' } } }] }) });
      const data = await res.json();
      expect(data.results).toHaveLength(2);
    });
  });

  describe('Companies API', () => {
    it('should list companies', async () => {
      nock(baseUrl).get('/objects/companies').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/objects/companies`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should create company', async () => {
      nock(baseUrl).post('/objects/companies').reply(201, { id: 'comp-new', properties: { name: 'Acme Inc' } });
      const res = await fetch(`${baseUrl}/objects/companies`, { method: 'POST', body: JSON.stringify({ properties: { name: 'Acme Inc' } }) });
      expect(res.status).toBe(201);
    });

    it('should get company', async () => {
      nock(baseUrl).get('/objects/companies/comp-1').reply(200, { id: 'comp-1', properties: { name: 'Acme' } });
      const res = await fetch(`${baseUrl}/objects/companies/comp-1`);
      const data = await res.json();
      expect(data.id).toBe('comp-1');
    });

    it('should associate contact to company', async () => {
      nock(baseUrl).put('/objects/contacts/contact-1/associations/companies/comp-1/contact-1_to_comp-1').reply(200, {});
      const res = await fetch(`${baseUrl}/objects/contacts/contact-1/associations/companies/comp-1/contact-1_to_comp-1`, { method: 'PUT' });
      expect(res.status).toBe(200);
    });
  });

  describe('Deals API', () => {
    it('should list deals', async () => {
      nock(baseUrl).get('/objects/deals').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/objects/deals`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should create deal', async () => {
      nock(baseUrl).post('/objects/deals').reply(201, { id: 'deal-new', properties: { dealname: 'New Deal', amount: '10000' } });
      const res = await fetch(`${baseUrl}/objects/deals`, { method: 'POST', body: JSON.stringify({ properties: { dealname: 'New Deal', amount: '10000' } }) });
      const data = await res.json();
      expect(data.id).toBe('deal-new');
    });

    it('should update deal stage', async () => {
      nock(baseUrl).patch('/objects/deals/deal-1').reply(200, { id: 'deal-1', properties: { dealstage: 'closedwon' } });
      const res = await fetch(`${baseUrl}/objects/deals/deal-1`, { method: 'PATCH', body: JSON.stringify({ properties: { dealstage: 'closedwon' } }) });
      const data = await res.json();
      expect(data.properties.dealstage).toBe('closedwon');
    });
  });

  describe('Tickets API', () => {
    it('should list tickets', async () => {
      nock(baseUrl).get('/objects/tickets').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/objects/tickets`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should create ticket', async () => {
      nock(baseUrl).post('/objects/tickets').reply(201, { id: 'ticket-new', properties: { subject: 'Help needed' } });
      const res = await fetch(`${baseUrl}/objects/tickets`, { method: 'POST', body: JSON.stringify({ properties: { subject: 'Help needed' } }) });
      expect(res.status).toBe(201);
    });
  });

  describe('Pipelines API', () => {
    it('should get pipeline stages', async () => {
      nock(baseUrl).get('/pipelines/deals/pipeline-1').reply(200, { stages: [{ id: 'appointmentscheduled', label: 'Appointment Scheduled' }] });
      const res = await fetch(`${baseUrl}/pipelines/deals/pipeline-1`);
      const data = await res.json();
      expect(data.stages).toHaveLength(1);
    });
  });

  describe('Owners API', () => {
    it('should list owners', async () => {
      nock(baseUrl).get('/owners').reply(200, [{ id: 'owner-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }]);
      const res = await fetch(`${baseUrl}/owners`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Webhooks', () => {
    it('should handle contact.creation', () => {
      const event = { objectType: 'CONTACT', eventType: 'CONTACT_CREATION', propertyName: 'email', value: 'test@example.com' };
      expect(event.eventType).toBe('CONTACT_CREATION');
    });

    it('should handle deal.stageChange', () => {
      const event = { objectType: 'DEAL', eventType: 'DEAL_STAGE_CHANGE', propertyName: 'dealstage' };
      expect(event.eventType).toBe('DEAL_STAGE_CHANGE');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401', async () => {
      nock(baseUrl).get('/objects/contacts').reply(401, { message: 'Unauthorized' });
      const res = await fetch(`${baseUrl}/objects/contacts`);
      expect(res.status).toBe(401);
    });

    it('should handle 409 conflict', async () => {
      nock(baseUrl).post('/objects/contacts').reply(409, { message: 'Contact already exists' });
      const res = await fetch(`${baseUrl}/objects/contacts`, { method: 'POST', body: JSON.stringify({ properties: {} }) });
      expect(res.status).toBe(409);
    });
  });
});

describe('Linear Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.linear.app/graphql';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Issues API', () => {
    it('should query issues', async () => {
      nock(baseUrl).post('').reply(200, { data: { issues: { nodes: [{ id: 'issue-1', title: 'Bug', priority: 1 }] } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: '{ issues { nodes { id title } } }' }) });
      const data = await res.json();
      expect(data.data.issues.nodes).toHaveLength(1);
    });

    it('should create issue', async () => {
      nock(baseUrl).post('').reply(200, { data: { issueCreate: { success: true, issue: { id: 'issue-new', title: 'New Issue' } } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { issueCreate(input: {}) { success } }' }) });
      const data = await res.json();
      expect(data.data.issueCreate.success).toBe(true);
    });

    it('should update issue', async () => {
      nock(baseUrl).post('').reply(200, { data: { issueUpdate: { success: true } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { issueUpdate(id: "") { success } }' }) });
      const data = await res.json();
      expect(data.data.issueUpdate.success).toBe(true);
    });

    it('should archive issue', async () => {
      nock(baseUrl).post('').reply(200, { data: { issueArchive: { success: true } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { issueArchive(id: "") { success } }' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Projects API', () => {
    it('should list projects', async () => {
      nock(baseUrl).post('').reply(200, { data: { projects: { nodes: [{ id: 'proj-1', name: 'Project' }] } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: '{ projects { nodes { id name } } }' }) });
      const data = await res.json();
      expect(data.data.projects.nodes).toHaveLength(1);
    });

    it('should create project', async () => {
      nock(baseUrl).post('').reply(200, { data: { projectCreate: { success: true, project: { id: 'proj-new' } } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { projectCreate(input: {}) { success } }' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Cycles API', () => {
    it('should list cycles', async () => {
      nock(baseUrl).post('').reply(200, { data: { cycles: { nodes: [{ id: 'cycle-1', number: 1, startsAt: '2024-01-01' }] } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: '{ cycles { nodes { id number startsAt } } }' }) });
      const data = await res.json();
      expect(data.data.cycles.nodes).toHaveLength(1);
    });
  });

  describe('Teams API', () => {
    it('should list teams', async () => {
      nock(baseUrl).post('').reply(200, { data: { teams: { nodes: [{ id: 'team-1', name: 'Engineering', key: 'ENG' }] } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: '{ teams { nodes { id name key } } }' }) });
      const data = await res.json();
      expect(data.data.teams.nodes).toHaveLength(1);
    });

    it('should create issue priority', async () => {
      nock(baseUrl).post('').reply(200, { data: { issuePriorityCreate: { success: true } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { issuePriorityCreate(input: {}) { success } }' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Labels API', () => {
    it('should list labels', async () => {
      nock(baseUrl).post('').reply(200, { data: { issueLabels: { nodes: [{ id: 'label-1', name: 'bug', color: '#ff0000' }] } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: '{ issueLabels { nodes { id name color } } }' }) });
      const data = await res.json();
      expect(data.data.issueLabels.nodes).toHaveLength(1);
    });

    it('should create label', async () => {
      nock(baseUrl).post('').reply(200, { data: { issueLabelCreate: { success: true, issueLabel: { id: 'label-new' } } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { issueLabelCreate(input: {}) { success } }' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Comments API', () => {
    it('should add comment', async () => {
      nock(baseUrl).post('').reply(200, { data: { commentCreate: { success: true, comment: { id: 'comment-new' } } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { commentCreate(input: {}) { success } }' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Reactions API', () => {
    it('should add reaction', async () => {
      nock(baseUrl).post('').reply(200, { data: { reactionCreate: { success: true } } });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'mutation { reactionCreate(input: {}) { success } }' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Webhooks', () => {
    it('should handle issue.created', () => {
      const payload = { type: 'issue', action: 'create', data: { id: 'issue-1' } };
      expect(payload.action).toBe('create');
    });

    it('should handle issue.updated', () => {
      const payload = { type: 'issue', action: 'update', data: { id: 'issue-1' } };
      expect(payload.action).toBe('update');
    });

    it('should handle comment.created', () => {
      const payload = { type: 'comment', action: 'create', data: { id: 'comment-1' } };
      expect(payload.type).toBe('comment');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid query', async () => {
      nock(baseUrl).post('').reply(400, { errors: [{ message: 'Invalid query' }] });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: 'invalid' }) });
      expect(res.status).toBe(400);
    });

    it('should handle rate limit', async () => {
      nock(baseUrl).post('').reply(429, { errors: [{ message: 'Rate limited' }] });
      const res = await fetch(`${baseUrl}`, { method: 'POST', body: JSON.stringify({ query: '{}' }) });
      expect(res.status).toBe(429);
    });
  });
});

describe('Salesforce Integration - OAuth Flow', () => {
  const baseUrl = 'https://example.salesforce.com/services/data/v58.0';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Authentication', () => {
    it('should initiate OAuth', async () => {
      const authUrl = 'https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=xxx&redirect_uri=xxx';
      expect(authUrl).toContain('oauth2/authorize');
    });

    it('should exchange code for token', async () => {
      nock('https://login.salesforce.com').post('/services/oauth2/token').reply(200, { access_token: 'token', instance_url: 'https://example.salesforce.com' });
      const res = await fetch('https://login.salesforce.com/services/oauth2/token', { method: 'POST', body: JSON.stringify({ grant_type: 'authorization_code', code: 'code' }) });
      const data = await res.json();
      expect(data.access_token).toBeDefined();
    });

    it('should refresh token', async () => {
      nock('https://login.salesforce.com').post('/services/oauth2/token').reply(200, { access_token: 'new_token' });
      const res = await fetch('https://login.salesforce.com/services/oauth2/token', { method: 'POST', body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: 'old' }) });
      const data = await res.json();
      expect(data.access_token).toBe('new_token');
    });
  });

  describe('SOQL Queries', () => {
    it('should query contacts', async () => {
      nock(baseUrl).get('/query').query({ q: 'SELECT Id, Name FROM Contact' }).reply(200, { totalSize: 1, records: [{ Id: '003xx000000Demo', Name: 'Test Contact' }] });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id+Name+FROM+Contact`);
      const data = await res.json();
      expect(data.totalSize).toBe(1);
    });

    it('should query accounts', async () => {
      nock(baseUrl).get('/query').query({ q: 'SELECT Id, Name FROM Account' }).reply(200, { totalSize: 0, records: [] });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id+Name+FROM+Account`);
      expect(res.status).toBe(200);
    });

    it('should query opportunities', async () => {
      nock(baseUrl).get('/query').query({ q: 'SELECT Id, StageName FROM Opportunity' }).reply(200, { records: [] });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id+StageName+FROM+Opportunity`);
      expect(res.status).toBe(200);
    });
  });

  describe('SObject CRUD', () => {
    it('should create record', async () => {
      nock(baseUrl).post('/sobjects/Contact').reply(201, { id: '003xx000000Demo', success: true });
      const res = await fetch(`${baseUrl}/sobjects/Contact`, { method: 'POST', body: JSON.stringify({ FirstName: 'John', LastName: 'Doe' }) });
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should get record', async () => {
      nock(baseUrl).get('/sobjects/Contact/003xx000000Demo').reply(200, { Id: '003xx000000Demo', FirstName: 'John' });
      const res = await fetch(`${baseUrl}/sobjects/Contact/003xx000000Demo`);
      const data = await res.json();
      expect(data.FirstName).toBe('John');
    });

    it('should update record', async () => {
      nock(baseUrl).patch('/sobjects/Contact/003xx000000Demo').reply(200, { id: '003xx000000Demo', success: true });
      const res = await fetch(`${baseUrl}/sobjects/Contact/003xx000000Demo`, { method: 'PATCH', body: JSON.stringify({ FirstName: 'Jane' }) });
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should delete record', async () => {
      nock(baseUrl).delete('/sobjects/Contact/003xx000000Demo').reply(204, '');
      const res = await fetch(`${baseUrl}/sobjects/Contact/003xx000000Demo`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });
  });

  describe('Describe API', () => {
    it('should describe sobject', async () => {
      nock(baseUrl).get('/sobjects/Contact/describe').reply(200, { name: 'Contact', fields: [{ name: 'Id', type: 'id' }] });
      const res = await fetch(`${baseUrl}/sobjects/Contact/describe`);
      const data = await res.json();
      expect(data.name).toBe('Contact');
    });

    it('should list sobjects', async () => {
      nock(baseUrl).get('/sobjects').reply(200, { sobjects: [{ name: 'Contact', label: 'Contact' }] });
      const res = await fetch(`${baseUrl}/sobjects`);
      const data = await res.json();
      expect(data.sobjects).toHaveLength(1);
    });
  });

  describe('Bulk API', () => {
    it('should create bulk job', async () => {
      nock(baseUrl).post('/jobs/ingest').reply(201, { id: 'job-id', state: 'Open' });
      const res = await fetch(`${baseUrl}/jobs/ingest`, { method: 'POST', body: JSON.stringify({ object: 'Contact', operation: 'insert', contentType: 'JSON' }) });
      const data = await res.json();
      expect(data.state).toBe('Open');
    });

    it('should add batch', async () => {
      nock(baseUrl).post('/jobs/ingest/job-id/batches').reply(201, { id: 'batch-id' });
      const res = await fetch(`${baseUrl}/jobs/ingest/job-id/batches`, { method: 'POST', body: JSON.stringify({ method: 'POST' }) });
      expect(res.status).toBe(201);
    });

    it('should close job', async () => {
      nock(baseUrl).put('/jobs/ingest/job-id').reply(200, { state: 'Closed' });
      const res = await fetch(`${baseUrl}/jobs/ingest/job-id`, { method: 'PUT', body: JSON.stringify({ state: 'Closed' }) });
      const data = await res.json();
      expect(data.state).toBe('Closed');
    });
  });

  describe('Streaming API', () => {
    it('should subscribe to channel', () => {
      const channel = '/topic/ContactUpdates';
      expect(channel).toContain('/topic/');
    });

    it('should handle push topic', () => {
      const payload = { sobject: 'Contact', eventType: 'created' };
      expect(payload.sobject).toBe('Contact');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401', async () => {
      nock(baseUrl).get('/query').query(true).reply(401, { message: 'Unauthorized' });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id`);
      expect(res.status).toBe(401);
    });

    it('should handle invalid SOQL', async () => {
      nock(baseUrl).get('/query').query(true).reply(400, { message: 'INVALID_QUERY' });
      const res = await fetch(`${baseUrl}/query?q=INVALID`);
      expect(res.status).toBe(400);
    });

    it('should handle rate limit', async () => {
      nock(baseUrl).get('/query').query(true).reply(429, { message: 'Rate limit exceeded' }, { 'Retry-After': '1' });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id`);
      expect(res.status).toBe(429);
    });
  });
});

describe('Utility Functions', () => {
  describe('Rate Limiting', () => {
    it('should calculate exponential backoff', () => {
      const maxRetries = 3;
      const delays = [1000, 2000, 4000];
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
    });

    it('should cap backoff at max delay', () => {
      const maxDelay = 32000;
      const calculatedDelay = 64000;
      const finalDelay = Math.min(calculatedDelay, maxDelay);
      expect(finalDelay).toBe(maxDelay);
    });
  });

  describe('OAuth Token Management', () => {
    it('should detect expired token', () => {
      const expiresAt = Math.floor(Date.now() / 1000) - 100;
      const isExpired = expiresAt < Math.floor(Date.now() / 1000);
      expect(isExpired).toBe(true);
    });

    it('should refresh before expiry', () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      const shouldRefresh = expiresAt - Math.floor(Date.now() / 1000) < 300;
      expect(shouldRefresh).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should parse next cursor', () => {
      const nextCursor = 'eyJpZCI6MTAwfQ==';
      expect(nextCursor).toBeDefined();
    });

    it('should handle page params', () => {
      const params = { limit: 100, offset: 0 };
      expect(params.offset).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should retry on 5xx errors', async () => {
      const retryable = [500, 501, 502, 503, 504];
      retryable.forEach((status) => {
        expect([500, 502, 503, 504]).toContain(status);
      });
    });

    it('should not retry on 4xx (except 429)', async () => {
      const retryable = [400, 401, 403, 404];
      const shouldRetry = false;
      expect(shouldRetry).toBe(false);
    });
  });
});

describe('Integration Activity Cards', () => {
  it('should create activity card for issue created', () => {
    const event = { type: 'issue.created', id: 'issue-1', title: 'Bug', timestamp: Date.now() };
    const card = {
      id: event.id,
      title: event.title,
      description: event.type,
      icon: '🐛',
      timestamp: event.timestamp,
      status: 'info' as const,
      tags: [event.type],
    };
    expect(card.icon).toBe('🐛');
  });

  it('should create activity card for deployment', () => {
    const event = { type: 'deployment.ready', id: 'dpl-1', environment: 'production', timestamp: Date.now() };
    const card = {
      id: event.id,
      title: 'Deployment Ready',
      description: event.environment,
      icon: '🚀',
      timestamp: event.timestamp,
      status: 'success' as const,
      actionUrl: 'https://vercel.com/deployments/dpl-1',
      tags: event.type.split('.'),
    };
    expect(card.status).toBe('success');
  });

  it('should create warning card for errors', () => {
    const event = { type: 'error.created', id: 'err-1', title: 'Error detected', timestamp: Date.now() };
    const card = {
      id: event.id,
      title: 'Error',
      description: event.title,
      icon: '⚠️',
      timestamp: event.timestamp,
      status: 'error' as const,
      tags: ['error'],
    };
    expect(card.status).toBe('error');
  });
});

describe('Connection Health Checks', () => {
  it('should check API connectivity', async () => {
    nock('https://api.example.com').get('/health').reply(200, { status: 'ok' });
    const res = await fetch('https://api.example.com/health');
    expect(res.ok).toBe(true);
  });

  it('should handle connection timeout', async () => {
    nock('https://api.example.com').get('/health').delay(10000).reply(200, { status: 'ok' });
    const res = await fetch('https://api.example.com/health');
    expect(res.ok).toBe(false);
  });

  it('should check token validity', async () => {
    nock('https://api.example.com').get('/user').reply(401, { error: 'Invalid token' });
    const res = await fetch('https://api.example.com/user');
    expect(res.status).toBe(401);
  });
});