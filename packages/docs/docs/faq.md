# TIMPS - Frequently Asked Questions

## General

### What is TIMPS?

TIMPS (The AI Programming System) is an AI coding agent with persistent memory that remembers your codebase, preferences, and workflows across sessions.

### How does TIMPS differ from other AI coding assistants?

TIMPS has a 3-layer memory system that persists knowledge between sessions:
- **Working Memory**: Current session context
- **Episodic Memory**: Session history
- **Semantic Memory**: Persistent knowledge

### What languages does TIMPS support?

TIMPS supports JavaScript, TypeScript, Python, Go, Rust, Ruby, Java, C#, and more.

## Installation

### How do I install TIMPS?

```bash
npm install -g timps-code
# or
brew install timps
```

### What are the requirements?

- Node.js 18+
- npm 9+

### Does TIMPS work on Windows?

Yes, TIMPS works on Windows, macOS, and Linux.

## Configuration

### Where is the config file?

The config file is at `~/.timps/config.json`

### How do I configure an integration?

```bash
timps connect github --token TOKEN
```

Or via config:

```json
{
  "integrations": {
    "github": {
      "token": "YOUR_TOKEN"
    }
  }
}
```

## Usage

### How do I start TIMPS?

```bash
timps start
```

### Can I run TIMPS non-interactively?

Yes:

```bash
timps run "Create a user authentication component"
```

### How do I save memory?

Memory is saved automatically. You can also manually:

```bash
timps memory save my-project
```

### How do I recall previous sessions?

```bash
timps memory load my-project
```

## Integrations

### What integrations are supported?

50+ integrations including:
- GitHub, GitLab, Bitbucket
- Slack, Discord
- Linear, Jira, Asana
- Stripe, PayPal
- Notion, Airtable
- Supabase, Firebase
- And more...

### How do I add a custom integration?

```typescript
const custom = {
  name: 'my-integration',
  baseUrl: 'https://api.example.com',
  auth: async () => ({ token: 'xxx' }),
  api: async (endpoint, params) => { /* implementation */ }
};

timps.register('custom', custom);
```

## Troubleshooting

### TIMPS is running slowly

Try:
- `timps doctor --fix`
- Reduce concurrent operations
- Check network connection

### API errors

Common causes:
- Invalid API token
- Rate limiting
- Network issues

Run diagnostics: `timps doctor`

### Memory issues

If memory seems corrupted:
```bash
timps memory clear
timps memory import backup.json
```

### How do I report bugs?

Create an issue on GitHub or join our Discord.

## Security

### Is my code safe?

TIMPS only accesses files you explicitly allow. No external code execution without permission.

### Where is data stored?

Data is stored locally at `~/.timps/` unless configured otherwise.

### Can I disable telemetry?

Yes:

```json
{
  "telemetry": false
}
```

## Pricing

### Is TIMPS free?

TIMPS has a free tier with basic features. Pro tier includes:
- Unlimited memory
- More integrations
- Priority support

## Getting Help

### Where can I get help?

- [Documentation](https://timps.ai/docs)
- [Discord](https://discord.gg/timps)
- [GitHub Discussions](https://github.com/anomalyco/timps/discussions)