# TIMPS Integration Test Package

This package contains comprehensive integration tests for all supported integrations.

## Supported Integrations

- GitHub
- Slack
- Google Calendar
- Gmail
- Notion
- Jira
- Linear
- Stripe
- OpenAI
- Twilio
- Intercom
- Datadog
- Sentry
- Vercel
- Supabase
- HubSpot
- Figma
- Mixpanel
- Hotjar
- Cloudflare
- Pipedrive
- Salesforce
- Discord
- Airtable
- Trello
- Zoom
- Webflow
- Typeform
- Contentful
- Todoist
- Spotify
- Asana
- ClickUp
- Zendesk
- Freshdesk
- Zoho CRM
- Monday.com
- ServiceNow
- Square
- QuickBooks
- Xero
- Telegram
- WhatsApp Business
- Mailchimp
- ConvertKit

## Running Tests

```bash
# Run all integration tests
npm test

# Run specific integration tests
npm test -- --grep "GitHub"

# Run with coverage
npm run test:coverage
```

## Test Structure

Each integration has:
- Connection tests
- CRUD operation tests
- Error handling tests
- Rate limiting tests
- Webhook tests

## Mock Data

All tests use nock to mock HTTP responses. No actual API calls are made.