FROM node:20-bookworm

# Install system dependencies
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

# Install bun (fast package manager)
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="$HOME/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Install pnpm globally
RUN npm install -g pnpm

# Install Turbo (monorepo tool)
RUN pnpm add -g turbo

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV CARGO_HOME="$HOME/.cargo"
ENV RUSTUP_HOME="$HOME/.rustup"
ENV PATH="$CARGO_HOME/bin:$PATH"

# Create TIMPS directories
RUN mkdir -p /home/node/.timps/memory /home/node/.timps/cache /home/node/.timps/config /workspace

# Set workdir
WORKDIR /workspace
USER node

# Install Node.js global tools
RUN pnpm add -g \
    typescript \
    tsx \
    vitest \
    eslint \
    prettier \
    @typescript-eslint/parser \
    @typescript-eslint/eslint-plugin \
    concurrently \
    nodemon \
    npm-check-updates

# Install Rust tools
RUN cargo install \
    cargo-watch \
    cargo-audit \
    cargo-edit \
    cargo-expand \
    cargo-tree \
    cargo-udeps \
    2>/dev/null || true

# Install Ollama (for AI)
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Install Qdrant (for vector storage)
RUN curl -fsSL https://get.qdrant.tech | bash

# Install Docker CLI for building images
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/bin/dockerd /usr/local/bin/dockerd

# Copy entrypoint
COPY devcontainer-entrypoint.sh /usr/local/bin/devcontainer-entrypoint
RUN chmod +x /usr/local/bin/devcontainer-entrypoint
ENTRYPOINT ["/usr/local/bin/devcontainer-entrypoint"]

# Default environment variables
ENV NODE_ENV=development
ENV TIMPS_CONFIG=/home/node/.timps/config
ENV TIMPS_MEMORY_DIR=/home/node/.timps/memory
ENV TIMPS_CACHE_DIR=/home/node/.timps/cache
ENV RUST_BACKTRACE=1
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV PULP_API_KEY=
ENV OPENAI_API_KEY=

# Expose ports
EXPOSE 3000 3001 5432 6333 11434

CMD ["/bin/bash"]