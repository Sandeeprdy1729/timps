#!/usr/bin/env bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
cat << "EOF"
████████╗██╗███╗   ███╗██████╗ ███████╗
╚══██╔══╝██║████╗ ████║██╔══██╗██╔════╝
   ██║   ██║██╔████╔██║██████╔╝███████╗
   ██║   ██║██║╚██╔╝██║██╔═══╝ ╚════██║
   ██║   ██║██║ ╚═╝ ██║██║     ███████║
   ╚═╝   ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝
EOF

echo -e "${BLUE}Trustworthy Intelligent Memory & Privacy System${NC}"
echo "=================================================="
echo

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 18+ required. Install from https://nodejs.org${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node: $(node -v)${NC}"

# 2. Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker required. Install from https://docker.com${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker detected${NC}"

# 3. Check Ollama
if ! command -v ollama &> /dev/null; then
    echo -e "${BLUE}Ollama not found. Installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install ollama || { echo -e "${RED}❌ Please install Ollama manually: https://ollama.com/download${NC}"; exit 1; }
    elif [[ "$OSTYPE" == "linux"* ]]; then
        curl -fsSL https://ollama.com/install.sh | sh || { echo -e "${RED}❌ Please install Ollama manually: https://ollama.com/download${NC}"; exit 1; }
    else
        echo -e "${RED}❌ Please install Ollama manually: https://ollama.com/download${NC} (unsupported OS)"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Ollama detected: $(ollama --version)${NC}"

# 4. Clone or update TIMPs
if [ -d "timps" ]; then
    echo -e "${BLUE}📂 TIMPs exists. Pulling latest...${NC}"
    cd timps
    git pull origin main 2>/dev/null || git pull
else
    echo -e "${BLUE}📥 Cloning TIMPs...${NC}"
    git clone https://github.com/Sandeeprdy1729/timps.git
    cd timps
fi

# 5. Install dependencies
if [ -f "package.json" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install --prefer-offline --no-audit
fi

# 6. Build the project
if [ -f "package.json" ]; then
    echo -e "${BLUE}🔨 Building...${NC}"
    npm run build || echo -e "${BLUE}ℹ️  Build step skipped${NC}"
fi

# 7. Start Docker containers
# PostgreSQL
if docker ps -a --filter "name=^timps-postgres$" --format '{{.Names}}' | grep -q "^timps-postgres$"; then
    echo -e "${BLUE}🐘 PostgreSQL container exists. Starting...${NC}"
    docker start timps-postgres || true
else
    echo -e "${BLUE}🐘 Creating PostgreSQL container...${NC}"
    docker run -d --name timps-postgres -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sandeep_ai postgres:14
fi

# Qdrant
if docker ps -a --filter "name=^timps-qdrant$" --format '{{.Names}}' | grep -q "^timps-qdrant$"; then
    echo -e "${BLUE}🧠 Qdrant container exists. Starting...${NC}"
    docker start timps-qdrant || true
else
    echo -e "${BLUE}🧠 Creating Qdrant container...${NC}"
    docker run -d --name timps-qdrant -p 6333:6333 qdrant/qdrant
fi

# 8. Start Ollama (if not running)
if ! pgrep -f "ollama" > /dev/null; then
    echo -e "${BLUE}🚀 Starting Ollama...${NC}"
    ollama serve &
    sleep 5
fi

echo
# 9. Print next steps
echo -e "${GREEN}🎉 TIMPs installed successfully!${NC}"
echo
if [ -d "sandeep-ai" ]; then
    echo -e "${BLUE}To start the agent CLI, run:${NC}"
    echo "   cd sandeep-ai"
    echo "   npm run cli -- --user-id 1 --interactive"
else
    echo -e "${RED}Could not find sandeep-ai directory. Please check your repo structure.${NC}"
fi
echo
