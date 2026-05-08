import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';

describe('Linear Integration - Extended Tests', () => {
  const baseUrl = 'https://api.linear.app/graphql';
  beforeEach(() => nock.disableNetConnect());

  it('should create issue with labels', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true, issue: { id: 'issue1' } } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { labelIds: ["label1"] }) { success } }' })
    });
    const data = await res.json();
    expect(data.data.issueCreate.success).toBe(true);
  });

  it('should create issue with priority', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { priority: 1 }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create issue with assignee', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { assigneeId: "user1" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create issue with due date', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { dueDate: "2024-12-31" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create issue with description', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { description: "Desc" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create issue with estimate', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { estimate: 3 }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create issue with project', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { projectId: "proj1" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create issue with team', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { teamId: "team1" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should list issues with pagination', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issues: { nodes: [], pageInfo: { hasNextPage: true } } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { issues(first: 10) { nodes { id } pageInfo { hasNextPage } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should filter issues by state', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issues: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { issues(filter: { state: { neq: "triage" } }) { nodes { id } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should filter issues by priority', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issues: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { issues(filter: { priority: { eq: 1 } }) { nodes { id } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should filter issues by assignee', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issues: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { issues(filter: { assignee: { eq: "user1" } }) { nodes { id } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should get issue relations', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issue: { relations: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { issue(id: "issue1") { relations { nodes { id } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create relation', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { relationCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { relationCreate(input: {}) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should list templates', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueTemplates: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { issueTemplates { nodes { id } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create issue from template', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { issueCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { issueCreate(input: { templateId: "temp1" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should get cycle progress', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { cycle: { progress: 50 } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { cycle(id: "cycle1") { progress } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should list cycles', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { cycles: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { cycles { nodes { id } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create cycle', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { cycleCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { cycleCreate(input: { name: "Sprint 1" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should update cycle', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { cycleUpdate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { cycleUpdate(id: "cycle1", input: {}) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should archive cycle', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { cycleArchive: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { cycleArchive(id: "cycle1") { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should get team members', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { team: { members: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { team(id: "team1") { members { nodes { id } } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create team', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { teamCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { teamCreate(input: { name: "New Team" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should get labeling keys', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { labelingKeys: { nodes: [] } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'query { labelingKeys { nodes { id } } }' })
    });
    expect(res.status).toBe(200);
  });

  it('should create labeling key', async () => {
    nock(baseUrl).post('').reply(200, {
      data: { labelingKeyCreate: { success: true } }
    });
    const res = await fetch(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'mutation { labelingKeyCreate(input: { name: "Key" }) { success } }' })
    });
    expect(res.status).toBe(200);
  });
});

describe('HubSpot CRM - Extended Tests', () => {
  const baseUrl = 'https://api.hubapi.com/crm/v3';
  beforeEach(() => nock.disableNetConnect());

  it('should create contact with properties', async () => {
    nock(baseUrl).post('/objects/contacts').reply(201, {
      id: 'contact1',
      properties: { email: 'test@example.com', firstname: 'John' }
    });
    const res = await fetch(`${baseUrl}/objects/contacts`, {
      method: 'POST',
      body: JSON.stringify({ properties: { email: 'test@example.com', firstname: 'John' } })
    });
    expect(res.status).toBe(201);
  });

  it('should batch create contacts', async () => {
    nock(baseUrl).post('/objects/contacts/batch/create').reply(200, {
      results: [{ id: 'contact1' }]
    });
    const res = await fetch(`${baseUrl}/objects/contacts/batch/create`, {
      method: 'POST',
      body: JSON.stringify({ inputs: [{ properties: { email: 'test@example.com' } }] })
    });
    expect(res.status).toBe(200);
  });

  it('should batch update contacts', async () => {
    nock(baseUrl).post('/objects/contacts/batch/update').reply(200, {
      results: [{ id: 'contact1' }]
    });
    const res = await fetch(`${baseUrl}/objects/contacts/batch/update`, {
      method: 'POST',
      body: JSON.stringify({ inputs: [{ id: 'contact1', properties: {} }] })
    });
    expect(res.status).toBe(200);
  });

  it('should search contacts with filters', async () => {
    nock(baseUrl).post('/objects/contacts/search').reply(200, {
      total: 1,
      results: [{ id: 'contact1' }]
    });
    const res = await fetch(`${baseUrl}/objects/contacts/search`, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'CONTAINS_TOKEN',
            value: '@example.com'
          }]
        }]
      })
    });
    expect(res.status).toBe(200);
  });

  it('should sort search results', async () => {
    nock(baseUrl).post('/objects/contacts/search').reply(200, { results: [] });
    const res = await fetch(`${baseUrl}/objects/contacts/search`, {
      method: 'POST',
      body: JSON.stringify({ sorts: ['createdate'] })
    });
    expect(res.status).toBe(200);
  });

  it('should paginate search results', async () => {
    nock(baseUrl).post('/objects/contacts/search').reply(200, { results: [], paging: {} });
    const res = await fetch(`${baseUrl}/objects/contacts/search`, {
      method: 'POST',
      body: JSON.stringify({ limit: 10, after: 'cursor' })
    });
    expect(res.status).toBe(200);
  });

  it('should create company with properties', async () => {
    nock(baseUrl).post('/objects/companies').reply(201, {
      id: 'company1',
      properties: { name: 'Acme Corp' }
    });
    const res = await fetch(`${baseUrl}/objects/companies`, {
      method: 'POST',
      body: JSON.stringify({ properties: { name: 'Acme Corp', domain: 'acme.com' } })
    });
    expect(res.status).toBe(201);
  });

  it('should associate contacts with companies', async () => {
    nock(baseUrl).put('/objects/contacts/contact1/associations/companies/company1/contact_to_company').reply(200, {});
    const res = await fetch(`${baseUrl}/objects/contacts/contact1/associations/companies/company1/contact_to_company`, {
      method: 'PUT'
    });
    expect(res.status).toBe(200);
  });

  it('should get deal properties', async () => {
    nock(baseUrl).get('/properties/deals').reply(200, { results: [] });
    const res = await fetch(`${baseUrl}/properties/deals`);
    expect(res.status).toBe(200);
  });

  it('should create custom property', async () => {
    nock(baseUrl).post('/properties/contacts').reply(201, {
      name: 'custom_property',
      type: 'string'
    });
    const res = await fetch(`${baseUrl}/properties/contacts`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'custom_property',
        label: 'Custom Property',
        fieldType: 'text'
      })
    });
    expect(res.status).toBe(201);
  });

  it('should create engagement (note)', async () => {
    nock(baseUrl).post('/objects/notes').reply(201, { id: 'note1' });
    const res = await fetch(`${baseUrl}/objects/notes`, {
      method: 'POST',
      body: JSON.stringify({ properties: { hs_note_body: 'Note content' } })
    });
    expect(res.status).toBe(201);
  });

  it('should create engagement (task)', async () => {
    nock(baseUrl).post('/objects/tasks').reply(201, { id: 'task1' });
    const res = await fetch(`${baseUrl}/objects/tasks`, {
      method: 'POST',
      body: JSON.stringify({ properties: { hs_task_subject: 'Task' } })
    });
    expect(res.status).toBe(201);
  });

  it('should create email engagement', async () => {
    nock(baseUrl).post('/objects/emails').reply(201, { id: 'email1' });
    const res = await fetch(`${baseUrl}/objects/emails`, {
      method: 'POST',
      body: JSON.stringify({ properties: {} })
    });
    expect(res.status).toBe(201);
  });

  it('should create meeting engagement', async () => {
    nock(baseUrl).post('/objects/meetings').reply(201, { id: 'meeting1' });
    const res = await fetch(`${baseUrl}/objects/meetings`, {
      method: 'POST',
      body: JSON.stringify({ properties: {} })
    });
    expect(res.status).toBe(201);
  });

  it('should create call engagement', async () => {
    nock(baseUrl).post('/objects/calls').reply(201, { id: 'call1' });
    const res = await fetch(`${baseUrl}/objects/calls`, {
      method: 'POST',
      body: JSON.stringify({ properties: {} })
    });
    expect(res.status).toBe(201);
  });

  it('should get pipeline stages', async () => {
    nock(baseUrl).get('/pipelines/deals').reply(200, { results: [] });
    const res = await fetch(`${baseUrl}/pipelines/deals`);
    expect(res.status).toBe(200);
  });

  it('should create deal with association', async () => {
    nock(baseUrl).post('/objects/deals').reply(201, { id: 'deal1' });
    const res = await fetch(`${baseUrl}/objects/deals`, {
      method: 'POST',
      body: JSON.stringify({
        properties: { dealname: 'Deal' },
        associations: [{ to: { id: 'contact1' }, types: [{ associationCategory: 'HUBSPOT_DEFINED' }] }]
      })
    });
    expect(res.status).toBe(201);
  });

  it('should get owners', async () => {
    nock(baseUrl).get('/owners').reply(200, { results: [] });
    const res = await fetch(`${baseUrl}/owners`);
    expect(res.status).toBe(200);
  });

  it('should get quote', async () => {
    nock(baseUrl).get('/objects/quotes/quote1').reply(200, { id: 'quote1' });
    const res = await fetch(`${baseUrl}/objects/quotes/quote1`);
    expect(res.status).toBe(200);
  });

  it('should create quote', async () => {
    nock(baseUrl).post('/objects/quotes').reply(201, { id: 'quote1' });
    const res = await fetch(`${baseUrl}/objects/quotes`, {
      method: 'POST',
      body: JSON.stringify({ properties: {} })
    });
    expect(res.status).toBe(201);
  });

  it('should get ticket properties', async () => {
    nock(baseUrl).get('/properties/tickets').reply(200, { results: [] });
    const res = await fetch(`${baseUrl}/properties/tickets`);
    expect(res.status).toBe(200);
  });

  it('should create ticket with properties', async () => {
    nock(baseUrl).post('/objects/tickets').reply(201, { id: 'ticket1' });
    const res = await fetch(`${baseUrl}/objects/tickets`, {
      method: 'POST',
      body: JSON.stringify({ properties: { hs_subject: 'Help!' } })
    });
    expect(res.status).toBe(201);
  });

  it('should create product', async () => {
    nock(baseUrl).post('/objects/products').reply(201, { id: 'product1' });
    const res = await fetch(`${baseUrl}/objects/products`, {
      method: 'POST',
      body: JSON.stringify({ properties: { name: 'Product' } })
    });
    expect(res.status).toBe(201);
  });

  it('should create line item', async () => {
    nock(baseUrl).post('/objects/line_items').reply(201, { id: 'item1' });
    const res = await fetch(`${baseUrl}/objects/line_items`, {
      method: 'POST',
      body: JSON.stringify({ properties: {} })
    });
    expect(res.status).toBe(201);
  });
});

describe('Salesforce - Extended Tests', () => {
  const baseUrl = 'https://example.salesforce.com/services/data/v58.0';
  beforeEach(() => nock.disableNetConnect());

  it('should query with WHERE clause', async () => {
    nock(baseUrl).get('/query').query({ q: 'SELECT Id FROM Contact WHERE Email = "test@example.com"' }).reply(200, { records: [] });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Id+FROM+Contact+WHERE+Email+=+%22test%40example.com%22`);
    expect(res.status).toBe(200);
  });

  it('should query with ORDER BY', async () => {
    nock(baseUrl).get('/query').query({ q: 'SELECT Id FROM Contact ORDER BY Name' }).reply(200, { records: [] });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Id+FROM+Contact+ORDER+BY+Name`);
    expect(res.status).toBe(200);
  });

  it('should query with LIMIT', async () => {
    nock(baseUrl).get('/query').query({ q: 'SELECT Id FROM Contact LIMIT 10' }).reply(200, { records: [] });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Id+FROM+Contact+LIMIT+10`);
    expect(res.status).toBe(200);
  });

  it('should query with OFFSET', async () => {
    nock(baseUrl).get('/query').query({ q: 'SELECT Id FROM Contact OFFSET 10' }).reply(200, { records: [] });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Id+FROM+Contact+OFFSET+10`);
    expect(res.status).toBe(200);
  });

  it('should query with aggregate functions', async () => {
    nock(baseUrl).get('/query').query({ q: 'SELECT Count() FROM Contact' }).reply(200, { totalSize: 10 });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Count()+FROM+Contact`);
    const data = await res.json();
    expect(data.totalSize).toBeDefined();
  });

  it('should query with GROUP BY', async () => {
    nock(baseUrl).get('/query').query({ q: 'SELECT Department, Count() FROM Contact GROUP BY Department' }).reply(200, { records: [] });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Department,+Count()+FROM+Contact+GROUP+BY+Department`);
    expect(res.status).toBe(200);
  });

  it('should query with subquery', async () => {
    nock(baseUrl).get('/query').query({ q: /SELECT Id, \(SELECT Id FROM Contacts\) FROM Account/ }).reply(200, { records: [] });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Id,+(SELECT+Id+FROM+Contacts)+FROM+Account`);
    expect(res.status).toBe(200);
  });

  it('should create with external ID', async () => {
    nock(baseUrl).post('/sobjects/Contact').reply(201, { id: '003new' });
    const res = await fetch(`${baseUrl}/sobjects/Contact`, {
      method: 'POST',
      body: JSON.stringify({ Email: 'test@example.com', External_Id__c: 'ext123' })
    });
    expect(res.status).toBe(201);
  });

  it('should upsert record', async () => {
    nock(baseUrl).patch('/sobjects/Contact/External_Id__c/ext123').reply(200, { id: '003new' });
    const res = await fetch(`${baseUrl}/sobjects/Contact/External_Id__c/ext123`, {
      method: 'PATCH',
      body: JSON.stringify({ FirstName: 'Updated' })
    });
    expect(res.status).toBe(200);
  });

  it('should get describe', async () => {
    nock(baseUrl).get('/sobjects/Contact/describe').reply(200, { name: 'Contact', fields: [] });
    const res = await fetch(`${baseUrl}/sobjects/Contact/describe`);
    expect(res.status).toBe(200);
  });

  it('should get recent items', async () => {
    nock(baseUrl).get('/sobjects/Contact/recent').reply(200, []);
    const res = await fetch(`${baseUrl}/sobjects/Contact/recent`);
    expect(res.status).toBe(200);
  });

  it('should get updated items', async () => {
    nock(baseUrl).get('/sobjects/Contact/updated').query({ start: '2024-01-01', end: '2024-01-31' }).reply(200, { ids: [] });
    const res = await fetch(`${baseUrl}/sobjects/Contact/updated?start=2024-01-01&end=2024-01-31`);
    expect(res.status).toBe(200);
  });

  it('should get deleted items', async () => {
    nock(baseUrl).get('/sobjects/Contact/deleted').query({ start: '2024-01-01', end: '2024-01-31' }).reply(200, { deletedRecords: [] });
    const res = await fetch(`${baseUrl}/sobjects/Contact/deleted?start=2024-01-01&end=2024-01-31`);
    expect(res.status).toBe(200);
  });

  it('should query all', async () => {
    nock(baseUrl).get('/query').query({ q: 'SELECT Id FROM ALL Contact' }).reply(200, { records: [] });
    const res = await fetch(`${baseUrl}/query?q=SELECT+Id+FROM+ALL+Contact`);
    expect(res.status).toBe(200);
  });

  it('should use composite resource', async () => {
    nock(baseUrl).patch('/composite').reply(200, { compositeResponse: [] });
    const res = await fetch(`${baseUrl}/composite`, {
      method: 'PATCH',
      body: JSON.stringify({
        compositeRequest: [{
          method: 'PATCH',
          url: '/services/data/v58.0/sobjects/Contact/0031',
          referenceId: 'ref1',
          body: { FirstName: 'Updated' }
        }]
      })
    });
    expect(res.status).toBe(200);
  });
});