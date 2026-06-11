# Contributing to TIMPS

Thank you for your interest in contributing to TIMPS!

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Sandeeprdy1729/timps.git
cd timps

# Install dependencies
npm install

# Build packages
npm run build

# Start development
npm run dev
```

## Project Structure

```
timps/
├── timps-code/      # CLI tool
├── timps-mcp/       # MCP server
├── timps-vscode/    # VS Code extension
├── packages/server/     # Full server
└── packages/       # Shared packages
    ├── config/
    ├── memory-core/
    ├── logger/
    └── ...
```

## Making Changes

### Coding Standards

- Use TypeScript with strict mode
- Use ESM imports (.js extension)
- Run `npm run typecheck` before committing
- Run tests with `npm test`

### Commit Message Format

```
type(scope): description

[optional body]
```

Types: feat, fix, docs, style, refactor, test, chore

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific package
cd packages/memory-core && npm test

# Watch mode
npm run test:watch
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
cd packages/memory-core && npm run build

# Clean and build
npm run clean && npm run build
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and typecheck
5. Update CHANGELOG.md
6. Submit PR

## Package Publishing

```bash
# Login to npm
npm login

# Publish
npm publish
```

## Release Process

```bash
# Update version
npm version patch

# Create release
npm run release
```

## Community

- [Discord](https://discord.gg/timps)
- [Twitter](https://twitter.com/timpsai)
- [GitHub Discussions](https://github.com/Sandeeprdy1729/timps/discussions)

## Code of Conduct

Be respectful and inclusive. Follow the [Contributor Covenant](https://www.contributor-covenant.org).