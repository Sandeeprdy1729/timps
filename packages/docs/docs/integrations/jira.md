---
id: jira
title: Jira Integration
description: Complete guide to integrating TIMPS with Jira for project management and issue tracking.
---

# Jira Integration

TIMPS provides a comprehensive integration with Jira for managing issues, projects, sprints, and development workflows.

## Features

- Create and update Jira issues
- Track sprints and backlog
- Comment on issues
- Manage attachments
- Search with JQL
- Workflow transitions

## Configuration

### Environment Variables

```bash
JIRA_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT=PROJECT_KEY
```

### Connection

```typescript
import { JiraIntegration } from '@timps/integrations';

const jira = new JiraIntegration({
  url: process.env.JIRA_URL,
  user: process.env.JIRA_USER,
  token: process.env.JIRA_API_TOKEN,
  project: process.env.JIRA_PROJECT,
});

await jira.connect();
```

## Usage

### Creating Issues

```typescript
// Create a new issue
const issue = await jira.createIssue({
  summary: 'Implement user authentication',
  description: 'Add OAuth2 login flow',
  issueType: 'Story',
  priority: 'High',
});

console.log(`Created: ${issue.key}`);
```

### Searching Issues

```typescript
// Search with JQL
const issues = await jira.search('assignee = currentUser AND resolution = Unresolved');

for (const issue of issues) {
  console.log(`${issue.key}: ${issue.summary}`);
}
```

### Transitions

```typescript
// Move issue to done
await jira.transition('PROJ-123', 'Done');
```

## Webhooks

Configure webhooks in Jira for real-time updates:

```json
{
  "webhookEvents": ["jira:issue_created", "jira:issue_updated"]
}
```

## Error Handling

```typescript
try {
  await jira.createIssue(data);
} catch (error) {
  if (error.code === '400') {
    console.log('Invalid issue data');
  } else if (error.code === '401') {
    console.log('Authentication failed');
  }
}
```