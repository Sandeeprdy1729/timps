#!/bin/bash
# TIMPS Code Production CLI
# Works on: Linux, macOS, WSL2

set -e

VERSION="2.0.0"
TIMPS_DIR="$HOME/.timps"
BIN_DIR="$HOME/.local/bin"
PACKAGE="@timps-ai/timps-code"

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

# Install from npm
INSTALLED=false
if command -v timps &> /dev/null; then
  echo -e "${GREEN}✓${NC} TIMPS CLI already installed"
  INSTALLED=true
else
  echo "Installing $PACKAGE..."
  if npm install -g "$PACKAGE"; then
    INSTALLED=true
    echo -e "${GREEN}✓${NC} Installed $PACKAGE"
  else
    echo -e "${RED}❌ Failed to install $PACKAGE${NC}"
    echo "You may need to run: sudo npm install -g $PACKAGE"
  fi
fi

# Create wrapper only if npm install didn't set up bin correctly
if [[ "$INSTALLED" == "true" ]] && ! command -v timps &> /dev/null; then
  # Find where npm installed the package
  NPM_PREFIX=$(npm prefix -g 2>/dev/null)
  if [[ -f "$NPM_PREFIX/bin/timps" ]]; then
    echo -e "${GREEN}✓${NC} Binary at $NPM_PREFIX/bin/timps"
  elif [[ ! -f "$BIN_DIR/timps" ]]; then
    # Fallback: create wrapper pointing to the actual dist/bin entry point
    mkdir -p "$BIN_DIR"
    # Find the installed package location
    PKG_DIR=$(npm root -g 2>/dev/null)/@timps-ai/timps-code
    if [[ -f "$PKG_DIR/dist/bin/timps.js" ]]; then
      cat > "$BIN_DIR/timps" << WRAPPER
#!/bin/bash
exec node "$PKG_DIR/dist/bin/timps.js" "\$@"
WRAPPER
      chmod +x "$BIN_DIR/timps"
      echo -e "${GREEN}✓${NC} Created wrapper at $BIN_DIR/timps"
    else
      echo -e "${YELLOW}⚠${NC} Could not find $PACKAGE binary. Run 'npm install -g $PACKAGE' manually."
    fi
  fi
fi

# Config file
CONFIG_FILE="$TIMPS_DIR/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" << 'CONFIG'
{
  "defaultProvider": "ollama",
  "defaultModel": "llama3.2:1b",
  "trustLevel": "normal",
  "memoryEnabled": true,
  "ollamaUrl": "http://localhost:11434"
}
CONFIG
  echo -e "${GREEN}✓${NC} Created config at $CONFIG_FILE"
fi

# Add to PATH (only if not already present)
SHELL_RC="$HOME/.bashrc"
if [[ -f "$HOME/.zshrc" ]]; then
  SHELL_RC="$HOME/.zshrc"
fi

PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
if ! grep -qF "$PATH_LINE" "$SHELL_RC" 2>/dev/null; then
  if [[ -d "$BIN_DIR" ]]; then
    echo "$PATH_LINE" >> "$SHELL_RC"
    echo -e "${GREEN}✓${NC} Added to PATH in $SHELL_RC"
  fi
fi

# Final status
echo ""
if [[ "$INSTALLED" == "true" ]] && (command -v timps &> /dev/null || [[ -f "$BIN_DIR/timps" ]]); then
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
else
  echo -e "${RED}⚠ Installation incomplete${NC}"
  echo "Try: npm install -g $PACKAGE"
  exit 1
fi
