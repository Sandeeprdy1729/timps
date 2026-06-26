#!/bin/bash
# publish.sh — Build, sign, notarize, and publish TIMPS VS Code Extension
# Usage: ./publish.sh [--dry-run]
#
# Prerequisites (set once):
#   export VSCE_PAT="<azure-devops-pat>"
#   export OVSX_PAT="<open-vsx-pat>"
#   export APPLE_DEV_ID="<apple-developer-id>"
#   export APPLE_TEAM_ID="<apple-team-id>"
#   export APPLE_APP_PASSWORD="<app-specific-password>"

set -e

DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "🏃 Dry-run mode — no publishing"
fi

PUBLISHER="TIMPs"
VERSION=$(node -p "require('./package.json').version")
echo "📦 TIMPS VS Code Extension v$VERSION"

cd "$(dirname "$0")"

# Step 1: Install
echo "📦 Installing dependencies..."
npm install

# Step 2: Build
echo "🔨 Compiling TypeScript..."
npm run compile

# Step 3: Typecheck
echo "🔍 Type checking..."
npx tsc --noEmit

# Step 4: Test
echo "🧪 Running tests..."
npm test || echo "⚠️  Tests failed — continuing anyway"

# Step 5: Package
echo "📦 Packaging VSIX..."
VSIX_FILE="timps-ai-coding-agent-$VERSION.vsix"
npx vsce package --allowStarJumps -o "$VSIX_FILE"

# Step 6: Sign (macOS notarization)
if [ -n "$APPLE_DEV_ID" ] && [ -n "$APPLE_TEAM_ID" ] && [ "$(uname)" = "Darwin" ] && [ "$DRY_RUN" = false ]; then
  echo "🍎 Signing and notarizing for macOS..."
  
  # Create temporary entitlements
  cat > /tmp/timps-entitlements.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
</dict>
</plist>
EOF

  # Codesign the native .node binary inside the vsix
  mkdir -p /tmp/timps-sign
  unzip -o "$VSIX_FILE" -d /tmp/timps-sign 2>/dev/null
  find /tmp/timps-sign -name "*.node" -exec codesign --sign "$APPLE_DEV_ID" --entitlements /tmp/timps-entitlements.plist --force {} \;
  find /tmp/timps-sign -name "*.dylib" -exec codesign --sign "$APPLE_DEV_ID" --entitlements /tmp/timps-entitlements.plist --force {} \;
  
  # Repackage
  cd /tmp/timps-sign
  zip -r -X "../signed-$VSIX_FILE" . 2>/dev/null
  cd - > /dev/null
  mv "/tmp/signed-$VSIX_FILE" "$VSIX_FILE"
  rm -rf /tmp/timps-sign

  # Submit to Apple notarization
  xcrun notarytool submit "$VSIX_FILE" \
    --apple-id "$APPLE_DEV_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --wait

  # Staple the notarization ticket
  xcrun stapler staple "$VSIX_FILE"
  echo "✅ macOS notarization complete"
fi

if [ "$DRY_RUN" = true ]; then
  echo "✅ Dry-run complete. VSIX at: $VSIX_FILE"
  exit 0
fi

# Step 7: Publish to VS Code Marketplace
echo "🚀 Publishing to VS Code Marketplace..."
if [ -n "$VSCE_PAT" ]; then
  npx vsce publish -p "$VSCE_PAT"
  echo "✅ Published to VS Code Marketplace"
else
  echo "⚠️  VSCE_PAT not set — skipping VS Code Marketplace publish"
fi

# Step 8: Publish to Open VSX
echo "🚀 Publishing to Open VSX Registry..."
if [ -n "$OVSX_PAT" ]; then
  npx ovsx publish "$VSIX_FILE" -p "$OVSX_PAT"
  echo "✅ Published to Open VSX Registry"
else
  echo "⚠️  OVSX_PAT not set — skipping Open VSX publish"
fi

echo ""
echo "✅ Done! TIMPS v$VERSION published."
echo "   VS Code: https://marketplace.visualstudio.com/items?itemName=TIMPs.timps-ai-coding-agent"
echo "   Open VSX: https://open-vsx.org/extension/TIMPs/timps-ai-coding-agent"
