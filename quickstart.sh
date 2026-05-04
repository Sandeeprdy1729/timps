#!/usr/bin/env bash

set -e

echo "═══════════════════════════════════════════"
echo "     TIMPS — CLI Coding Agent"
echo "     Quick installer"
echo "═══════════════════════════════════════════"

# ---------------------------
# Check Node Version
# ---------------------------
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Install Node 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node 18+ required. Current: $(node -v)"
    exit 1
fi

# ---------------------------
# Check Docker (for optional server)
# ---------------------------
HAS_DOCKER=false
if command -v docker &> /dev/null; then
    HAS_DOCKER=true
fi

echo "✅ Node $(node -v) detected"

# ---------------------------
# Install timps-code CLI
# ---------------------------
echo ""
echo "📦 Installing timps-code CLI from local source..."
(
  cd timps-code
  npm install --silent
  # Build — type errors don't block JS output (noEmitOnError defaults to false)
  npm run build > /dev/null 2>&1 || true
  if [ ! -f "dist/bin/timps.js" ]; then
    echo "❌ Build failed — dist/bin/timps.js not found"
    exit 1
  fi
  npm install -g . --force --silent
)

echo ""
echo "✅ timps installed! Run 'timps' in any project directory."
echo ""

# ---------------------------
# Optional: start the full server
# ---------------------------
if [ "$HAS_DOCKER" = true ]; then
    echo "Docker detected. Do you want to start the full TIMPS server?"
    echo "(Enables persistent memory across sessions — recommended)"
    read -p "Start server? [Y/n] " REPLY
    REPLY=${REPLY:-Y}
    if [[ "$REPLY" =~ ^[Yy] ]]; then
        echo ""
        echo "🚀 Starting Postgres + Qdrant + TIMPS server..."
        docker compose up -d
        echo ""
        echo "✅ Server running at http://localhost:3000"
        echo ""
        echo "Add to your .env:"
        echo "  TIMPS_SERVER_URL=http://localhost:3000"
    fi
fi

echo ""
echo "════════════════════════════════════════"
echo "  Run 'timps' in any project to start!"
echo "════════════════════════════════════════"