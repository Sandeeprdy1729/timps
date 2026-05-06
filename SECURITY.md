# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x (latest) | ✅ Active support |
| 1.x | ⚠️ Security fixes only |
| < 1.0 | ❌ No longer supported |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report security vulnerabilities via email to: **security@timps.ai** (or open a [GitHub Security Advisory](https://github.com/Sandeeprdy1729/timps/security/advisories/new)).

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Affected component (`timps-code`, `timps-mcp`, `timps-vscode`, or `sandeep-ai`)
- Potential impact
- Any suggested mitigations

You can expect:
- Acknowledgement within **48 hours**
- Status update within **7 days**
- A fix or mitigation within **30 days** for critical issues

We credit researchers who responsibly disclose issues in the release notes.

## Security Considerations

### Command execution
`timps-code` executes shell commands on your machine via the `run_bash` tool. By default:
- All shell commands require your explicit approval before running (you will be prompted)
- The agent cannot execute commands silently without your confirmation
- Use `timps --safe-mode` to require approval for every file write as well

### API keys
- TIMPS reads API keys from environment variables or `~/.timps/config.json`
- Config files are stored with `chmod 600` permissions (user-only read)
- Keys are never logged or sent to any TIMPS-controlled server
- When using Ollama (default), no keys are required and no data leaves your machine

### MCP server (`timps-mcp`)
- The MCP server exposes a local socket — it is not designed to be exposed to the internet
- Use a firewall or Docker network to restrict access if running in a shared environment

### Supply chain
- All GitHub Actions workflows pin dependencies to commit SHAs to prevent supply chain attacks
- Dependabot is configured to send weekly PRs for dependency updates
- We run OSV vulnerability scanning on every push

## Dependency Scanning

Automated dependency scanning runs on every push and pull request via the `supply-chain-audit` workflow. Known-vulnerable packages will block merging.
