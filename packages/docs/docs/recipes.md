# TIMPS Recipe: Git Workflow Automation

## Use Case

Automate common Git operations using TIMPS with memory.

## Prerequisites

- TIMPS installed
- Git repository

## Steps

### 1. Setup Integration

```bash
timps connect github --token YOUR_TOKEN
```

### 2. Create Workflow Recipe

```bash
# Create workflow file
timps file write .timps/workflows/git-automation.ts

# Add automation
export const gitWorkflow = {
  name: 'Git Automation',
  triggers: ['on-commit', 'on-pr'],
  steps: [
    {
      name: 'Check formatting',
      tool: 'shell',
      command: 'npm run format --check'
    },
    {
      name: 'Run tests',
      tool: 'shell', 
      command: 'npm test'
    },
    {
      name: 'Build',
      tool: 'shell',
      command: 'npm run build'
    }
  ]
};
```

### 3. Configure Triggers

```yaml
# .github/workflows/timps.yml
name: TIMPS Automation
on: [push, pull_request]
jobs:
  timps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run TIMPS
        run: timps run --trigger ${{ github.event_name }}
```

## Complete Example

```typescript
import { Timps } from '@timps/core';

const timps = new Timps();

async function automateGit() {
  // Connect integrations
  await timps.connect('github');
  
  // Create automation
  const workflow = timps.createWorkflow({
    name: 'git-automation',
    triggers: ['onCommit', 'onPR'],
    steps: [
      // Lint
      {
        name: 'Lint',
        run: 'npm run lint'
      },
      // Test
      {
        name: 'Test',
        run: 'npm test',
        continueOnFailure: false
      },
      // Build
      {
        name: 'Build',
        run: 'npm run build'
      },
      // Commit changes if needed
      {
        name: 'Auto-fix',
        condition: 'lint-changes',
        run: 'npm run lint --fix && git commit -am "fix: lint fixes"'
      }
    ]
  });
  
  // Execute on each push
  await timps.on('push', async () => {
    await workflow.execute();
  });
}

automateGit();
```

## Testing

```bash
# Test workflow
timps run --workflow .timps/workflows/git-automation.ts

# Dry run
timps run --workflow .timps/workflows/git-automation.ts --dry-run
```

## Troubleshooting

- **Timeout**: Increase step timeout
- **Auth errors**: Verify integration tokens
- **Memory errors**: Run `timps doctor`