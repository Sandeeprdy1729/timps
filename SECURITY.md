# Security Policy

## Supported Versions

| Version | Supported | Notes |
|---------|-----------|-------|
| 1.x | ✅ | Current stable |
| 0.x | ❌ | End of life |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security@timps.dev with details:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any fix suggestions (optional)

3. We aim to respond within 48 hours

4. We coordinate disclosure:
   - Report to security@timps.dev
   - Wait for acknowledgment before disclosing
   - We request 90 days to fix before public disclosure
   - Credit in security advisory (unless requested otherwise)

## Scope

This policy applies to:
- `@timps/core` - Core agent
- `@timps/memory-core` - Memory system
- `@timps/plugin-sdk` - Plugin development
- `@timps/timps-desktop` - Desktop application
- All official integrations

Out of scope:
- Third-party integrations (report to their maintainers)
- User-created plugins
- Community forks

## Security Principles

1. **Least Privilege** - Plugins run with minimal permissions
2. **Defense in Depth** - Multiple security layers
3. **Fail Secure** - Default deny, explicit allow
4. **Data Minimization** - Only collect necessary data

## Data Handling

- **In Transit:** All API calls use HTTPS/TLS 1.3
- **At Rest:** Sensitive data encrypted
- **Memory:** Credentials cleared after use

## Authorization

- OAuth tokens stored securely (keychain/credential manager)
- API keys encrypted
- Webhook secrets validated

## Known Issues

See [Security Advisories](https://github.com/Sandeeprdy1729/timps/security/advisories) for past disclosures.

## Attribution

Thanks to security researchers who have helped improve TIMPS:
- (Your name here)