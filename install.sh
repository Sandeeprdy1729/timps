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

# ── 4. Start Postgres + Qdrant via Docker ─────────────────────────────────────
echo -e "${BLUE}🐘 Starting PostgreSQL...${NC}"
docker start timps-postgres 2>/dev/null || \
docker run -d --name timps-postgres \
  -p 5432:5432 \
  -v timps_postgres_data:/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sandeep_ai \
  postgres:17-alpine
echo -e "${GREEN}✅ PostgreSQL running${NC}"

echo -e "${BLUE}🧠 Starting Qdrant...${NC}"
docker start timps-qdrant 2>/dev/null || \
docker run -d --name timps-qdrant \
  -p 6333:6333 \
  -v timps_qdrant_data:/qdrant/storage \
  qdrant/qdrant
echo -e "${GREEN}✅ Qdrant running${NC}"

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

# ── 6. Install dependencies ───────────────────────────────────────────────────
echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd sandeep-ai && npm install --prefer-offline --no-audit --silent
echo -e "${GREEN}✅ Dependencies installed${NC}"

# ── 7. Create .env if missing ─────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠️  .env created from template.${NC}"
  echo -e "   Add your API key to .env:"
  echo -e "   ${BLUE}OPENROUTER_API_KEY=sk-or-v1-...${NC}  (free at openrouter.ai)"
  echo -e "   ${BLUE}DEFAULT_MODEL_PROVIDER=openrouter${NC}"
fi

# ── 8. Wait for Postgres ──────────────────────────────────────────────────────
echo -e "${BLUE}⏳ Waiting for PostgreSQL to be ready...${NC}"
for i in $(seq 1 15); do
  if docker exec timps-postgres pg_isready -U postgres &>/dev/null; then break; fi
  sleep 1
done

# ── Done ─────────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  TIMPs v1.0 installed successfully!              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo
echo -e "  ${BLUE}Start server:${NC}    npm run server"
echo -e "  ${BLUE}Seed demo data:${NC}  npm run seed"
echo -e "  ${BLUE}Open browser:${NC}    http://localhost:3000"
echo -e "  ${BLUE}Dashboard:${NC}       http://localhost:3000/dashboard"
echo