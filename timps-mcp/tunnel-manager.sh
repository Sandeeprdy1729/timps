#!/bin/bash
# TIMPS Tunnel Manager — starts cloudflared, captures URL, auto-updates Worker
# Usage: ./tunnel-manager.sh [port] (default: 4100)

set -e

PORT=${1:-4100}
WORKER_DIR="$(cd "$(dirname "$0")" && pwd)"
TUNNEL_LOG="/tmp/timpstunnel-$PORT.log"
CURRENT_URL_FILE="/tmp/timpstunnel-$PORT.url"
API_TOKEN="${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN env var}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Kill any existing tunnel on this port
if [ -f "$TUNNEL_LOG" ]; then
  OLD_PID=$(grep -o 'PID=[0-9]*' "$TUNNEL_LOG" 2>/dev/null | head -1 | cut -d= -f2)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
fi

# Start cloudflared
log "Starting tunnel to localhost:$PORT..."
cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate 2>&1 | tee "$TUNNEL_LOG" &
TUNNEL_PID=$!
echo "PID=$TUNNEL_PID" >> "$TUNNEL_LOG"

# Wait for tunnel URL
log "Waiting for tunnel URL..."
TUNNEL_URL=""
for i in $(seq 1 30); do
  sleep 1
  TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
done

if [ -z "$TUNNEL_URL" ]; then
  log "ERROR: Failed to get tunnel URL after 30s"
  kill $TUNNEL_PID 2>/dev/null
  exit 1
fi

log "Tunnel URL: $TUNNEL_URL"
echo "$TUNNEL_URL" > "$CURRENT_URL_FILE"

# Update wrangler.toml
log "Updating wrangler.toml..."
sed -i '' "s|TIMPS_MEMORY_URL = \"[^\"]*\"|TIMPS_MEMORY_URL = \"$TUNNEL_URL\"|" "$WORKER_DIR/wrangler.toml"

# Deploy Worker
log "Deploying Worker..."
cd "$WORKER_DIR"
CLOUDFLARE_API_TOKEN="$API_TOKEN" wrangler deploy 2>&1 | tail -3

log "Tunnel + Worker updated successfully!"
log "Worker: https://timps-mcp.sandeepreddythummala1729.workers.dev"
log "MCP: https://timps-mcp.sandeepreddythummala1729.workers.dev/mcp"

# Monitor for URL changes (reconnects)
while kill -0 $TUNNEL_PID 2>/dev/null; do
  sleep 10
  NEW_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -1)
  if [ -n "$NEW_URL" ] && [ "$NEW_URL" != "$TUNNEL_URL" ]; then
    log "Tunnel URL changed: $TUNNEL_URL -> $NEW_URL"
    TUNNEL_URL="$NEW_URL"
    echo "$TUNNEL_URL" > "$CURRENT_URL_FILE"
    sed -i '' "s|TIMPS_MEMORY_URL = \"[^\"]*\"|TIMPS_MEMORY_URL = \"$TUNNEL_URL\"|" "$WORKER_DIR/wrangler.toml"
    CLOUDFLARE_API_TOKEN="$API_TOKEN" wrangler deploy 2>&1 | tail -2
    log "Worker re-deployed with new URL"
  fi
done

log "Tunnel process exited"
