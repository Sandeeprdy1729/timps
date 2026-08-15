#!/usr/bin/env bash
# Build a single, self-contained timps-mcp executable.
#
# The produced binary embeds the bundled JS + a runtime — no node_modules,
# no npx, no package registry. It is what agents' MCP configs point at for
# stable, low-latency spawns.
#
# Usage:
#   ./scripts/build-binary.sh [out-path]        # default: dist/bin/timps-mcp
#
# Strategies (first available wins):
#   1. bun build --compile  → native executable (fastest, no extra downloads)
#   2. Node SEA             → single executable (Node >= 20; known SIGSEGV bug
#                             on some Node 22 + macOS arm64 builds)

set -euo pipefail

cd "$(dirname "$0")/.."

OUT="${1:-dist/bin/timps-mcp}"

echo "◆ 1/3 Building standalone bundle…"
npm run build:standalone >/dev/null

mkdir -p "$(dirname "$OUT")"

if command -v bun >/dev/null 2>&1; then
  echo "◆ 2/3 Compiling with Bun…"
  bun build --compile dist/timps-mcp.cjs \
    --outfile "$OUT" \
    --external pg --external ioredis --external better-sqlite3 --external @qdrant/js-client-rest
  echo "✓ Built $(du -h "$OUT" | cut -f1) binary: $OUT"
  echo "  Test: \"$OUT\" (spawns as stdio MCP server)"
  exit 0
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "error: need Bun or Node >= 20 to build the binary." >&2
  exit 1
fi

echo "◆ 2/3 Generating Node SEA blob…"
cat > dist/sea-config.json <<EOF
{
  "main": "dist/timps-mcp.cjs",
  "output": "dist/timps-mcp-sea.blob",
  "disableExperimentalSEAWarning": true
}
EOF
node --experimental-sea-config dist/sea-config.json >/dev/null

echo "◆ 3/3 Injecting bundle into Node runtime…"
NODE_BIN="$(command -v node)"
cp "$NODE_BIN" "$OUT"
chmod +x "$OUT"
npx --yes postject "$OUT" NODE_SEA_BLOB dist/timps-mcp-sea.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

rm -f dist/sea-config.json dist/timps-mcp-sea.blob

echo ""
echo "✓ Built $(du -h "$OUT" | cut -f1) single-file binary: $OUT"
echo "  Test: \"$OUT\" (spawns as stdio MCP server)"
echo "  Note: macOS may need 'codesign --force --sign - $OUT' if the kernel SIGKILLs it."
