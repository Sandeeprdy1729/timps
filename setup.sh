#!/bin/bash

echo "🚀 TIMPs Setup & Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js detected: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo ""
echo "🎯 Quick Start:"
echo ""
echo "  Interactive CLI (default):"
echo "    npm run cli -- --user-id 1 --interactive"
echo ""
echo "  Premium TUI (new):"
echo "    npm run tui -- --user-id 1"
echo ""
echo "  Ephemeral mode (no memory persistence):"
echo "    npm run cli -- --user-id 1 --interactive --mode ephemeral"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Requirements:"
echo "  • PostgreSQL running on localhost:5432"
echo "  • Ollama running (ollama serve)"
echo "  • .env file configured"
echo ""
echo "🎮 TUI Controls:"
echo "  [Enter]    Send message"
echo "  [Ctrl+L]   Show audit log"
echo "  [Tab]      Switch panels"
echo "  [Ctrl+C]   Exit"
echo ""
echo "🧠 Commands:"
echo "  !blame <keyword>   Search memories"
echo "  !forget <keyword>  Delete memories"
echo "  !audit             Show recent memories"
echo ""
