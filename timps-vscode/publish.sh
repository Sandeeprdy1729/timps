#!/bin/bash
# publish.sh - One-command publish script for TIMPs VS Code Extension
# Usage: ./publish.sh <your-pat-token>

set -e

echo "🚀 Publishing TIMPs VS Code Extension..."

# Check for PAT
if [ -z "$1" ]; then
    echo "❌ Personal Access Token (PAT) required"
    echo "Usage: ./publish.sh <your-azure-devops-pat>"
    echo ""
    echo "To create a PAT:"
    echo "1. Go to https://dev.azure.com"
    echo "2. Click your profile > Security > Personal Access Tokens"
    echo "3. Create new token with 'Marketplace > Manage' scope"
    exit 1
fi

PAT="$1"
PUBLISHER="sandeeprdy1729"

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Build
echo "🔨 Building extension..."
npm run compile

# Step 3: Package
echo "📦 Packaging extension..."
npx vsce package --allowStarJumps

# Step 4: Publish
echo "🚀 Publishing to marketplace..."
echo "$PAT" | npx vsce login "$PUBLISHER" --quiet
npx vsce publish

echo ""
echo "✅ Published successfully!"
echo "View at: https://marketplace.visualstudio.com/manage"
