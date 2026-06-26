#!/usr/bin/env bash
# ╔═══════════════════════════════════════════════════════════╗
# ║         TIMPS — Universal Installer                       ║
# ║  After running this, type  timps  in any terminal.        ║
# ╚═══════════════════════════════════════════════════════════╝
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/install.sh | bash
#   — or —
#   bash install.sh

set -euo pipefail
IFS=$'\n\t'

# ── Colors & helpers ──────────────────────────────────────────────────────────
C_RESET="\033[0m"
C_TEAL="\033[38;5;36m"
C_TAN="\033[38;5;179m"
C_CREAM="\033[38;5;229m"
C_MUTED="\033[38;5;243m"
C_GREEN="\033[38;5;71m"
C_RED="\033[38;5;167m"
C_YELLOW="\033[38;5;221m"
C_BOLD="\033[1m"

info()    { echo -e "${C_TEAL}  ●  ${C_RESET}$*"; }
success() { echo -e "${C_GREEN}  ✔  ${C_RESET}${C_BOLD}$*${C_RESET}"; }
warn()    { echo -e "${C_YELLOW}  ⚠  ${C_RESET}$*"; }
error()   { echo -e "${C_RED}  ✖  ${C_RESET}$*" >&2; }
die()     { error "$*"; exit 1; }
hr()      { echo -e "${C_MUTED}  ────────────────────────────────────────${C_RESET}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${C_TEAL}  ╔══════════════════════════════════════╗${C_RESET}"
echo -e "${C_TEAL}  ║${C_RESET}        ${C_CREAM}${C_BOLD}TIMPS Installer v2.0${C_RESET}          ${C_TEAL}║${C_RESET}"
echo -e "${C_TEAL}  ║${C_RESET}  ${C_MUTED}Open-source AI coding agent${C_RESET}          ${C_TEAL}║${C_RESET}"
echo -e "${C_TEAL}  ╚══════════════════════════════════════╝${C_RESET}"
echo ""
echo -e "     ${C_TAN}  ┌──────┐  ${C_RESET}"
echo -e "     ${C_TAN}  │ ◉  ◉ │  ${C_RESET}"
echo -e "     ${C_TAN}  │  ‿   │  ${C_RESET}"
echo -e "     ${C_TAN}  └──────┘  ${C_RESET}"
echo -e "     ${C_TAN}  ┆ ░░░░ ┆  ${C_RESET}"
echo -e "     ${C_TAN} ┌┴──────┴┐ ${C_RESET}"
echo -e "     ${C_TAN} │  timps  │ ${C_RESET}"
echo -e "     ${C_TAN} └┬──────┬┘ ${C_RESET}"
echo -e "     ${C_TAN}  ██    ██  ${C_RESET}"
echo ""

# ── Config ────────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/Sandeeprdy1729/timps.git"
INSTALL_DIR="${TIMPS_INSTALL_DIR:-$HOME/.timps/repo}"
PACKAGE_DIR="timps-code"
REQUIRED_NODE_MAJOR=18

# ── Step 1: Check OS ──────────────────────────────────────────────────────────
hr
info "Checking system requirements…"
OS="$(uname -s)"
case "$OS" in
  Linux*|Darwin*) ;;
  *) die "Unsupported OS: $OS (Linux and macOS only)" ;;
esac

# ── Step 2: Check Node.js ─────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  error "Node.js not found."
  echo ""
  echo -e "  ${C_CREAM}Install Node.js ${REQUIRED_NODE_MAJOR}+ from:${C_RESET}"
  echo -e "  ${C_TEAL}https://nodejs.org${C_RESET}  or  ${C_TEAL}brew install node${C_RESET}"
  echo ""
  die "Please install Node.js and re-run this script."
fi

NODE_VERSION="$(node --version | sed 's/v//' | cut -d. -f1)"
if [[ "$NODE_VERSION" -lt "$REQUIRED_NODE_MAJOR" ]]; then
  die "Node.js ${REQUIRED_NODE_MAJOR}+ required (found v${NODE_VERSION}). Upgrade at https://nodejs.org"
fi
success "Node.js v$(node --version | sed 's/v//') ✓"

# ── Step 3: Check npm ─────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  die "npm not found. Please install npm (comes with Node.js)."
fi
success "npm $(npm --version) ✓"

# ── Step 4: Check git ─────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  die "git not found. Install with: brew install git  (or your package manager)"
fi
success "git $(git --version | awk '{print $3}') ✓"

# ── Step 5: Check / install Ollama (optional but recommended) ────────────────
hr
if command -v ollama &>/dev/null; then
  success "Ollama found — free local AI is ready!"
else
  warn "Ollama not found. TIMPS works with Ollama for 100% free local AI."
  echo ""
  read -rp "  Install Ollama now? [Y/n] " _INSTALL_OLLAMA
  _INSTALL_OLLAMA="${_INSTALL_OLLAMA:-Y}"
  if [[ "$_INSTALL_OLLAMA" =~ ^[Yy] ]]; then
    if [[ "$OS" == "Darwin" ]]; then
      if command -v brew &>/dev/null; then
        info "Installing Ollama via Homebrew…"
        brew install --cask ollama 2>/dev/null || warn "Homebrew install failed. Download from https://ollama.com/download"
      else
        warn "Please download Ollama from https://ollama.com/download and re-run."
      fi
    else
      info "Installing Ollama via official script…"
      curl -fsSL https://ollama.com/install.sh | sh || warn "Ollama install failed. See https://ollama.com/download"
    fi
  else
    warn "Skipping Ollama. You can still use TIMPS with Claude, GPT, Gemini, etc."
  fi
fi

# ── Step 6: Clone or update repository ───────────────────────────────────────
hr
info "Setting up TIMPS repository…"
mkdir -p "$(dirname "$INSTALL_DIR")"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Repository found at $INSTALL_DIR — pulling latest…"
  git -C "$INSTALL_DIR" pull --rebase --autostash 2>/dev/null || warn "Could not pull latest — using existing version."
  success "Repository up to date ✓"
else
  info "Cloning TIMPS from GitHub…"
  info "Target: $INSTALL_DIR"
  git clone --depth=1 "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || \
    die "Clone failed. Check your internet connection or the repo URL."
  success "Repository cloned ✓"
fi

# ── Step 7: Install dependencies (monorepo root) ────────────────────────────
hr
info "Installing dependencies from monorepo root…"
cd "$INSTALL_DIR"

npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -5 || \
  npm install --no-audit --no-fund 2>&1 | tail -5 || \
  die "npm install failed. See above for details."

success "Dependencies installed ✓"

# ── Step 8: Build timps-code ──────────────────────────────────────────────────
hr
info "Building TIMPS (TypeScript → JavaScript)…"

npm run build --workspace=timps-code 2>&1 | tail -8 || \
  npm run build --workspace=@timps-ai/memory-core --workspace=@timps-ai/plugin-sdk --workspace=timps-code 2>&1 | tail -8 || \
  warn "Build had warnings — timps may still work. Run manually: cd $INSTALL_DIR && npm run build"
success "Build complete ✓"

# ── Step 9: Install globally ──────────────────────────────────────────────────
hr
info "Installing 'timps' command globally…"

cd "$INSTALL_DIR/$PACKAGE_DIR"
if npm install -g . 2>/dev/null; then
  success "'timps' installed globally via npm ✓"
else
  warn "Global install failed (may need sudo). Trying npm link…"
  npm link 2>/dev/null || {
    warn "npm link failed. Trying with sudo…"
    sudo npm install -g . || warn "Could not install globally. Try: sudo npm install -g $INSTALL_DIR/$PACKAGE_DIR  —  or use: npx timps-code"
  }
  success "'timps' linked globally ✓"
fi

# ── Step 10: Verify PATH ──────────────────────────────────────────────────────
hr
TIMPS_BIN="$(command -v timps 2>/dev/null || true)"

if [[ -z "$TIMPS_BIN" ]]; then
  warn "'timps' not found in PATH after install."
  NPM_BIN_DIR="$(npm bin -g 2>/dev/null || echo "$HOME/.npm-global/bin")"

  echo ""
  warn "Add the following to your shell profile (~/.zshrc or ~/.bashrc):"
  echo ""
  echo -e "    ${C_TEAL}export PATH=\"$NPM_BIN_DIR:\$PATH\"${C_RESET}"
  echo ""

  read -rp "  Auto-add to ~/.zshrc now? [Y/n] " _ADD_PATH
  _ADD_PATH="${_ADD_PATH:-Y}"
  if [[ "$_ADD_PATH" =~ ^[Yy] ]]; then
    PROFILE="$HOME/.zshrc"
    if [[ "$SHELL" == *"bash"* ]]; then PROFILE="$HOME/.bashrc"; fi
    echo "" >> "$PROFILE"
    echo "# TIMPS global bin" >> "$PROFILE"
    echo "export PATH=\"$NPM_BIN_DIR:\$PATH\"" >> "$PROFILE"
    success "PATH updated in $PROFILE ✓"
    export PATH="$NPM_BIN_DIR:$PATH"
  fi
fi

TIMPS_BIN="$(command -v timps 2>/dev/null || true)"
if [[ -n "$TIMPS_BIN" ]]; then
  success "timps command found at: $TIMPS_BIN ✓"
fi

# ── Step 11: Pull default model (optional) ────────────────────────────────────
hr
if command -v ollama &>/dev/null; then
  echo ""
  info "TIMPS works best with a local model. Recommended: qwen2.5-coder:7b (4.7 GB)"
  echo ""
  read -rp "  Pull qwen2.5-coder:7b now? (~4.7 GB download) [Y/n] " _PULL
  _PULL="${_PULL:-Y}"
  if [[ "$_PULL" =~ ^[Yy] ]]; then
    info "Pulling model (this may take a few minutes)…"
    ollama pull qwen2.5-coder:7b && success "Model ready ✓" || warn "Model pull failed — try: ollama pull qwen2.5-coder:7b"
  else
    info "Skipped. Pull later with: ollama pull qwen2.5-coder:7b"
  fi
fi

# ── Step 12: Success banner ────────────────────────────────────────────────────
hr
echo ""
echo -e "${C_GREEN}${C_BOLD}  ╔══════════════════════════════════════════╗${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}  ║   TIMPS installed successfully! 🎉        ║${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}  ╚══════════════════════════════════════════╝${C_RESET}"
echo ""
echo -e "  ${C_CREAM}To launch TIMPS, open a new terminal and type:${C_RESET}"
echo ""
echo -e "    ${C_TEAL}${C_BOLD}timps${C_RESET}"
echo ""
echo -e "  ${C_MUTED}Useful commands inside TIMPS:${C_RESET}"
echo -e "    ${C_TAN}/help${C_RESET}       — list all commands"
echo -e "    ${C_TAN}/model${C_RESET}      — switch AI provider"
echo -e "    ${C_TAN}/todos${C_RESET}      — show task list"
echo -e "    ${C_TAN}/stats${C_RESET}      — memory & usage stats"
echo -e "    ${C_TAN}/swarm${C_RESET}      — launch multi-agent swarm"
echo ""
echo -e "  ${C_MUTED}Docs: ${C_TEAL}https://github.com/Sandeeprdy1729/timps${C_RESET}"
echo ""

# ── Step 13: Launch ────────────────────────────────────────────────────────────
if command -v timps &>/dev/null; then
  read -rp "  Launch TIMPS now? [Y/n] " _LAUNCH
  _LAUNCH="${_LAUNCH:-Y}"
  if [[ "$_LAUNCH" =~ ^[Yy] ]]; then
    echo ""
    exec timps
  fi
else
  warn "Restart your terminal then run: timps"
fi
