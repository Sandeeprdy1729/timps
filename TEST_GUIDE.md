# TIMPS Test Guide

This guide explains how to test all the TIMPS components.

---

## Quick Test Commands

### 1. Build All Packages
```bash
npm run build
```

### 2. Run All Tests
```bash
npm run test
```

### 3. TypeScript Type Check
```bash
npm run typecheck
```

---

## Phase-by-Phase Testing

### Phase 1-3: Core Agent Tests

```bash
# Test TIMPS CLI
cd timps-code
npm run test

# Test hello function
npx ts-node -e "console.log(hello('World'))"

# Run in dev mode
npm run dev
```

**Expected:** CLI starts, accepts commands, and responds

### Phase 4: Integration Tests

```bash
# Test integration base
cd packages/integration-base
npm test

# Test specific integrations
cd packages/integration-tests
npm test -- --grep "GitHub"
npm test -- --grep "Slack"
npm test -- --grep "Stripe"
```

**Expected:** Integration API calls work with mocked responses

### Phase 5: Quality Tests

```bash
# Test memory core
cd packages/memory-core
npm test

# Test validation
cd packages/validation
npm test

# Test cache
cd packages/cache
npm test
```

**Expected:** All unit tests pass

### Phase 6: Marketplace Tests

```bash
# Start marketplace dev server
cd apps/marketplace
npm run dev
```

Open http://localhost:3000 in browser

### Phase 7: Advanced Tests

#### 7.1 Local AI (Rust)
```bash
cd packages/memory-core-rs
cargo test

# Test NAPI bindings
node -e "require('./index.js').project_hash('.')"
```

#### 7.2 Workflow Engine
```bash
cd packages/workflow-engine
npm test

# Test workflow creation
node -e "
const { createWorkflowEngine } = require('./dist/index.js');
const engine = createWorkflowEngine('./.timps/test-workflows');
const wf = engine.createWorkflow({
  name: 'Test Workflow',
  enabled: true,
  trigger: { type: 'manual', config: {} },
  steps: [{ id: '1', name: 'Test', action: { type: 'notification', config: {} } }]
});
console.log('Workflow created:', wf.id);
engine.destroy();
"
```

#### 7.3 Enterprise
```bash
cd packages/enterprise
npm test

# Test auth endpoints
node -e "
const { createEnterpriseRouter } = require('./dist/index.js');
const app = require('express')();
app.use('/api', createEnterpriseRouter());
console.log('Enterprise routes registered');
"
```

#### 7.4 Code Review Bot
```bash
cd packages/code-review-bot
npm test

# Test webhook handler
node -e "
const { reviewPullRequest, handleWebhook } = require('./src/index.js');
console.log('Bot functions loaded');
"
```

#### 7.5 Mobile App
```bash
cd apps/mobile
npm run dev

# Test on iOS
npm run ios

# Test on Android
npm run android
```

---

## Manual Test Checklist

### Core Functionality
- [ ] `timps` CLI starts
- [ ] TUI (text UI) works with arrow keys
- [ ] Agent loop processes commands
- [ ] Memory saves and loads
- [ ] Integrations connect

### Integrations
- [ ] GitHub: Create issue, merge PR
- [ ] Slack: Send message
- [ ] Stripe: Create payment
- [ ] OpenAI: Generate text

### Workflows
- [ ] Create workflow
- [ ] Run workflow manually
- [ ] Trigger on schedule
- [ ] Send notification

### Enterprise
- [ ] User registration
- [ ] User login
- [ ] Team creation
- [ ] Invite member

### Code Review
- [ ] PR triggers review
- [ ] Security patterns detected
- [ ] Lint issues found

---

## Troubleshooting

### Build Errors
```bash
# Clean and rebuild
npm run clean
npm run build
```

### Test Failures
```bash
# Run specific test
npm test -- --grep "test name"

# Verbose output
npm test -- --verbose
```

### TypeScript Errors
```bash
# Find errors
npm run typecheck 2>&1 | head -50
```

---

## Test Environment Setup

```bash
# Create .env file
cp .env.example .env

# Edit with your API keys
# OPENAI_API_KEY=sk-...
# GITHUB_TOKEN=ghp_...
# etc.
```

---

## Integration Test Credentials

For real integration tests, set these environment variables:

```bash
# GitHub
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo

# OpenAI
OPENAI_API_KEY=sk-xxx

# Slack
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_SIGNING_SECRET=xxx

# Stripe
STRIPE_API_KEY=sk_xxx

# Etc.
```

---

## Running Specific Test Suites

```bash
# Only integration tests
npm run test -- --filter=integration-tests

# Only benchmarks
npm run test -- --filter=benchmarks

# Only e2e tests
npm run test -- --filter=e2e
```

---

## Success Criteria

All tests should pass with:
- ✅ `npm run build` completes without errors
- ✅ `npm run test` shows no failures
- ✅ `npm run typecheck` shows no errors