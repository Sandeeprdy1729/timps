# TIMPS Troubleshooting Guide

## Common Issues

### Installation Issues

#### "npm install fails"

**Symptoms**: Installation fails with permission errors.

**Solutions**:
1. Use sudo: `sudo npm install -g timps-code`
2. Fix npm permissions: `mkdir ~/.npm-global && npm config set prefix '~/.npm-global'`
3. Use nvm: `nvm install node`

#### "timps command not found"

**Solutions**:
1. Check PATH: `echo $PATH`
2. Add to PATH: `export PATH="$HOME/.npm-global/bin:$PATH"`
3. Reinstall: `npm uninstall -g timps-code && npm install -g timps-code`

### Connection Issues

#### "Cannot connect to integration"

**Symptoms**: Connection timeout or authentication errors.

**Solutions**:
1. Verify credentials: `timps doctor`
2. Check network: `curl https://api.integration.com`
3. Update token: `timps connect integration --token NEW_TOKEN`
4. Check rate limits

#### "Authentication failed"

**Solutions**:
1. Regenerate API token in integration settings
2. Check token permissions
3. Verify OAuth flow if applicable

### Memory Issues

#### "Memory not persisting"

**Symptoms**: Memory cleared on restart.

**Solutions**:
1. Check permissions: `ls -la ~/.timps/`
2. Repair memory: `timps memory repair`
3. Reimport backup: `timps memory import backup.json`

#### "Memory too large"

**Symptoms**: Slow performance or out of memory.

**Solutions**:
1. Clear old sessions: `timps memory --clear-old`
2. Export and compress: `timps memory export | gzip > backup.json.gz`
3. Adjust memory limit in config

### Performance Issues

#### "TIMPS running slowly"

**Solutions**:
1. Check system resources: `top` or `htop`
2. Clear cache: `timps cache clear`
3. Reduce concurrent operations
4. Use lighter model

#### "Timeout errors"

**Solutions**:
1. Increase timeout: `timps run "task" --timeout 300000`
2. Reduce task complexity
3. Check network latency

### Tool Errors

#### "Tool execution failed"

**Solutions**:
1. Check tool permissions
2. Verify arguments
3. Review tool documentation

### API Errors

#### "Rate limit exceeded"

**Solutions**:
1. Wait before retrying
2. Use caching
3. Upgrade to higher tier

#### "Invalid API key"

**Solutions**:
1. Update key: `timps config set api_key NEW_KEY`
2. Generate new token in integration dashboard
3. Verify environment variables

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| E001 | Installation failed | Reinstall with permissions |
| E002 | Invalid config | Check config syntax |
| E003 | Network error | Check connection |
| E004 | Auth failed | Regenerate token |
| E005 | Rate limited | Wait and retry |
| E006 | Timeout | Increase timeout |
| E007 | Memory error | Run `timps doctor` |
| E008 | Tool error | Check tool config |
| E009 | Invalid input | Verify arguments |
| E010 | Unknown error | Report bug |

## Recovery

### Full Reset

```bash
timps doctor --fix
```

### Manual Reset

```bash
# Clear config
rm ~/.timps/config.json

# Clear memory (backup first)
cp -r ~/.timps/memory ~/timps-memory-backup
rm -rf ~/.timps/memory

# Reinstall
npm uninstall -g timps-code
npm install -g timps-code
```

## Debug Mode

Enable debug mode:

```bash
timps --debug run "task"
timps --debug start
```

Logs will show detailed error information.

## Reporting Issues

Include in bug report:
1. Output from `timps doctor`
2. Debug logs: `timps --debug > debug.log 2>&1`
3. Config (redact sensitive data)
4. Steps to reproduce