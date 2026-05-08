# TIMPS CLI Commands

## Core Commands

### `timps start`

Start the TIMPS interactive session.

```bash
timps start                    # Start with default settings
timps start --model gpt-4     # Use specific model
timps start --no-memory      # Disable memory
timps start --verbose        # Verbose output
```

### `timps run`

Execute a task non-interactively.

```bash
timps run "Create a React component for user login"
timps run --file path/to/script.ts
timps run --dry-run           # Preview without execution
```

### `timps chat`

Interactive chat mode.

```bash
timps chat                    # Start chat
timps chat --context path    # Use specific context
timps chat --clear         # Clear conversation
```

## Tool Commands

### `timps git`

Git operations.

```bash
timps git status             # Show git status
timps git commit "message"  # Commit changes
timps git push             # Push to remote
timps git pull            # Pull from remote
timps git branch          # Manage branches
timps git log            # Show commit history
```

### `timps file`

File operations.

```bash
timps file read path/file.ts
timps file write path/file.ts --content "content"
timps file list path/
timps file delete path/file.ts
timps file search "query"
```

### `timps shell`

Shell execution.

```bash
timps shell "npm install"
timps shell "npm test" --timeout 60000
timps shell --background "npm run dev"
```

## Memory Commands

### `timps memory`

Memory operations.

```bash
timps memory show           # Show memory
timps memory clear        # Clear memory
timps memory save name    # Save memory snapshot
timps memory load name    # Load memory snapshot
timps memory export      # Export memory
timps memory import      # Import memory
```

## Integration Commands

### `timps connect`

Connect an integration.

```bash
timps connect github --token TOKEN
timps connect slack --token TOKEN
timps connect --list     # List available
```

### `timps integration`

Manage integrations.

```bash
timps integration list
timps integration status
timps integration disconnect NAME
```

## Configuration Commands

### `timps config`

Configuration management.

```bash
timps config show         # Show current config
timps config set KEY VALUE
timps config get KEY
timps config reset      # Reset to defaults
```

## Utility Commands

### `timps doctor`

Diagnose issues.

```bash
timps doctor             # Run diagnostics
timps doctor --fix      # Auto-fix issues
```

### `timps version`

Show version info.

```bash
timps version
timps version --verbose
```

### `timps help`

Show help.

```bash
timps help
timps help COMMAND
```

## Options

### Global Options

| Option | Description |
|--------|-------------|
| `--verbose` | Verbose output |
| `--quiet` | Minimal output |
| `--json` | JSON output |
| `--config` | Config file path |
| `--debug` | Debug mode |

### Environment Variables

| Variable | Description |
|---------|-------------|
| `TIMPS_MODEL` | Default model |
| `TIMPS_API_KEY` | API key |
| `TIMPS_CONFIG` | Config path |

## Examples

### Basic Usage

```bash
# Start interactive session
timps start

# Run a specific task
timps run "Add user authentication to the app"

# Connect integration
timps connect github --token ghp_xxx

# Check memory
timps memory show

# Run diagnostics
timps doctor
```

### Advanced Usage

```bash
# With custom config
timps run --config ~/.timps/custom.json "Task"

# Dry run
timps run "Deploy to production" --dry-run

# Background shell
timps shell "npm run dev" --background

# Search files
timps file search "TODO"
```

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Timeout |
| 4 | Network error |
| 130 | Interrupted |