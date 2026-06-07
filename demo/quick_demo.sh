#!/usr/bin/env bash
# TIMPS — 2-minute quick demo
# Shows: (1) the benchmark running with real numbers, (2) the CLI with Ollama,
# (3) the MCP server you can plug into Claude Code.
#
# Usage:  bash demo/quick_demo.sh
# Needs:  Node 20+, optional Ollama, optional ANTHROPIC_API_KEY for MCP demo.

set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; CYN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYN}━━━ $* ━━━${NC}"; }
ok()   { echo -e "${GRN}✓${NC} $*"; }
warn() { echo -e "${YEL}!${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*"; exit 1; }

# ─── Step 0: preflight ───
step "0/4  Preflight"
command -v node >/dev/null || die "Node 20+ not found. Install from https://nodejs.org"
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
[ "$NODE_MAJOR" -ge 20 ] || die "Need Node 20+, found $(node --version)"
ok "Node $(node --version)"

# ─── Step 1: build the shared memory engine ───
step "1/4  Build shared memory engine"
if [ ! -d "packages/memory-core/dist" ]; then
  (cd packages/memory-core && npm install --silent && npm run build --silent)
fi
ok "memory-core is built"

# ─── Step 2: run the real benchmark ───
step "2/4  Run the benchmark (real MemoryEngine, no Math.random)"
npx tsx benchmark/index.ts --quick
ok "Benchmark finished — these are the numbers we publish in README.md"

# ─── Step 3: CLI one-shot with Ollama (optional) ───
step "3/4  CLI demo with Ollama (optional — skipped if Ollama not running)"
if curl -s -m 2 http://localhost:11434/api/tags >/dev/null 2>&1; then
  ok "Ollama is running"
  if ! curl -s http://localhost:11434/api/tags | grep -q "qwen2.5-coder"; then
    warn "qwen2.5-coder not pulled yet — pulling now (~5 GB, one-time)"
    ollama pull qwen2.5-coder:7b
  fi
  if [ ! -d "timps-code/node_modules" ]; then
    (cd timps-code && npm install --silent)
  fi
  if [ ! -d "timps-code/dist" ]; then
    (cd timps-code && npm run build --silent)
  fi
  ok "Demo: storing a decision into memory"
  npx tsx timps-code/src/bin/timps.ts "Remember: we use PostgreSQL for the auth database" || true
  ok "Demo: asking the contradicting question"
  npx tsx timps-code/src/bin/timps.ts "Why don't we use MySQL for the auth database?" || true
  echo -e "${YEL}Tip:${NC} run 'timps /memory' to see what was stored, or 'timps /contradictions' to see stored positions."
else
  warn "Ollama not running on :11434 — skipping CLI demo."
  echo "  Install: brew install ollama && ollama serve & ollama pull qwen2.5-coder:7b"
fi

# ─── Step 4: plug into Claude Code via MCP ───
step "4/4  Plug TIMPS into Claude Code (optional — needs npm install of timps-mcp)"
if command -v timps-mcp >/dev/null 2>&1; then
  ok "timps-mcp is installed globally"
else
  if [ -f "timps-mcp/package.json" ]; then
    (cd timps-mcp && npm install --silent && npm run build --silent && npm link --silent)
    ok "timps-mcp is now installed and linked"
  else
    warn "timps-mcp/ not found in this checkout — skipping"
  fi
fi

if command -v timps-mcp >/dev/null 2>&1; then
  CLAUDE_CFG="$HOME/.claude.json"
  echo -e "${YEL}Add this block to ${CLAUDE_CFG}:${NC}"
  cat <<'JSON'

{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp",
      "env": { "TIMPS_URL": "http://localhost:3000" }
    }
  }
}

JSON
  echo -e "${YEL}Then in Claude Code, try:${NC}"
  echo "  > use mcp__timps__contradiction_check on 'we use MySQL' against my memory"
fi

echo
ok "Demo complete. Total time: $SECONDS seconds."
echo -e "Next: ${CYN}bash demo/screen_record_tutorial.sh${NC} (after installing VHS via 'brew install vhs')"
