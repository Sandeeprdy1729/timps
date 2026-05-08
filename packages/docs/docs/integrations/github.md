---
sidebar_position: 20
---

# GitHub Integration

Connect your GitHub repositories to TIMPS for intelligent automation.

## Features

- **Issue Management**: Create, update, and close issues automatically
- **Pull Requests**: Monitor PRs, add reviewers, merge
- **Actions**: Trigger workflows, monitor runs
- **Webhooks**: Real-time event handling

## Authentication

### OAuth 2.0

```bash
timps connect github
```

Navigate to: `https://github.com/settings/connections/applications/`

Callback URL: `https://timps.dev/oauth/github`

## Scopes Required

- `repo` - Full control of private repositories
- `read:user` - Read user profile data
- `workflow` - Update GitHub Actions workflows

## Environment Variables

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your_secret
```

## Triggers

| Event | Action |
|-------|--------|
| `push` | Create commit activity card |
| `issue_opened` | Create issue activity card |
| `pr_opened` | Create PR activity card |
| `release_published` | Create release card |

## Code Examples

```typescript
import { GitHub } from '@timps/integrations';

const github = new GitHub({ token: process.env.GITHUB_TOKEN });

// Create issue
const issue = await github.createIssue({
  owner: 'owner',
  repo: 'repo',
  title: 'Bug: Login fails',
  body: 'Steps to reproduce...',
});

// List PRs
const prs = await github.listPullRequests({
  owner: 'owner',
  repo: 'repo',
  state: 'open',
});
```

## Settings UI

Access settings at: `/settings/integrations/github`

- Repository selection
- Webhook URL configuration
- Default labels
- Auto-merge settings