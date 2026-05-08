# Tutorial: Security Best Practices

This guide covers securing your TIMPS installation.

## Environment Variables

### Use .env Files

```bash
# Create .env
cp .env.example .env

# Protect
chmod 600 .env
chmod 700 .
```

### Sensitive Variables

Never commit these:

```bash
# Add to .gitignore
.env
.env.local
*.pem
*secret*
*credential*
```

## API Keys

### Rotation

```bash
# Rotate keys regularly
export ANTHROPIC_API_KEY=new-key-here
```

### Scoping

Use keys with minimal permissions:

```bash
# GitHub: repo scope only
# AWS: specific resources only
```

## Memory Security

### Encryption

Enable for semantic memory:

```typescript
const agent = createAgent({
  memory: {
    encrypt: true,
    encryptionKey: process.env.MEMORY_KEY,
  },
});
```

### Cleanup

```bash
# Clear sensitive memories
timps memory forget sensitive-pattern

# Clear all
timps memory clear
```

## Network

### Local Only

```bash
# Don't expose to network
timps --host localhost
```

### Proxy

```bash
export HTTP_PROXY=http://proxy:8080
export HTTPS_PROXY=http://proxy:8080
```

## Dependencies

### Audit

```bash
npm audit
```

### Update

```bash
npm update timps-code
```

## Best Practices

1. Use password managers for keys
2. Enable 2FA on connected accounts
3. Review API logs regularly
4. Use read-only tokens where possible