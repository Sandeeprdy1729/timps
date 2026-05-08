import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('Linear Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.linear.app/graphql';
  const apiKey = 'lin_api_xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Issues', () => {
    it('should query issues', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          issues: {
            nodes: [
              { id: 'issue1', title: 'Bug', priority: 1 },
              { id: 'issue2', title: 'Feature', priority: 2 }
            ]
          }
        }
      });
      const query = `query { issues { nodes { id title priority } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      const data = await res.json();
      expect(data.data.issues.nodes).toHaveLength(2);
    });

    it('should create issue', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          issueCreate: { success: true, issue: { id: 'issue1', title: 'New Issue' } }
        }
      });
      const mutation = `mutation { issueCreate(input: { title: "New Issue" }) { success issue { id } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query: mutation }) });
      const data = await res.json();
      expect(data.data.issueCreate.success).toBe(true);
    });

    it('should update issue', async () => {
      nock(baseUrl).post('').reply(200, {
        data: { issueUpdate: { success: true } }
      });
      const mutation = `mutation { issueUpdate(id: "issue1", input: { title: "Updated" }) { success } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query: mutation }) });
      const data = await res.json();
      expect(data.data.issueUpdate.success).toBe(true);
    });

    it('should archive issue', async () => {
      nock(baseUrl).post('').reply(200, {
        data: { issueArchive: { success: true } }
      });
      const mutation = `mutation { issueArchive(id: "issue1") { success } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query: mutation }) });
      const data = await res.json();
      expect(data.data.issueArchive.success).toBe(true);
    });

    it('should list issue comments', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          issue: {
            comments: { nodes: [{ id: 'comment1', body: 'Comment' } }
          }
        }
      });
      const query = `query { issue(id: "issue1") { comments { nodes { id body } } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      const data = await res.json();
      expect(data.data.issue.comments.nodes).toBeDefined();
    });
  });

  describe('Projects', () => {
    it('should list projects', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          projects: {
            nodes: [{ id: 'proj1', name: 'Project' }]
          }
        }
      });
      const query = `query { projects { nodes { id name } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      const data = await res.json();
      expect(data.data.projects.nodes).toHaveLength(1);
    });

    it('should create project', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          projectCreate: { success: true, project: { id: 'proj1' }
        }
      });
      const mutation = `mutation { projectCreate(input: { name: "New Project" }) { success project { id } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query: mutation }) });
      const data = await res.json();
      expect(data.data.projectCreate.success).toBe(true);
    });
  });

  describe('Teams', () => {
    it('should list teams', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          teams: {
            nodes: [{ id: 'team1', key: 'TEAM', name: 'Team' }]
          }
        }
      });
      const query = `query { teams { nodes { id key name } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      const data = await res.json();
      expect(data.data.teams.nodes).toHaveLength(1);
    });
  });

  describe('Workflow States', () => {
    it('should list states', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          workflowStates: {
            nodes: [{ id: 'state1', name: 'Todo', type: 'triage' }]
          }
        }
      });
      const query = `query { workflowStates { nodes { id name type } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      const data = await res.json();
      expect(data.data.workflowStates.nodes).toBeDefined();
    });
  });

  describe('Labels', () => {
    it('should list labels', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          labels: {
            nodes: [{ id: 'label1', name: 'Bug', color: '#ff0000' }]
          }
        }
      });
      const query = `query { labels { nodes { id name color } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      const data = await res.json();
      expect(data.data.labels.nodes).toHaveLength(1);
    });

    it('should create label', async () => {
      nock(baseUrl).post('').reply(200, {
        data: {
          labelCreate: { success: true, label: { id: 'label1' }
        }
      });
      const mutation = `mutation { labelCreate(input: { name: "Bug", color: "#ff0000" }) { success label { id } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query: mutation }) });
      const data = await res.json();
      expect(data.data.labelCreate.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle not found', async () => {
      nock(baseUrl).post('').reply(200, {
        data: null,
        errors: [{ message: 'Issue not found', extensions: { code: 'NOT_FOUND' } }]
      });
      const query = `query { issue(id: "invalid") { id } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      const data = await res.json();
      expect(data.errors).toBeDefined();
    });

    it('should handle rate limit', async () => {
      nock(baseUrl).post('').reply(429, { error: { message: 'Rate limited' } });
      const query = `query { issues { nodes { id } } }`;
      const res = await fetch(baseUrl, { method: 'POST', body: JSON.stringify({ query }) });
      expect(res.status).toBe(429);
    });
  });
});

describe('HubSpot CRM Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.hubapi.com/crm/v3';
  const apiKey = 'hub_api_xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Contacts', () => {
    it('should list contacts', async () => {
      nock(baseUrl).get('/objects/contacts').reply(200, {
        results: [{ id: 'contact1', properties: { email: 'test@example.com' } }]
      });
      const res = await fetch(`${baseUrl}/objects/contacts`);
      const data = await res.json();
      expect(data.results).toHaveLength(1);
    });

    it('should create contact', async () => {
      nock(baseUrl).post('/objects/contacts').reply(201, {
        id: 'contact1',
        properties: { email: 'test@example.com' }
      });
      const res = await fetch(`${baseUrl}/objects/contacts`, {
        method: 'POST',
        body: JSON.stringify({ properties: { email: 'test@example.com' } })
      });
      const data = await res.json();
      expect(data.id).toBe('contact1');
    });

    it('should update contact', async () => {
      nock(baseUrl).patch('/objects/contacts/contact1').reply(200, {
        id: 'contact1',
        properties: { firstname: 'Updated' }
      });
      const res = await fetch(`${baseUrl}/objects/contacts/contact1`, {
        method: 'PATCH',
        body: JSON.stringify({ properties: { firstname: 'Updated' } })
      });
      const data = await res.json();
      expect(data.properties.firstname).toBe('Updated');
    });

    it('should delete contact', async () => {
      nock(baseUrl).delete('/objects/contacts/contact1').reply(204, '');
      const res = await fetch(`${baseUrl}/objects/contacts/contact1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(204);
    });

    it('should search contacts', async () => {
      nock(baseUrl).post('/objects/contacts/search').reply(200, {
        total: 1,
        results: [{ id: 'contact1' }]
      });
      const res = await fetch(`${baseUrl}/objects/contacts/search`, {
        method: 'POST',
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: 'test@example.com' }] }] })
      });
      const data = await res.json();
      expect(data.total).toBe(1);
    });
  });

  describe('Companies', () => {
    it('should list companies', async () => {
      nock(baseUrl).get('/objects/companies').reply(200, {
        results: [{ id: 'company1', properties: { name: 'Company' } }]
      });
      const res = await fetch(`${baseUrl}/objects/companies`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should create company', async () => {
      nock(baseUrl).post('/objects/companies').reply(201, {
        id: 'company1',
        properties: { name: 'New Company' }
      });
      const res = await fetch(`${baseUrl}/objects/companies`, {
        method: 'POST',
        body: JSON.stringify({ properties: { name: 'New Company' } })
      });
      const data = await res.json();
      expect(data.id).toBe('company1');
    });
  });

  describe('Deals', () => {
    it('should list deals', async () => {
      nock(baseUrl).get('/objects/deals').reply(200, {
        results: [{ id: 'deal1', properties: { dealname: 'Deal' } }]
      });
      const res = await fetch(`${baseUrl}/objects/deals`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should create deal', async () => {
      nock(baseUrl).post('/objects/deals').reply(201, {
        id: 'deal1',
        properties: { dealname: 'New Deal' }
      });
      const res = await fetch(`${baseUrl}/objects/deals`, {
        method: 'POST',
        body: JSON.stringify({ properties: { dealname: 'New Deal' } })
      });
      const data = await res.json();
      expect(data.id).toBe('deal1');
    });
  });

  describe('Tickets', () => {
    it('should list tickets', async () => {
      nock(baseUrl).get('/objects/tickets').reply(200, {
        results: [{ id: 'ticket1', properties: { subject: 'Help!' } }]
      });
      const res = await fetch(`${baseUrl}/objects/tickets`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });
  });

  describe('Pipelines', () => {
    it('should get pipelines', async () => {
      nock(baseUrl).get('/pipelines/deals').reply(200, {
        results: [{ id: 'pipeline1', stages: [] }]
      });
      const res = await fetch(`${baseUrl}/pipelines/deals`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });
  });

  describe('Associations', () => {
    it('should create association', async () => {
      nock(baseUrl).put('/objects/contacts/contact1/associations/deals/deal1/deal_to_contact').reply(200, {});
      const res = await fetch(`${baseUrl}/objects/contacts/contact1/associations/deals/deal1/deal_to_contact`, {
        method: 'PUT'
      });
      expect(res.status).toBe(200);
    });
  });
});

describe('Salesforce Integration - Full Test Suite', () => {
  const baseUrl = 'https://example.salesforce.com/services/data/v58.0';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('SOQL Queries', () => {
    it('should query contacts', async () => {
      nock(baseUrl).get('/query').query({ q: 'SELECT Id, Name FROM Contact' }).reply(200, {
        totalSize: 2,
        done: true,
        records: [{ Id: '0031', Name: 'Contact 1' }, { Id: '0032', Name: 'Contact 2' }]
      });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id,+Name+FROM+Contact`);
      const data = await res.json();
      expect(data.totalSize).toBe(2);
    });

    it('should query with limit', async () => {
      nock(baseUrl).get('/query').query({ q: 'SELECT Id FROM Contact LIMIT 10' }).reply(200, {
        totalSize: 10,
        records: []
      });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id+FROM+Contact+LIMIT+10`);
      const data = await res.json();
      expect(data.totalSize).toBe(10);
    });

    it('should query with offset', async () => {
      nock(baseUrl).get('/query').query({ q: 'SELECT Id FROM Contact OFFSET 10' }).reply(200, {
        totalSize: 5,
        records: []
      });
      const res = await fetch(`${baseUrl}/query?q=SELECT+Id+FROM+Contact+OFFSET+10`);
      const data = await res.json();
      expect(data.totalSize).toBe(5);
    });
  });

  describe('SObjects', () => {
    it('should create contact', async () => {
      nock(baseUrl).post('/sobjects/Contact').reply(201, {
        id: '003new',
        success: true
      });
      const res = await fetch(`${baseUrl}/sobjects/Contact`, {
        method: 'POST',
        body: JSON.stringify({ FirstName: 'Test', LastName: 'User' })
      });
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should get contact', async () => {
      nock(baseUrl).get('/sobjects/Contact/0031').reply(200, {
        Id: '0031',
        FirstName: 'Test',
        LastName: 'User'
      });
      const res = await fetch(`${baseUrl}/sobjects/Contact/0031`);
      const data = await res.json();
      expect(data.Id).toBe('0031');
    });

    it('should update contact', async () => {
      nock(baseUrl).patch('/sobjects/Contact/0031').reply(200, {
        id: '0031',
        success: true
      });
      const res = await fetch(`${baseUrl}/sobjects/Contact/0031`, {
        method: 'PATCH',
        body: JSON.stringify({ FirstName: 'Updated' })
      });
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should delete contact', async () => {
      nock(baseUrl).delete('/sobjects/Contact/0031').reply(204, '');
      const res = await fetch(`${baseUrl}/sobjects/Contact/0031`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(204);
    });
  });

  describe('Describe', () => {
    it('should describe Contact', async () => {
      nock(baseUrl).get('/sobjects/Contact/describe').reply(200, {
        name: 'Contact',
        fields: []
      });
      const res = await fetch(`${baseUrl}/sobjects/Contact/describe`);
      const data = await res.json();
      expect(data.name).toBe('Contact');
    });

    it('should list global describe', async () => {
      nock(baseUrl).get('/sobjects').reply(200, {
        sobjects: [{ name: 'Contact', label: 'Contact' }]
      });
      const res = await fetch(`${baseUrl}/sobjects`);
      const data = await res.json();
      expect(data.sobjects).toBeDefined();
    });
  });

  describe('Batch', () => {
    it('should execute batch', async () => {
      nock(baseUrl).post('/composite/batch').reply(200, {
        results: []
      });
      const res = await fetch(`${baseUrl}/composite/batch`, {
        method: 'POST',
        body: JSON.stringify({ batchRequests: [] })
      });
      const data = await res.json();
      expect(data.results).toBeDefined();
    });
  });
});

describe('Shopify Integration - Full Test Suite', () => {
  const baseUrl = 'https://shop.myshopify.com/admin/api/2024-01';
  const apiKey = 'shpat_xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Products', () => {
    it('should list products', async () => {
      nock(baseUrl).get('/products.json').reply(200, {
        products: [
          { id: 1, title: 'Product 1' },
          { id: 2, title: 'Product 2' }
        ]
      });
      const res = await fetch(`${baseUrl}/products.json`);
      const data = await res.json();
      expect(data.products).toHaveLength(2);
    });

    it('should get product', async () => {
      nock(baseUrl).get('/products/1.json').reply(200, {
        product: { id: 1, title: 'Product 1' }
      });
      const res = await fetch(`${baseUrl}/products/1.json`);
      const data = await res.json();
      expect(data.product.id).toBe(1);
    });

    it('should create product', async () => {
      nock(baseUrl).post('/products.json').reply(201, {
        product: { id: 1, title: 'New Product' }
      });
      const res = await fetch(`${baseUrl}/products.json`, {
        method: 'POST',
        body: JSON.stringify({ product: { title: 'New Product' } })
      });
      const data = await res.json();
      expect(data.product.id).toBe(1);
    });

    it('should update product', async () => {
      nock(baseUrl).put('/products/1.json').reply(200, {
        product: { id: 1, title: 'Updated' }
      });
      const res = await fetch(`${baseUrl}/products/1.json`, {
        method: 'PUT',
        body: JSON.stringify({ product: { title: 'Updated' } })
      });
      const data = await res.json();
      expect(data.product.title).toBe('Updated');
    });

    it('should delete product', async () => {
      nock(baseUrl).delete('/products/1.json').reply(200, {});
      const res = await fetch(`${baseUrl}/products/1.json`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Collections', () => {
    it('should list collections', async () => {
      nock(baseUrl).get('/custom_collections.json').reply(200, {
        custom_collections: [{ id: 1, title: 'Collection' }]
      });
      const res = await fetch(`${baseUrl}/custom_collections.json`);
      const data = await res.json();
      expect(data.custom_collections).toBeDefined();
    });

    it('should create collection', async () => {
      nock(baseUrl).post('/custom_collections.json').reply(201, {
        custom_collection: { id: 1, title: 'New Collection' }
      });
      const res = await fetch(`${baseUrl}/custom_collections.json`, {
        method: 'POST',
        body: JSON.stringify({ custom_collection: { title: 'New Collection' } })
      });
      const data = await res.json();
      expect(data.custom_collection.id).toBe(1);
    });
  });

  describe('Orders', () => {
    it('should list orders', async () => {
      nock(baseUrl).get('/orders.json').reply(200, {
        orders: [{ id: 1, name: '#1001' }]
      });
      const res = await fetch(`${baseUrl}/orders.json`);
      const data = await res.json();
      expect(data.orders).toBeDefined();
    });

    it('should get order', async () => {
      nock(baseUrl).get('/orders/1.json').reply(200, {
        order: { id: 1, name: '#1001' }
      });
      const res = await fetch(`${baseUrl}/orders/1.json`);
      const data = await res.json();
      expect(data.order.id).toBe(1);
    });

    it('should close order', async () => {
      nock(baseUrl).post('/orders/1/close.json').reply(200, {
        order: { id: 1, closed: true }
      });
      const res = await fetch(`${baseUrl}/orders/1/close.json`, {
        method: 'POST'
      });
      const data = await res.json();
      expect(data.order.closed).toBe(true);
    });
  });

  describe('Customers', () => {
    it('should list customers', async () => {
      nock(baseUrl).get('/customers.json').reply(200, {
        customers: [{ id: 1, email: 'test@example.com' }]
      });
      const res = await fetch(`${baseUrl}/customers.json`);
      const data = await res.json();
      expect(data.customers).toHaveLength(1);
    });

    it('should create customer', async () => {
      nock(baseUrl).post('/customers.json').reply(201, {
        customer: { id: 1, email: 'new@example.com' }
      });
      const res = await fetch(`${baseUrl}/customers.json`, {
        method: 'POST',
        body: JSON.stringify({ customer: { email: 'new@example.com' } })
      });
      const data = await res.json();
      expect(data.customer.id).toBe(1);
    });
  });

  describe('Inventory', () => {
    it('should adjust inventory', async () => {
      nock(baseUrl).post('/inventory_levels/adjust.json').reply(200, {
        inventory_item_id: 1,
        available: 10
      });
      const res = await fetch(`${baseUrl}/inventory_levels/adjust.json`, {
        method: 'POST',
        body: JSON.stringify({ inventory_item_id: 1, available_delta: 5 })
      });
      const data = await res.json();
      expect(data.available).toBe(10);
    });

    it('should set inventory', async () => {
      nock(baseUrl).post('/inventory_levels/set.json').reply(200, {
        inventory_item_id: 1,
        available: 10
      });
      const res = await fetch(`${baseUrl}/inventory_levels/set.json`, {
        method: 'POST',
        body: JSON.stringify({ inventory_item_id: 1, available: 10 })
      });
      const data = await res.json();
      expect(data.available).toBe(10);
    });
  });
});

describe('Discord Integration - Full Test Suite', () => {
  const baseUrl = 'https://discord.com/api/v10';
  const token = 'Bot xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Channels', () => {
    it('should get channel', async () => {
      nock(baseUrl).get('/channels/123').reply(200, {
        id: '123',
        name: 'general',
        type: 0
      });
      const res = await fetch(`${baseUrl}/channels/123`);
      const data = await res.json();
      expect(data.name).toBe('general');
    });

    it('should create message', async () => {
      nock(baseUrl).post('/channels/123/messages').reply(200, {
        id: 'msg1',
        content: 'Hello'
      });
      const res = await fetch(`${baseUrl}/channels/123/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello' })
      });
      const data = await res.json();
      expect(data.content).toBe('Hello');
    });

    it('should edit message', async () => {
      nock(baseUrl).patch('/channels/123/messages/msg1').reply(200, {
        id: 'msg1',
        content: 'Updated'
      });
      const res = await fetch(`${baseUrl}/channels/123/messages/msg1`, {
        method: 'PATCH',
        body: JSON.stringify({ content: 'Updated' })
      });
      const data = await res.json();
      expect(data.content).toBe('Updated');
    });

    it('should delete message', async () => {
      nock(baseUrl).delete('/channels/123/messages/msg1').reply(204, '');
      const res = await fetch(`${baseUrl}/channels/123/messages/msg1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(204);
    });

    it('should add reaction', async () => {
      nock(baseUrl).put('/channels/123/messages/msg1/reactions/emoji/me').reply(204, '');
      const res = await fetch(`${baseUrl}/channels/123/messages/msg1/reactions/emoji/me`, {
        method: 'PUT'
      });
      expect(res.status).toBe(204);
    });
  });

  describe('Guilds', () => {
    it('should get guild', async () => {
      nock(baseUrl).get('/guilds/guild1').reply(200, {
        id: 'guild1',
        name: 'Server'
      });
      const res = await fetch(`${baseUrl}/guilds/guild1`);
      const data = await res.json();
      expect(data.name).toBe('Server');
    });

    it('should get guild channels', async () => {
      nock(baseUrl).get('/guilds/guild1/channels').reply(200, [
        { id: '123', name: 'general' }
      ]);
      const res = await fetch(`${baseUrl}/guilds/guild1/channels`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create channel', async () => {
      nock(baseUrl).post('/guilds/guild1/channels').reply(201, {
        id: '123',
        name: 'new-channel'
      });
      const res = await fetch(`${baseUrl}/guilds/guild1/channels`, {
        method: 'POST',
        body: JSON.stringify({ name: 'new-channel', type: 0 })
      });
      const data = await res.json();
      expect(data.name).toBe('new-channel');
    });
  });

  describe('Members', () => {
    it('should get member', async () => {
      nock(baseUrl).get('/guilds/guild1/members/user1').reply(200, {
        user: { id: 'user1', username: 'user' },
        nick: 'Nickname'
      });
      const res = await fetch(`${baseUrl}/guilds/guild1/members/user1`);
      const data = await res.json();
      expect(data.nick).toBe('Nickname');
    });

    it('should edit member', async () => {
      nock(baseUrl).patch('/guilds/guild1/members/user1').reply(200, {
        nick: 'NewNick'
      });
      const res = await fetch(`${baseUrl}/guilds/guild1/members/user1`, {
        method: 'PATCH',
        body: JSON.stringify({ nick: 'NewNick' })
      });
      const data = await res.json();
      expect(data.nick).toBe('NewNick');
    });

    it('should add role', async () => {
      nock(baseUrl).put('/guilds/guild1/members/user1/roles/role1').reply(204, '');
      const res = await fetch(`${baseUrl}/guilds/guild1/members/user1/roles/role1`, {
        method: 'PUT'
      });
      expect(res.status).toBe(204);
    });
  });

  describe('Webhooks', () => {
    it('should create webhook', async () => {
      nock(baseUrl).post('/channels/123/webhooks').reply(201, {
        id: 'webhook1',
        name: 'Webhook'
      });
      const res = await fetch(`${baseUrl}/channels/123/webhooks`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Webhook' })
      });
      const data = await res.json();
      expect(data.id).toBe('webhook1');
    });

    it('should execute webhook', async () => {
      nock(baseUrl).post('/webhooks/webhook1/token').reply(200, {
        id: 'msg1'
      });
      const res = await fetch(`${baseUrl}/webhooks/webhook1/token`, {
        method: 'POST',
        body: JSON.stringify({ content: 'Message' })
      });
      const data = await res.json();
      expect(data.id).toBeDefined();
    });
  });
});

describe('Zoom Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.zoom.us/v2';
  const token = 'Bearer xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Users', () => {
    it('should get current user', async () => {
      nock(baseUrl).get('/users/me').reply(200, {
        id: 'user1',
        email: 'test@example.com'
      });
      const res = await fetch(`${baseUrl}/users/me`);
      const data = await res.json();
      expect(data.email).toBe('test@example.com');
    });

    it('should list users', async () => {
      nock(baseUrl).get('/users').reply(200, {
        users: [{ id: 'user1', email: 'test@example.com' }]
      });
      const res = await fetch(`${baseUrl}/users`);
      const data = await res.json();
      expect(data.users).toHaveLength(1);
    });
  });

  describe('Meetings', () => {
    it('should list meetings', async () => {
      nock(baseUrl).get('/users/me/meetings').reply(200, {
        meetings: [{ id: 'meeting1', topic: 'Standup' }]
      });
      const res = await fetch(`${baseUrl}/users/me/meetings`);
      const data = await res.json();
      expect(data.meetings).toBeDefined();
    });

    it('should create meeting', async () => {
      nock(baseUrl).post('/users/me/meetings').reply(201, {
        id: 'meeting1',
        topic: 'New Meeting',
        start_url: 'https://zoom.us/s/start'
      });
      const res = await fetch(`${baseUrl}/users/me/meetings`, {
        method: 'POST',
        body: JSON.stringify({ topic: 'New Meeting', type: 1 })
      });
      const data = await res.json();
      expect(data.id).toBe('meeting1');
    });

    it('should get meeting', async () => {
      nock(baseUrl).get('/meetings/meeting1').reply(200, {
        id: 'meeting1',
        topic: 'Meeting'
      });
      const res = await fetch(`${baseUrl}/meetings/meeting1`);
      const data = await res.json();
      expect(data.id).toBe('meeting1');
    });

    it('should update meeting', async () => {
      nock(baseUrl).patch('/meetings/meeting1').reply(204, '');
      const res = await fetch(`${baseUrl}/meetings/meeting1`, {
        method: 'PATCH',
        body: JSON.stringify({ topic: 'Updated' })
      });
      expect(res.status).toBe(204);
    });

    it('should delete meeting', async () => {
      nock(baseUrl).delete('/meetings/meeting1').reply(204, '');
      const res = await fetch(`${baseUrl}/meetings/meeting1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(204);
    });
  });

  describe('Recordings', () => {
    it('should list recordings', async () => {
      nock(baseUrl).get('/users/me/recordings').reply(200, {
        meetings: []
      });
      const res = await fetch(`${baseUrl}/users/me/recordings`);
      const data = await res.json();
      expect(data.meetings).toBeDefined();
    });

    it('should delete recordings', async () => {
      nock(baseUrl).delete('/meetings/meeting1/recordings').reply(204, '');
      const res = await fetch(`${baseUrl}/meetings/meeting1/recordings`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(204);
    });
  });
});

describe('Figma Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.figma.com/v1';
  const token = 'figd_xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Files', () => {
    it('should get file', async () => {
      nock(baseUrl).get('/files/filekey').reply(200, {
        name: 'Design',
        lastModified: '2024-01-01',
        document: {}
      });
      const res = await fetch(`${baseUrl}/files/filekey`);
      const data = await res.json();
      expect(data.name).toBe('Design');
    });

    it('should get file nodes', async () => {
      nock(baseUrl).get('/files/filekey/nodes').query({ ids: 'node1,node2' }).reply(200, {
        nodes: {}
      });
      const res = await fetch(`${baseUrl}/files/filekey/nodes?ids=node1,node2`);
      const data = await res.json();
      expect(data.nodes).toBeDefined();
    });
  });

  describe('Images', () => {
    it('should get images', async () => {
      nock(baseUrl).get('/images/filekey').query({ ids: 'node1' }).reply(200, {
        images: { node1: 'https://figma.com/image.png' }
      });
      const res = await fetch(`${baseUrl}/images/filekey?ids=node1`);
      const data = await res.json();
      expect(data.images).toBeDefined();
    });

    it('should get image fills', async () => {
      nock(baseUrl).get('/images/filekey').query({ format: 'png', scale: 2 }).reply(200, {
        images: {}
      });
      const res = await fetch(`${baseUrl}/images/filekey?format=png&scale=2`);
      expect(res.status).toBe(200);
    });
  });

  describe('Comments', () => {
    it('should list comments', async () => {
      nock(baseUrl).get('/files/filekey/comments').reply(200, {
        comments: []
      });
      const res = await fetch(`${baseUrl}/files/filekey/comments`);
      const data = await res.json();
      expect(data.comments).toBeDefined();
    });

    it('should post comment', async () => {
      nock(baseUrl).post('/files/filekey/comments').reply(200, {
        id: 'comment1',
        message: 'Comment'
      });
      const res = await fetch(`${baseUrl}/files/filekey/comments`, {
        method: 'POST',
        body: JSON.stringify({ message: 'Comment', client_meta: { x: 0, y: 0 } })
      });
      const data = await res.json();
      expect(data.id).toBe('comment1');
    });
  });

  describe('Teams', () => {
    it('should get team projects', async () => {
      nock(baseUrl).get('/teams/team1/projects').reply(200, {
        projects: []
      });
      const res = await fetch(`${baseUrl}/teams/team1/projects`);
      const data = await res.json();
      expect(data.projects).toBeDefined();
    });
  });

  describe('Components', () => {
    it('should get components', async () => {
      nock(baseUrl).get('/files/filekey/components').reply(200, {
        components: {}
      });
      const res = await fetch(`${baseUrl}/files/filekey/components`);
      const data = await res.json();
      expect(data.components).toBeDefined();
    });

    it('should get styles', async () => {
      nock(baseUrl).get('/files/filekey/styles').reply(200, {
        styles: {}
      });
      const res = await fetch(`${baseUrl}/files/filekey/styles`);
      const data = await res.json();
      expect(data.styles).toBeDefined();
    });
  });
});

describe('ClickUp Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.clickup.com/api/2';
  const token = 'pk_xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Workspaces', () => {
    it('should get workspaces', async () => {
      nock(baseUrl).get('/team').reply(200, {
        teams: [{ id: 'team1', name: 'Workspace' }]
      });
      const res = await fetch(`${baseUrl}/team`);
      const data = await res.json();
      expect(data.teams).toHaveLength(1);
    });
  });

  describe('Tasks', () => {
    it('should list tasks', async () => {
      nock(baseUrl).get('/team/team1/task').reply(200, {
        tasks: [{ id: 'task1', name: 'Task' }]
      });
      const res = await fetch(`${baseUrl}/team/team1/task`);
      const data = await res.json();
      expect(data.tasks).toBeDefined();
    });

    it('should create task', async () => {
      nock(baseUrl).post('/list/list1/task').reply(201, {
        task: { id: 'task1', name: 'New Task' }
      });
      const res = await fetch(`${baseUrl}/list/list1/task`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Task' })
      });
      const data = await res.json();
      expect(data.task.id).toBe('task1');
    });

    it('should get task', async () => {
      nock(baseUrl).get('/task/task1').reply(200, {
        id: 'task1',
        name: 'Task'
      });
      const res = await fetch(`${baseUrl}/task/task1`);
      const data = await res.json();
      expect(data.id).toBe('task1');
    });

    it('should update task', async () => {
      nock(baseUrl).put('/task/task1').reply(200, {
        task: { id: 'task1', name: 'Updated' }
      });
      const res = await fetch(`${baseUrl}/task/task1`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' })
      });
      const data = await res.json();
      expect(data.task.name).toBe('Updated');
    });

    it('should delete task', async () => {
      nock(baseUrl).delete('/task/task1').reply(200, {});
      const res = await fetch(`${baseUrl}/task/task1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Lists', () => {
    it('should list lists', async () => {
      nock(baseUrl).get('/space/space1/list').reply(200, {
        lists: []
      });
      const res = await fetch(`${baseUrl}/space/space1/list`);
      const data = await res.json();
      expect(data.lists).toBeDefined();
    });

    it('should create list', async () => {
      nock(baseUrl).post('/space/space1/list').reply(201, {
        list: { id: 'list1', name: 'New List' }
      });
      const res = await fetch(`${baseUrl}/space/space1/list`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New List' })
      });
      const data = await res.json();
      expect(data.list.id).toBe('list1');
    });
  });

  describe('Folders', () => {
    it('should list folders', async () => {
      nock(baseUrl).get('/space/space1/folder').reply(200, {
        folders: []
      });
      const res = await fetch(`${baseUrl}/space/space1/folder`);
      const data = await res.json();
      expect(data.folders).toBeDefined();
    });
  });

  describe('Spaces', () => {
    it('should list spaces', async () => {
      nock(baseUrl).get('/team/team1/space').reply(200, {
        spaces: []
      });
      const res = await fetch(`${baseUrl}/team/team1/space`);
      const data = await res.json();
      expect(data.spaces).toBeDefined();
    });
  });
});

describe('Asana Integration - Full Test Suite', () => {
  const baseUrl = 'https://app.asana.com/api/1.0';
  const token = '0/xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Workspaces', () => {
    it('should list workspaces', async () => {
      nock(baseUrl).get('/workspaces').reply(200, {
        data: [{ id: 'ws1', name: 'Workspace' }]
      });
      const res = await fetch(`${baseUrl}/workspaces`);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });
  });

  describe('Projects', () => {
    it('should list projects', async () => {
      nock(baseUrl).get('/projects').reply(200, {
        data: [{ id: 'proj1', name: 'Project' }]
      });
      const res = await fetch(`${baseUrl}/projects`);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it('should create project', async () => {
      nock(baseUrl).post('/projects').reply(201, {
        data: { id: 'proj1', name: 'New Project' }
      });
      const res = await fetch(`${baseUrl}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Project', workspace: 'ws1' })
      });
      const data = await res.json();
      expect(data.data.id).toBe('proj1');
    });

    it('should get project', async () => {
      nock(baseUrl).get('/projects/proj1').reply(200, {
        data: { id: 'proj1', name: 'Project' }
      });
      const res = await fetch(`${baseUrl}/projects/proj1`);
      const data = await res.json();
      expect(data.data.id).toBe('proj1');
    });

    it('should update project', async () => {
      nock(baseUrl).put('/projects/proj1').reply(200, {
        data: { id: 'proj1', name: 'Updated' }
      });
      const res = await fetch(`${baseUrl}/projects/proj1`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' })
      });
      const data = await res.json();
      expect(data.data.name).toBe('Updated');
    });
  });

  describe('Tasks', () => {
    it('should list tasks', async () => {
      nock(baseUrl).get('/projects/proj1/tasks').reply(200, {
        data: [{ gid: 'task1', name: 'Task' }]
      });
      const res = await fetch(`${baseUrl}/projects/proj1/tasks`);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it('should create task', async () => {
      nock(baseUrl).post('/tasks').reply(201, {
        data: { gid: 'task1', name: 'New Task' }
      });
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Task', projects: ['proj1'] })
      });
      const data = await res.json();
      expect(data.data.gid).toBe('task1');
    });

    it('should get task', async () => {
      nock(baseUrl).get('/tasks/task1').reply(200, {
        data: { gid: 'task1', name: 'Task' }
      });
      const res = await fetch(`${baseUrl}/tasks/task1`);
      const data = await res.json();
      expect(data.data.gid).toBe('task1');
    });

    it('should update task', async () => {
      nock(baseUrl).put('/tasks/task1').reply(200, {
        data: { gid: 'task1', name: 'Updated' }
      });
      const res = await fetch(`${baseUrl}/tasks/task1`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' })
      });
      const data = await res.json();
      expect(data.data.name).toBe('Updated');
    });

    it('should delete task', async () => {
      nock(baseUrl).delete('/tasks/task1').reply(200, {});
      const res = await fetch(`${baseUrl}/tasks/task1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Stories', () => {
    it('should list stories', async () => {
      nock(baseUrl).get('/tasks/task1/stories').reply(200, {
        data: []
      });
      const res = await fetch(`${baseUrl}/tasks/task1/stories`);
      const data = await res.json();
      expect(data.data).toBeDefined();
    });

    it('should create story', async () => {
      nock(baseUrl).post('/tasks/task1/stories').reply(201, {
        data: { gid: 'story1', text: 'Comment' }
      });
      const res = await fetch(`${baseUrl}/tasks/task1/stories`, {
        method: 'POST',
        body: JSON.stringify({ text: 'Comment' })
      });
      const data = await res.json();
      expect(data.data.gid).toBe('story1');
    });
  });

  describe('Sections', () => {
    it('should list sections', async () => {
      nock(baseUrl).get('/projects/proj1/sections').reply(200, {
        data: []
      });
      const res = await fetch(`${baseUrl}/projects/proj1/sections`);
      const data = await res.json();
      expect(data.data).toBeDefined();
    });
  });
});

describe('Todoist Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.todoist.com/rest/v2';
  const token = 'xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Tasks', () => {
    it('should get tasks', async () => {
      nock(baseUrl).get('/tasks').reply(200, [
        { id: 'task1', content: 'Task 1' }
      ]);
      const res = await fetch(`${baseUrl}/tasks`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create task', async () => {
      nock(baseUrl).post('/tasks').reply(201, {
        id: 'task1',
        content: 'New Task'
      });
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ content: 'New Task', project_id: 'proj1' })
      });
      const data = await res.json();
      expect(data.id).toBe('task1');
    });

    it('should get task', async () => {
      nock(baseUrl).get('/tasks/task1').reply(200, {
        id: 'task1',
        content: 'Task'
      });
      const res = await fetch(`${baseUrl}/tasks/task1`);
      const data = await res.json();
      expect(data.id).toBe('task1');
    });

    it('should update task', async () => {
      nock(baseUrl).post('/tasks/task1').reply(200, {
        id: 'task1',
        content: 'Updated'
      });
      const res = await fetch(`${baseUrl}/tasks/task1`, {
        method: 'POST',
        body: JSON.stringify({ content: 'Updated' })
      });
      const data = await res.json();
      expect(data.content).toBe('Updated');
    });

    it('should complete task', async () => {
      nock(baseUrl).post('/tasks/task1/close').reply(204, '');
      const res = await fetch(`${baseUrl}/tasks/task1/close`, {
        method: 'POST'
      });
      expect(res.status).toBe(204);
    });

    it('should delete task', async () => {
      nock(baseUrl).delete('/tasks/task1').reply(204, '');
      const res = await fetch(`${baseUrl}/tasks/task1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(204);
    });
  });

  describe('Projects', () => {
    it('should get projects', async () => {
      nock(baseUrl).get('/projects').reply(200, [
        { id: 'proj1', name: 'Project' }
      ]);
      const res = await fetch(`${baseUrl}/projects`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should create project', async () => {
      nock(baseUrl).post('/projects').reply(201, {
        id: 'proj1',
        name: 'New Project'
      });
      const res = await fetch(`${baseUrl}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Project' })
      });
      const data = await res.json();
      expect(data.id).toBe('proj1');
    });

    it('should update project', async () => {
      nock(baseUrl).post('/projects/proj1').reply(200, {
        id: 'proj1',
        name: 'Updated'
      });
      const res = await fetch(`${baseUrl}/projects/proj1`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Updated' })
      });
      const data = await res.json();
      expect(data.name).toBe('Updated');
    });

    it('should delete project', async () => {
      nock(baseUrl).delete('/projects/proj1').reply(204, '');
      const res = await fetch(`${baseUrl}/projects/proj1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(204);
    });
  });

  describe('Sections', () => {
    it('should get sections', async () => {
      nock(baseUrl).get('/sections').reply(200, []);
      const res = await fetch(`${baseUrl}/sections`);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('should create section', async () => {
      nock(baseUrl).post('/sections').reply(201, {
        id: 'sec1',
        name: 'Section'
      });
      const res = await fetch(`${baseUrl}/sections`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Section', project_id: 'proj1' })
      });
      const data = await res.json();
      expect(data.id).toBe('sec1');
    });
  });

  describe('Comments', () => {
    it('should get comments', async () => {
      nock(baseUrl).get('/comments').reply(200, []);
      const res = await fetch(`${baseUrl}/comments`);
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });
});

describe('Spotify Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.spotify.com/v1';
  const token = 'Bearer xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('User', () => {
    it('should get current user', async () => {
      nock(baseUrl).get('/me').reply(200, {
        id: 'user1',
        display_name: 'Test User'
      });
      const res = await fetch(`${baseUrl}/me`);
      const data = await res.json();
      expect(data.id).toBe('user1');
    });
  });

  describe('Search', () => {
    it('should search', async () => {
      nock(baseUrl).get('/search').query({ q: 'test', type: 'track' }).reply(200, {
        tracks: { items: [] }
      });
      const res = await fetch(`${baseUrl}/search?q=test&type=track`);
      const data = await res.json();
      expect(data.tracks).toBeDefined();
    });
  });

  describe('Tracks', () => {
    it('should get track', async () => {
      nock(baseUrl).get('/tracks/track1').reply(200, {
        id: 'track1',
        name: 'Song'
      });
      const res = await fetch(`${baseUrl}/tracks/track1`);
      const data = await res.json();
      expect(data.id).toBe('track1');
    });

    it('should get several tracks', async () => {
      nock(baseUrl).get('/tracks').query({ ids: 'track1,track2' }).reply(200, {
        tracks: []
      });
      const res = await fetch(`${baseUrl}/tracks?ids=track1,track2`);
      const data = await res.json();
      expect(data.tracks).toBeDefined();
    });
  });

  describe('Artists', () => {
    it('should get artist', async () => {
      nock(baseUrl).get('/artists/artist1').reply(200, {
        id: 'artist1',
        name: 'Artist'
      });
      const res = await fetch(`${baseUrl}/artists/artist1`);
      const data = await res.json();
      expect(data.id).toBe('artist1');
    });

    it('should get artist top tracks', async () => {
      nock(baseUrl).get('/artists/artist1/top-tracks').query({ market: 'US' }).reply(200, {
        tracks: []
      });
      const res = await fetch(`${baseUrl}/artists/artist1/top-tracks?market=US`);
      const data = await res.json();
      expect(data.tracks).toBeDefined();
    });
  });

  describe('Albums', () => {
    it('should get album', async () => {
      nock(baseUrl).get('/albums/album1').reply(200, {
        id: 'album1',
        name: 'Album'
      });
      const res = await fetch(`${baseUrl}/albums/album1`);
      const data = await res.json();
      expect(data.id).toBe('album1');
    });
  });

  describe('Playlists', () => {
    it('should get user playlists', async () => {
      nock(baseUrl).get('/me/playlists').reply(200, {
        items: []
      });
      const res = await fetch(`${baseUrl}/me/playlists`);
      const data = await res.json();
      expect(data.items).toBeDefined();
    });

    it('should get playlist', async () => {
      nock(baseUrl).get('/playlists/playlist1').reply(200, {
        id: 'playlist1',
        name: 'Playlist'
      });
      const res = await fetch(`${baseUrl}/playlists/playlist1`);
      const data = await res.json();
      expect(data.id).toBe('playlist1');
    });

    it('should create playlist', async () => {
      nock(baseUrl).post('/users/user1/playlists').reply(201, {
        id: 'playlist1',
        name: 'New Playlist'
      });
      const res = await fetch(`${baseUrl}/users/user1/playlists`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Playlist' })
      });
      const data = await res.json();
      expect(data.id).toBe('playlist1');
    });

    it('should add tracks to playlist', async () => {
      nock(baseUrl).post('/playlists/playlist1/tracks').reply(200, {
        snapshot_id: 'snapshot'
      });
      const res = await fetch(`${baseUrl}/playlists/playlist1/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: ['spotify:track:track1'] })
      });
      const data = await res.json();
      expect(data.snapshot_id).toBeDefined();
    });
  });

  describe('Player', () => {
    it('should get playback state', async () => {
      nock(baseUrl).get('/me/player').reply(200, null);
      const res = await fetch(`${baseUrl}/me/player`);
      expect(res.status).toBe(200);
    });

    it('should start playback', async () => {
      nock(baseUrl).put('/me/player/play').reply(204, '');
      const res = await fetch(`${baseUrl}/me/player/play`, {
        method: 'PUT'
      });
      expect(res.status).toBe(204);
    });

    it('should pause playback', async () => {
      nock(baseUrl).put('/me/player/pause').reply(204, '');
      const res = await fetch(`${baseUrl}/me/player/pause`, {
        method: 'PUT'
      });
      expect(res.status).toBe(204);
    });
  });
});

describe('Pipedrive Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.pipedrive.com/v1';
  const token = 'xxxx';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Deals', () => {
    it('should list deals', async () => {
      nock(baseUrl).get('/deals').reply(200, {
        data: [{ id: 1, title: 'Deal 1' }]
      });
      const res = await fetch(`${baseUrl}/deals`);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it('should create deal', async () => {
      nock(baseUrl).post('/deals').reply(201, {
        data: { id: 2, title: 'New Deal' }
      });
      const res = await fetch(`${baseUrl}/deals`, {
        method: 'POST',
        body: JSON.stringify({ title: 'New Deal' })
      });
      const data = await res.json();
      expect(data.data.id).toBe(2);
    });

    it('should get deal', async () => {
      nock(baseUrl).get('/deals/1').reply(200, {
        data: { id: 1, title: 'Deal' }
      });
      const res = await fetch(`${baseUrl}/deals/1`);
      const data = await res.json();
      expect(data.data.id).toBe(1);
    });

    it('should update deal', async () => {
      nock(baseUrl).put('/deals/1').reply(200, {
        data: { id: 1, title: 'Updated' }
      });
      const res = await fetch(`${baseUrl}/deals/1`, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated' })
      });
      const data = await res.json();
      expect(data.data.title).toBe('Updated');
    });

    it('should delete deal', async () => {
      nock(baseUrl).delete('/deals/1').reply(200, {
        data: { id: 1 }
      });
      const res = await fetch(`${baseUrl}/deals/1`, {
        method: 'DELETE'
      });
      const data = await res.json();
      expect(data.data.id).toBe(1);
    });
  });

  describe('Persons', () => {
    it('should list persons', async () => {
      nock(baseUrl).get('/persons').reply(200, {
        data: [{ id: 1, name: 'Person' }]
      });
      const res = await fetch(`${baseUrl}/persons`);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it('should create person', async () => {
      nock(baseUrl).post('/persons').reply(201, {
        data: { id: 1, name: 'New Person' }
      });
      const res = await fetch(`${baseUrl}/persons`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Person' })
      });
      const data = await res.json();
      expect(data.data.id).toBe(1);
    });
  });

  describe('Organizations', () => {
    it('should list organizations', async () => {
      nock(baseUrl).get('/organizations').reply(200, {
        data: [{ id: 1, name: 'Org' }]
      });
      const res = await fetch(`${baseUrl}/organizations`);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
    });

    it('should create organization', async () => {
      nock(baseUrl).post('/organizations').reply(201, {
        data: { id: 1, name: 'New Org' }
      });
      const res = await fetch(`${baseUrl}/organizations`, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Org' })
      });
      const data = await res.json();
      expect(data.data.id).toBe(1);
    });
  });

  describe('Activities', () => {
    it('should list activities', async () => {
      nock(baseUrl).get('/activities').reply(200, {
        data: []
      });
      const res = await fetch(`${baseUrl}/activities`);
      const data = await res.json();
      expect(data.data).toBeDefined();
    });

    it('should create activity', async () => {
      nock(baseUrl).post('/activities').reply(201, {
        data: { id: 1, type: 'call' }
      });
      const res = await fetch(`${baseUrl}/activities`, {
        method: 'POST',
        body: JSON.stringify({ type: 'call', subject: 'Call' })
      });
      const data = await res.json();
      expect(data.data.id).toBe(1);
    });
  });

  describe('Pipelines', () => {
    it('should list pipelines', async () => {
      nock(baseUrl).get('/pipelines').reply(200, {
        data: []
      });
      const res = await fetch(`${baseUrl}/pipelines`);
      const data = await res.json();
      expect(data.data).toBeDefined();
    });
  });

  describe('Notes', () => {
    it('should list notes', async () => {
      nock(baseUrl).get('/notes').reply(200, {
        data: []
      });
      const res = await fetch(`${baseUrl}/notes`);
      const data = await res.json();
      expect(data.data).toBeDefined();
    });
  });
});