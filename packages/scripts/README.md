# TIMPS Development Tools

Collection of development scripts and utilities.

## Usage

```bash
# Install all dependencies
npm run install:all

# Run tests with coverage
npm run test:coverage

# Start development with watch mode
npm run dev:watch

# Build all packages
npm run build

# Release new version
npm run release:patch
```

## Docker

```bash
# Build and run
npm run docker:build
npm run docker:run

# Using docker-compose
npm run docker:compose
```

## Scripts

- `dev` - Start TIMPS in development
- `test` - Run unit tests
- `test:e2e` - Run end-to-end tests
- `lint` - Lint source code
- `typecheck` - TypeScript type checking
- `build` - Build TypeScript
- `benchmark` - Run benchmarks