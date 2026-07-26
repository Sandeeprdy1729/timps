FROM node:20-bookworm

# Install system dependencies as root
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    unzip \
    zsh \
    vim \
    htop \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Rust as root (before switching to USER node)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV CARGO_HOME="/home/node/.cargo"
ENV RUSTUP_HOME="/home/node/.rustup"
ENV PATH="$CARGO_HOME/bin:$PATH"

# Install pnpm and turbo as root
RUN npm install -g pnpm turbo typescript tsx vitest eslint prettier concurrently nodemon

# Create TIMPS directories
RUN mkdir -p /home/node/.timps/memory /home/node/.timps/cache /home/node/.timps/config /workspace

# Set workdir and switch to node user
WORKDIR /workspace
USER node

# Install Rust tools (as node user, cargo is now available)
RUN cargo install cargo-watch cargo-audit cargo-edit cargo-expand cargo-tree 2>/dev/null || true

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/home/node/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Default environment variables
ENV NODE_ENV=development
ENV TIMPS_CONFIG="/home/node/.timps/config"
ENV TIMPS_MEMORY_DIR="/home/node/.timps/memory"
ENV TIMPS_CACHE_DIR="/home/node/.timps/cache"
ENV RUST_BACKTRACE=1
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true

# Expose ports (app, preview, postgres, qdrant, ollama)
EXPOSE 3000 3001 5432 6333 11434

CMD ["/bin/bash"]
