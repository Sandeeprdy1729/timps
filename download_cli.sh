#!/usr/bin/env bash
# TIMPS CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/install.sh | bash
#        or: ./download_cli.sh [--version v0.1.0] [--dir /usr/local/bin]

set -euo pipefail

REPO="Sandeeprdy1729/timps"
BIN_NAME="timps"
INSTALL_DIR="${TIMPS_INSTALL_DIR:-${HOME}/.timps/bin}"
VERSION="${TIMPS_VERSION:-latest}"
GITHUB_API="https://api.github.com/repos/${REPO}/releases"

# ── Helpers ────────────────────────────────────────────────────────────────

say() { printf "\033[32m%s\033[0m\n" "$*"; }
warn() { printf "\033[33mWARN: %s\033[0m\n" "$*" >&2; }
die() { printf "\033[31mERROR: %s\033[0m\n" "$*" >&2; exit 1; }

need_cmd() { command -v "$1" &>/dev/null || die "Required command not found: $1"; }

# ── Parse args ─────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --dir)     INSTALL_DIR="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--version v0.x.x] [--dir /path/to/bin]"
      exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

# ── Detect platform ────────────────────────────────────────────────────────

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)  PLATFORM="linux" ;;
  Darwin) PLATFORM="macos" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *) die "Unsupported OS: $OS" ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_TAG="x86_64" ;;
  arm64|aarch64) ARCH_TAG="aarch64" ;;
  *) die "Unsupported architecture: $ARCH" ;;
esac

if [[ "$PLATFORM" == "windows" ]]; then
  ASSET_NAME="${BIN_NAME}-${ARCH_TAG}-${PLATFORM}.exe"
else
  ASSET_NAME="${BIN_NAME}-${ARCH_TAG}-${PLATFORM}"
fi

say "Detected platform: ${PLATFORM}/${ARCH_TAG}"

# ── Resolve version ────────────────────────────────────────────────────────

need_cmd curl

if [[ "$VERSION" == "latest" ]]; then
  say "Fetching latest release..."
  VERSION="$(curl -fsSL "${GITHUB_API}/latest" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')"
  [[ -n "$VERSION" ]] || die "Could not determine latest version"
fi

say "Installing TIMPS ${VERSION}..."

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET_NAME}"

# ── Download ───────────────────────────────────────────────────────────────

TMPDIR="$(mktemp -d)"
TMPFILE="${TMPDIR}/${ASSET_NAME}"

say "Downloading ${DOWNLOAD_URL}..."
curl -fsSL --progress-bar -o "${TMPFILE}" "${DOWNLOAD_URL}" \
  || die "Download failed. Check that version ${VERSION} exists on GitHub Releases."

# ── Install ────────────────────────────────────────────────────────────────

mkdir -p "${INSTALL_DIR}"
DEST="${INSTALL_DIR}/${BIN_NAME}"

if [[ "$PLATFORM" == "windows" ]]; then
  DEST="${INSTALL_DIR}/${BIN_NAME}.exe"
fi

cp "${TMPFILE}" "${DEST}"
chmod +x "${DEST}"
rm -rf "${TMPDIR}"

say "Installed to ${DEST}"

# ── PATH check ─────────────────────────────────────────────────────────────

if ! echo "$PATH" | grep -q "${INSTALL_DIR}"; then
  warn "${INSTALL_DIR} is not in your PATH."
  echo ""
  echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
  echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
  echo ""
fi

# ── Verify ─────────────────────────────────────────────────────────────────

if command -v "${BIN_NAME}" &>/dev/null; then
  say "TIMPS installed successfully!"
  "${BIN_NAME}" --version 2>/dev/null || true
else
  say "TIMPS installed to ${DEST}"
  say "Run: ${DEST} --version"
fi

echo ""
say "Get started:"
echo "  timps \"What does this project do?\""
echo "  timps run workflow_recipes/code-review.yaml"
echo "  timps help"
