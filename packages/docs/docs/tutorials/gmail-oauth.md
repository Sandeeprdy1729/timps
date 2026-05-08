# Tutorial: Setting Up OAuth for Gmail

This tutorial shows how to set up Gmail integration with OAuth.

## Prerequisites

1. Google Cloud Project
2. Gmail API enabled

## Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create credentials → OAuth client ID
3. Set redirect URI: `http://localhost:3000/oauth/callback`
4. Download credentials JSON

## Step 2: Configure TIMPS

```bash
# Set environment variables
export GMAIL_CLIENT_ID=your-client-id
export GMAIL_CLIENT_SECRET=your-client-secret
export GMAIL_REDIRECT_URI=http://localhost:3000/oauth/callback
```

## Step 3: Connect

```bash
timps connect gmail
```

This opens browser for OAuth consent.

## Usage

### Send Email

```typescript
await agent.tools.sendEmail({
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Email content',
});
```

### Read Emails

```typescript
const emails = await agent.tools.listEmails({
  maxResults: 10,
});
```

## Security Notes

- Tokens stored encrypted
- Refresh tokens auto-refreshed
- Revoke with `timps disconnect gmail`