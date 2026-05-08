---
sidebar_position: 3
---

# Integrations

TIMPS seamlessly connects with 50+ popular services to enhance your workflow.

## Categories

- [Communication](#communication)
- [Developer Tools](#developer-tools)
- [Productivity](#productivity)
- [DevOps](#devops)
- [Analytics](#analytics)
- [CRM](#crm)
- [Design](#design)
- [Finance](#finance)

## Quick Setup

```bash
# Connect an integration
timps connect <service>

# Check connection status
timps integrations status

# Disconnect an integration
timps disconnect <service>
```

## Environment Variables

Each integration may require API keys or OAuth credentials:

```env
# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub
GITHUB_TOKEN=

# Slack
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# OpenAI
OPENAI_API_KEY=
```

## Communication

### Slack

Connect Slack for real-time notifications and messaging.

**Authentication:** OAuth 2.0

**Scopes:**
- `channels:read`
- `chat:write`
- `users:read`

**Setup:**
1. Create a Slack app at https://api.slack.com/apps
2. Add OAuth redirect URL
3. Run `timps connect slack`

**Triggers:**
- New message in channel
- User mention
- File shared

### Discord

**Authentication:** Bot Token

**Setup:**
1. Create a Discord application
2. Add bot to server
3. Copy bot token

**Triggers:**
- New message
- Member join
- Voice state changes

### Gmail

**Authentication:** OAuth 2.0 (Gmail API)

**Scopes:**
- `gmail.readonly`
- `gmail.send`

**Triggers:**
- New email received
- Email starred
- Email labeled

### Twilio

**Authentication:** API Key + Secret

**Setup:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

**Triggers:**
- Incoming SMS
- Incoming call
- Voicemail

### Intercom

**Authentication:** OAuth / Access Token

**Triggers:**
- New conversation
- User signup
- Lead created

## Developer Tools

### GitHub

**Authentication:** Personal Access Token / OAuth

**Scopes:**
- `repo`
- `read:user`

**Triggers:**
- Push to repository
- Pull request opened/closed
- Issue created
- Release published

### Notion

**Authentication:** OAuth 2.0

**Triggers:**
- Page created
- Page edited
- Database updated

### Jira

**Authentication:** API Token + Email

**Environment:**
- `JIRA_HOST`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

**Triggers:**
- Issue created
- Issue transitioned
- Comment added

### Linear

**Authentication:** OAuth 2.0

**Triggers:**
- Issue created
- Issue updated
- Cycle started

### Supabase

**Authentication:** Service Key / JWT

**Environment:**
- `SUPABASE_URL`
- `SUPABASE_KEY`

**Triggers:**
- New record inserted
- Record updated
- Record deleted

### OpenAI

**Authentication:** API Key

**Environment:**
- `OPENAI_API_KEY`

**Capabilities:**
- GPT-4 completions
- Embeddings
- Fine-tuning

## Productivity

### Google Calendar

**Authentication:** OAuth 2.0

**Scopes:**
- `calendar.readonly`
- `calendar.events`

**Triggers:**
- Event created
- Event starting soon
- Event updated

### Todoist

**Authentication:** OAuth 2.0

**Triggers:**
- Task created
- Task completed
- Due date approaching

### Notion (see Developer Tools)

### Evernote

**Authentication:** OAuth 1.0

**Triggers:**
- Note created
- Note updated
- Note added to notebook

## DevOps

### Vercel

**Authentication:** OAuth / Deploy Token

**Environment:**
- `VERCEL_TOKEN`

**Triggers:**
- Deployment started
- Deployment ready
- Deployment error

### Cloudflare

**Authentication:** API Token

**Environment:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_EMAIL`

**Triggers:**
- DNS changes
- Zone created
- SSL issues

### Datadog

**Authentication:** API Key

**Environment:**
- `DATADOG_API_KEY`

**Triggers:**
- Alert triggered
- Metric threshold exceeded
- Monitor recovery

### Sentry

**Authentication:** Auth Token

**Environment:**
- `SENTRY_ORG`
- `SENTRY_AUTH_TOKEN`

**Triggers:**
- New error
- Error regressed
- Release deployed

## Analytics

### Mixpanel

**Authentication:** API Secret

**Environment:**
- `MIXPANEL_TOKEN`

**Triggers:**
- New event
- Funnel completed
- Cohort updated

### Hotjar

**Authentication:** API Token

**Environment:**
- `HOTJAR_TOKEN`

**Triggers:**
- New recording
- Feedback submitted
- Heatmap generated

## CRM

### HubSpot

**Authentication:** OAuth 2.0

**Scopes:**
- `crm.objects.contacts`
- `crm.objects.deals`

**Triggers:**
- Contact created
- Deal stage changed
- Form submitted

### Pipedrive

**Authentication:** OAuth 2.0

**Triggers:**
- Deal created
- Deal won
- Activity created

### Salesforce

**Authentication:** OAuth 2.0

**Environment:**
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`

**Triggers:**
- Lead created
- Opportunity updated
- Case created

### Zoho CRM

**Authentication:** OAuth / Token

**Environment:**
- `ZOHO_ORG`
- `ZOHO_ACCESS_TOKEN`

## Design

### Figma

**Authentication:** OAuth 2.0

**Triggers:**
- File updated
- Comment added
- Project published

## Finance

### Stripe

**Authentication:** API Key

**Environment:**
- `STRIPE_SECRET_KEY`

**Triggers:**
- New customer
- Payment succeeded
- Subscription created

### QuickBooks

**Authentication:** OAuth 2.0

**Triggers:**
- Invoice created
- Payment received
- Customer added

## Activity Cards

Each integration shows activity in the TIMPS dashboard:

```typescript
interface ActivityCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
  actionUrl?: string;
  status: 'success' | 'warning' | 'error' | 'info';
  tags: string[];
}
```

## Rate Limits

All integrations respect API rate limits:

| Service | Requests/minute |
|---------|-----------------|
| GitHub | 60 |
| Slack | 60 |
| Google | 60 |
| OpenAI | 3/min (RPM) |

TIMPS automatically handles rate limiting with exponential backoff.