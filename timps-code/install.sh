#!/bin/bash
# TIMPS Code Production CLI
# Works on: Linux, macOS, WSL2

set -e

VERSION="2.0.0"
TIMPS_DIR="$HOME/.timps"
BIN_DIR="$HOME/.local/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}⚡ TIMPS Code${NC} ${YELLOW}v$VERSION${NC}"
echo "================================="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found${NC}"
  echo "Install from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [[ "$NODE_VER" -lt 18 ]]; then
  echo -e "${RED}❌ Node.js 18+ required${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Create TIMPS directories
mkdir -p "$TIMPS_DIR"/{config,memory,skills,history,logs,profiles,cron,gateway,mcp}

# Check if package is installed
if command -v timps &> /dev/null; then
  echo -e "${GREEN}✓${NC} TIMPS CLI already installed"
else
  # Install from npm or create wrapper
  if npm list timps-code &>/dev/null; then
    echo -e "${GREEN}✓${NC} timps-code package found"
  else
    echo "Installing timps-code..."
    npm install -g timps-code 2>/dev/null || true
  fi
fi

# Create wrapper if needed
if [[ ! -f "$BIN_DIR/timps" ]]; then
  mkdir -p "$BIN_DIR"
  cat > "$BIN_DIR/timps" << 'WRAPPER'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../timps.js" "$@"
WRAPPER
  chmod +x "$BIN_DIR/timps"
fi

# Config file
CONFIG_FILE="$TIMPS_DIR/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" << 'CONFIG'
{
  "defaultProvider": "ollama",
  "defaultModel": "qwen2.5-coder:latest",
  "trustLevel": "normal",
  "memoryEnabled": true,
  "ollamaUrl": "http://localhost:11434"
}
CONFIG
  echo -e "${GREEN}✓${NC} Created config at $CONFIG_FILE"
fi

# Add to PATH
SHELL_RC="$HOME/.bashrc"
if [[ -f "$HOME/.zshrc" ]]; then
  SHELL_RC="$HOME/.zshrc"
fi

if ! grep -q "timps" "$SHELL_RC" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
  echo -e "${GREEN}✓${NC} Added to PATH in $SHELL_RC"
fi

echo ""
echo -e "${GREEN}✅ TIMPS Code installed!${NC}"
echo ""
echo "Quick start:"
echo "  1. Run: source $SHELL_RC"
echo "  2. Run: timps --setup"
echo "  3. Start: timps"
echo ""
echo "Commands:"
echo "  timps --help           Show help"
echo "  timps --setup         Run setup wizard"
echo "  timps --skills list   List skills"
echo "  timps --mcp list     List MCP servers"
echo "  timps --cron list   List scheduled tasks"
echo "  timps --gateway     Start messaging gateway"
echo ""
echo "Docs: https://timps.ai/docs"