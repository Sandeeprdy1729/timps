#!/usr/bin/env bash

echo "═══════════════════════════════════════════"
echo "     TIMPs - Quickstart Installer"
echo "     Trustworthy Intelligent Memory & Privacy System"
echo "═══════════════════════════════════════════"

# Check Node
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Install Node 18+ first."
    exit
fi

# Check Docker
if ! command -v docker &> /dev/null
then
    echo "❌ Docker is not installed. Install Docker first."
    exit
fi

echo "✅ Node & Docker detected"

echo "🚀 Starting PostgreSQL..."
docker start timps-postgres 2>/dev/null || \
docker run -d \
  --name timps-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=timps \
  postgres:14

echo "🚀 Starting Qdrant..."
docker start timps-qdrant 2>/dev/null || \
docker run -d \
  --name timps-qdrant \
  -p 6333:6333 \
  qdrant/qdrant

echo "🚀 Installing dependencies..."
npm install

echo "🏗️  Building TIMPs..."
npm run build

echo "🔥 Launching TIMPs..."
npm run cli -- --user-id 1 --interactive