# Contributing to TIMPs

Thank you for your interest in contributing to **TIMPs — Trustworthy Interactive Memory Partner System**! Whether you're improving the TUI, adding a new LLM provider, writing tests, or fixing bugs, every contribution is welcome.

This guide walks you through the full contributor lifecycle.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Finding Something to Work On](#finding-something-to-work-on)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Review Process](#review-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

---

## Code of Conduct

By participating in this project, you agree to engage respectfully with fellow contributors and maintainers. We are committed to a welcoming, inclusive environment for everyone.

---

## Getting Started

Before you begin, make sure you have the following installed:

- **Node.js 18+**
- **PostgreSQL 14+**
- **Git**
- **Ollama** (recommended for local LLM) or an **OpenAI / Gemini API key**
- **Docker** (optional, for running Qdrant)
- A **GitHub account**

Familiarity with **TypeScript** and the **command line** will go a long way — TIMPs is a TypeScript-first CLI/TUI system.

---

## Project Structure

All core source lives inside the `sandeep-ai/` directory:

```
sandeep-ai/
├── main.ts                 # CLI entrypoint, --tui routing
├── api/                    # Express REST API handlers
│   ├── routes.ts
│   └── server.ts
├── config/                 # Type-safe environment loading
├── core/                   # AI agent logic (agent, planner, reflection, executor)
├── db/                     # Database layer (PostgreSQL + Qdrant)
├── interfaces/
│   ├── cli.ts              # CLI commands (!blame, !forget, !audit)
│   ├── tui.ts              # Blessed TUI (4-panel layout)
│   └── tuiHandlers.ts      # Reusable command handlers
├── memory/                 # Short-term cache, long-term storage, embedding
├── models/                 # LLM provider adapters (OpenAI, Gemini, Ollama)
├── tools/                  # External tools (file, web search)
├── .env.example            # Environment variable template
├── quickstart.sh           # Automated quickstart script
├── setup.sh                # Full setup script
├── tsconfig.json
└── package.json
```

Understanding `interfaces/`, `models/`, and `memory/` is essential for most feature contributions.

---

## Development Setup

### 1. Fork and Clone

Fork the repo on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/timps.git
cd timps/sandeep-ai
```

Add the upstream remote:

```bash
git remote add upstream https://github.com/Sandeeprdy1729/timps.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example env file and fill in your values:

```bash
cp ../.env.example .env
```

Key variables to set:

```env
PROVIDER=ollama                          # or openai / gemini
OLLAMA_API_URL=http://localhost:11434
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=sandeep_ai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
QDRANT_URL=http://localhost:6333         # optional
```

### 4. Start Required Services

```bash
# PostgreSQL
brew services start postgresql    # macOS
sudo systemctl start postgresql   # Linux

# Ollama (if using local LLM)
ollama serve
ollama pull mistral               # or llama2, neural-chat

# Qdrant (optional — for vector search)
docker run -p 6333:6333 qdrant/qdrant
```

### 5. Initialize the Database

```bash
npm run init-db
```

This creates all required tables: `memories`, `users`, `conversations`, `messages`, `goals`, `preferences`, and `projects`.

### 6. Run TIMPs

```bash
# TUI mode (recommended for development)
npm run tui -- --user-id 1 --username "Dev"

# CLI mode
npm run cli -- --user-id 1 --interactive
```

### 7. Sync Your Fork Before Starting Work

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

---

## Finding Something to Work On

The README lists areas actively needing help — great starting points for contributors:

- **Web UI dashboard** — a browser-based interface for TIMPs
- **Docker Compose setup** — make the full stack easy to spin up in one command
- **Performance optimizations** — reduce latency across the dual-search pipeline
- **Additional LLM providers** — extend beyond OpenAI, Gemini, and Ollama
- **Tool system expansion** — add new tools under `sandeep-ai/tools/`
- **Tests** — the project needs broader test coverage across all modules
- **Documentation** — improve `TUI_README.md`, `QUICKSTART.md`, or inline comments

Check the [Issues](https://github.com/Sandeeprdy1729/timps/issues) tab for open bugs and feature requests. If you want to claim something, leave a comment so others know it's in progress.

---

## Making Changes

### 1. Create a Branch

Never commit directly to `main`. Create a descriptive branch:

```bash
git checkout -b type/short-description
```

Naming conventions:

| Prefix      | Use for                                      |
|-------------|----------------------------------------------|
| `feat/`     | New features (commands, providers, tools)    |
| `fix/`      | Bug fixes                                    |
| `docs/`     | Documentation updates                        |
| `test/`     | Adding or improving tests                    |
| `refactor/` | Code cleanup without behavior changes        |
| `chore/`    | Build config, dependency, tooling changes    |

**Examples:** `feat/add-claude-provider`, `fix/tui-scroll-crash`, `docs/improve-quickstart`

### 2. Code Style

TIMPs is written in **TypeScript 5.5**. Follow these conventions:

- Match the existing module structure — each directory under `sandeep-ai/` has a clear responsibility; keep it that way
- Use strong typing — avoid `any` unless strictly necessary
- New LLM providers go in `models/` and must implement the `baseModel.ts` interface
- New tools go in `tools/` and must implement the `baseTool.ts` interface
- Keep CLI commands (`!blame`, `!forget`, `!audit`) consistent with the existing UX pattern in `interfaces/cli.ts` and `tuiHandlers.ts`
- Avoid adding unnecessary dependencies; open an issue to discuss first

Run the TypeScript compiler to check for errors before committing:

```bash
npx tsc --noEmit
```

---

## Commit Guidelines

TIMPs follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

### Types

| Type       | When to use                                    |
|------------|------------------------------------------------|
| `feat`     | New feature, command, or provider              |
| `fix`      | Bug fix                                        |
| `docs`     | Documentation changes only                    |
| `test`     | Adding or updating tests                       |
| `refactor` | Code restructuring without behavior change     |
| `chore`    | Config, build, or dependency updates           |
| `perf`     | Performance improvement                        |

### Scopes (examples)

`tui`, `cli`, `memory`, `db`, `models`, `tools`, `api`, `config`, `core`

### Examples

```
feat(models): add Claude provider adapter
fix(tui): resolve scroll crash on long memory lists
docs(quickstart): clarify Qdrant as optional
perf(db): add composite index on user_id and project_id
refactor(memory): extract deduplication into shared util
```

### Breaking Changes

```
feat(db)!: rename sandeep_ai database to timps

BREAKING CHANGE: Update POSTGRES_DATABASE in your .env to 'timps'.
```

---

## Testing

> The project currently needs more test coverage — adding tests is one of the highest-value contributions you can make.

### Running Tests

```bash
npm test
```

### Writing Tests

- Place tests mirroring the `sandeep-ai/` structure
- Cover both happy paths and error/edge cases, especially for:
  - Memory storage and retrieval (`memory/`)
  - Dual-search merging and deduplication (`db/`)
  - CLI command parsing (`interfaces/cli.ts`)
  - LLM provider adapters (`models/`)
- For TUI behavior, test the handler logic in `tuiHandlers.ts` rather than the rendered output itself
- Keep tests isolated — no shared mutable state between test cases

---

## Submitting a Pull Request

### 1. Push Your Branch

```bash
git push origin feat/your-branch-name
```

### 2. Open a Pull Request

Go to [github.com/Sandeeprdy1729/timps](https://github.com/Sandeeprdy1729/timps) and open a PR from your branch into `main`.

**Your PR description should include:**

- What the PR does (clear summary)
- Why it's needed (link to related issue using `Closes #123` if applicable)
- How to test it manually
- Terminal output or screenshots for any TUI/CLI changes

### 3. PR Checklist

- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
- [ ] Code follows existing conventions and module boundaries
- [ ] Tests added or updated for changed behavior
- [ ] `.env.example` updated if new environment variables were introduced
- [ ] Documentation updated (`README.md`, `TUI_README.md`, or `QUICKSTART.md`) if behavior changed
- [ ] Commits follow the Conventional Commits format
- [ ] Branch is up to date with `main`

---

## Review Process

After submitting your PR, a maintainer will review it. You may receive feedback requesting changes — this is a normal part of the process, not a rejection. Push new commits to your branch to address feedback; do not close and reopen the PR.

Tips for a smooth review:

- Keep PRs focused — one concern per PR gets reviewed faster
- Be responsive; PRs that go stale may be closed after extended inactivity
- Add comments in the PR if a decision in your code needs context

---

## Reporting Bugs

Found a bug? Open an [issue](https://github.com/Sandeeprdy1729/timps/issues) and include:

- **TIMPs version** (from `package.json` or git tag)
- **Node.js version** (`node --version`)
- **Operating system**
- **LLM provider** and whether you're using TUI or CLI mode
- **Steps to reproduce** — exact commands run
- **Expected vs. actual behavior**
- **Error output or stack trace**

Before filing, check the troubleshooting table in the README — common issues like database connectivity, Ollama not responding, TUI not rendering, and JSON parsing errors are documented there.

---

## Requesting Features

Have an idea? Open a [feature request issue](https://github.com/Sandeeprdy1729/timps/issues) and describe:

- The problem you're trying to solve
- What the feature would look like from the user's perspective (example commands, flags, or interactions)
- Why it would be useful for other TIMPs users

For larger features (e.g. a Web UI dashboard, a new provider integration, a Docker Compose setup), open an issue for discussion before writing any code.

---

## Documentation

Documentation lives in:

- `README.md` — system overview, architecture, commands, configuration, and troubleshooting
- `sandeep-ai/QUICKSTART.md` — 5-minute setup guide
- `sandeep-ai/TUI_README.md` — full TUI reference and keyboard shortcuts

If your change affects how TIMPs is configured, launched, or used, please update the relevant doc file. Documentation-only PRs are always welcome.

---

## Getting Help

- **[GitHub Issues](https://github.com/Sandeeprdy1729/timps/issues)** — bugs, feature requests, and questions
- **[GitHub Discussions](https://github.com/Sandeeprdy1729/timps/discussions)** — general ideas and conversation

We're happy to help you get your contribution across the line. Thanks for contributing to TIMPs!