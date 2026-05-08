# TIMPS Package Manifest

## Core Packages

### @timps/core
- Main TIMPS engine
- Agent loop implementation
- Tool orchestration
- Session management

### @timps/memory
- Working memory (in-memory)
- Episodic memory (session history)
- Semantic memory (persistent knowledge)
- Memory search

### @timps/tools
- File operations
- Git operations
- Shell execution
- Web search
- Custom tool registration

### @timps/integrations
- GitHub
- Slack
- Linear
- Notion
- And 50+ more

### @timps/agents
- Coder agent
- Planner agent
- Verifier agent

## Supporting Packages

### @timps/logger
- Structured logging
- Log levels
- Log formatting
- Log rotation

### @timps/config
- Configuration management
- Environment variables
- Config validation
- Profiles

### @timps/cache
- In-memory cache
- Disk cache
- Cache strategies

### @timps/validation
- Schema validation
- Custom validators
- Error handling

### @timps/errors
- Error codes
- Error handling
- Error recovery

### @timps/utils
- Common utilities
- Retry logic
- Rate limiting

### @timps/i18n
- Internationalization
- Translations
- Localization

## MCP Packages

### @timps/mcp-server
- MCP server implementation
- Tool definitions
- Protocol handlers

### @timps/mcp-client
- MCP client
- Connection management

## Desktop Packages

### @timps/desktop
- Desktop application
- TUI components

### @timps/desktop-electron
- Electron integration
- Native features

## VSCode Packages

### @timps/vscode
- VS Code extension
- Sidebar integration

## Documentation

### @timps/docs
- Documentation site
- API reference
- Guides

## Development

### @timps/benchmarks
- Performance benchmarks
- Load tests
- Benchmarks

### @timps/test-utils
- Testing utilities
- Mock helpers

## Dependencies

### Runtime

- Node.js >=18.0
- TypeScript >=5.0

### Development

- Vitest
- ESLint
- Prettier
- Turbo

## Package Structure

```
timps/
├── packages/
│   ├── core/
│   ├── memory/
│   ├── tools/
│   ├── integrations/
│   ├── agents/
│   ├── logger/
│   ├── config/
│   ├── cache/
│   ├── validation/
│   ├── errors/
│   ├── utils/
│   ├── i18n/
│   ├── mcp-server/
│   ├── mcp-client/
│   ├── desktop/
│   ├── docs/
│   └── benchmarks/
├── timps-code/
├── timps-mcp/
└── timps-vscode/
```

## Publishing

```bash
# Build all
npm run build

# Publish
npm publish --access public
```

## Versioning

Semantic versioning: MAJOR.MINOR.PATCH

- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes