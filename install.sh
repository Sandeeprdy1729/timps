#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

cat << "BANNER"
 ████████╗██╗███╗   ███╗██████╗ ███████╗
 ╚══██╔══╝██║████╗ ████║██╔══██╗██╔════╝
    ██║   ██║██╔████╔██║██████╔╝███████╗
    ██║   ██║██║╚██╔╝██║██╔═══╝ ╚════██║
    ██║   ██║██║ ╚═╝ ██║██║     ███████║
    ╚═╝   ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝
            v2.0 — 17 Intelligence Tools
BANNER

echo -e "${BLUE}Trustworthy Interactive Memory Partner System${NC}"
echo "=================================================="
echo

# ── 1. Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ Node.js 18+ required. Install from https://nodejs.org${NC}"; exit 1
fi
NODE_VER=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}❌ Node 18+ required. You have $(node -v)${NC}"; exit 1
fi
echo -e "${GREEN}✅ Node: $(node -v)${NC}"

# ── 2. Check Docker ───────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ Docker required. Install from https://docker.com${NC}"; exit 1
fi
echo -e "${GREEN}✅ Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"

# ── 3. Clone or update ───────────────────────────────────────────────────────
if [ -d "timps/.git" ]; then
  echo -e "${BLUE}📂 TIMPs exists. Pulling latest...${NC}"
  cd timps && git pull origin main 2>/dev/null || git pull
else
  echo -e "${BLUE}📥 Cloning TIMPs...${NC}"
  git clone https://github.com/Sandeeprdy1729/timps.git
  cd timps
fi

# ── 4. Start full stack via Docker Compose ───────────────────────────────────
echo -e "${BLUE}🐘 Starting Postgres + Qdrant + TIMPS server...${NC}"
docker compose up -d
echo -e "${GREEN}✅ Stack running${NC}"

# ── 5. Check Ollama for embeddings ───────────────────────────────────────────
if command -v ollama &>/dev/null; then
  echo -e "${BLUE}🦙 Ollama found. Checking nomic-embed-text...${NC}"
  if ! ollama serve &>/dev/null & sleep 2 && ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
    echo -e "${BLUE}   Pulling nomic-embed-text (274MB)...${NC}"
    ollama pull nomic-embed-text
  fi
  echo -e "${GREEN}✅ Ollama + nomic-embed-text ready${NC}"
else
  echo -e "${YELLOW}⚠️  Ollama not found. Embeddings will fall back to SQL search.${NC}"
  echo -e "   Install from: https://ollama.com"
fi

# ── 6. Install timps-code CLI ────────────────────────────────────────────────
echo -e "${BLUE}📦 Installing timps-code CLI...${NC}"
npm install -g timps-code --prefer-offline --no-audit --silent 2>/dev/null || \
npm install -g timps-code --no-audit --silent
echo -e "${GREEN}✅ timps CLI installed${NC}"

# ── 7. Create server .env if missing ─────────────────────────────────────────
if [ ! -f "sandeep-ai/.env" ]; then
  cp sandeep-ai/.env.example sandeep-ai/.env
  echo -e "${YELLOW}⚠️  sandeep-ai/.env created from template.${NC}"
  echo -e "   Ollama is the default — no API key needed."
  echo -e "   Edit sandeep-ai/.env to add cloud provider keys."
fi

# ── 8. Wait for server health ─────────────────────────────────────────────────
echo -e "${BLUE}⏳ Waiting for TIMPS server...${NC}"
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/api/health &>/dev/null; then
    echo -e "${GREEN}✅ Server ready${NC}"
    break
  fi
  sleep 2
done

echo
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  TIMPS installed successfully!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo
echo -e "  ${BLUE}CLI:${NC}             timps  (run in any project folder)"
echo -e "  ${BLUE}Server API:${NC}      http://localhost:3000"
echo -e "  ${BLUE}Dashboard:${NC}       http://localhost:3000/dashboard"
echo -e "  ${BLUE}MCP tools:${NC}       npm install -g timps-mcp"
echo