#!/usr/bin/env bash

set -e

echo "═══════════════════════════════════════════"
echo "     TIMPs - Quickstart Installer"
echo "     Trustworthy Intelligent Memory & Privacy System"
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
    echo "❌ Node 18+ required."
    exit 1
fi

# ---------------------------
# Check Docker
# ---------------------------
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    exit 1
fi

echo "✅ Node & Docker detected"

# ---------------------------
# Start PostgreSQL
# ---------------------------
echo "🚀 Starting PostgreSQL..."

docker start timps-postgres 2>/dev/null || \
docker run -d \
  --name timps-postgres \
  -p 5432:5432 \
  -v timps_postgres_data:/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=timps \
  postgres:14

# Wait for Postgres
echo "⏳ Waiting for PostgreSQL..."
sleep 5

# ---------------------------
# Start Qdrant
# ---------------------------
echo "🚀 Starting Qdrant..."

docker start timps-qdrant 2>/dev/null || \
docker run -d \
  --name timps-qdrant \
  -p 6333:6333 \
  -v timps_qdrant_data:/qdrant/storage \
  qdrant/qdrant

sleep 3

# ---------------------------
# Install dependencies
# ---------------------------
echo "📦 Installing dependencies..."
npm install

# ---------------------------
# Build project
# ---------------------------
echo "🏗️ Building TIMPs..."
npm run build

# ---------------------------
# Launch
# ---------------------------
echo "🔥 Launching TIMPs..."
npm run cli -- --user-id 1 --interactive