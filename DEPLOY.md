# Deploy TIMPs Backend

## Option 1: Railway (Recommended) 🚂

### Quick Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### Manual Setup:
1. **Create Railway Account**: https://railway.app
2. **New Project** → **Provision PostgreSQL**
3. **Add Service** → **Empty Service**
4. **Connect GitHub** repo: `https://github.com/Sandeeprdy1729/timps`
5. **Root Directory**: `packages/server`
6. **Start Command**: `npm start`
7. **Add Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATABASE_URL` (from Railway PostgreSQL)
   - `QDRANT_URL=http://qdrant:6333` (or use in-memory embeddings)

### Deploy:
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
cd /path/to/timps
railway init
railway link <project-id>

# Deploy
railway up
```

---

## Option 2: Render 🌿

### Quick Deploy
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Manual Setup:
1. **Create Render Account**: https://render.com
2. **New** → **Web Service**
3. **Connect GitHub**: `https://github.com/Sandeeprdy1729/timps`
4. **Root Directory**: `packages/server`
5. **Build Command**: `npm install && npm run build`
6. **Start Command**: `npm start`
7. **Add Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATABASE_URL` (from Render PostgreSQL)
   - `QDRANT_URL=http://qdrant:6333`

---

## Option 3: Docker + Any Cloud 🐳

```bash
# Build locally
cd /path/to/timps
docker build -t timps-backend -f packages/server/Dockerfile .

# Push to Docker Hub
docker tag timps-backend sandeeprdy1729/timps-backend
docker push sandeeprdy1729/timps-backend

# Deploy anywhere (AWS, GCP, Azure, etc.)
```

---

## Option 4: DigitalOcean App Platform 💧

1. Create DigitalOcean account
2. **Apps** → **Create App** → **GitHub**
3. Select `packages/server` directory
4. Configure with Dockerfile or buildpack
5. Add PostgreSQL database

## Option 5: MemoryServer — canonical scalable memory layer 🧠

The modern TIMPS memory architecture. Agents write to and read from a shared,
horizontally-scalable `MemoryServer` (HTTP `4100` / gRPC `4101`) instead of a
per-project file store. Data lives in Postgres (primary + **2 true streaming
replicas**) behind PgBouncer, Redis powers cache + pub/sub + CRDT conflict
sync, and Qdrant does hybrid vector search. Prometheus + Grafana + OTel ship in
the same stack.

```
Agents (timps-mcp)
  │  TIMPS_URL + TIMPS_MEMORY_URL
  ▼
MemoryServer ×N (stateless, scale with --scale memory=3)
  │               │            │
  ▼               ▼            ▼
Postgres(primary  PgBouncer   Redis (cache+pub/sub)   Qdrant (vectors)
+ 2 replicas)         ▲
                      └── Prometheus → Grafana (port 3000)
```

### 1. Deploy the stack

```bash
cd packages/memory-core

# Generate secrets (never commit these)
echo "POSTGRES_PASSWORD=$(openssl rand -base64 18)" > .env
echo "REDIS_PASSWORD=$(openssl rand -base64 18)"   >> .env

docker compose up -d
docker compose ps
```

### 2. Verify

```bash
curl http://localhost:4100/health             # liveness
curl http://localhost:4100/health/readiness   # probes Postgres/Redis/EventBus/Cache
curl http://localhost:4100/memory/stats       # memory stats
```

- Grafana dashboards: `http://localhost:3000` (admin / `$GRAFANA_ADMIN_PASSWORD`)
- Prometheus: `http://localhost:9090`

### 3. Point your agents at it

```bash
timps setup --server http://localhost:4100
```

This registers `timps` (MCP) with every installed agent in server mode. For the
memory tools to hit the shared server, also export `TIMPS_MEMORY_URL` into the
agent's environment (use the setup command's escape hatch):

```bash
TIMPS_SETUP_ENV=TIMPS_MEMORY_URL=http://localhost:4100 timps setup --server http://localhost:4100
```

Verify with `timps setup --list`, then restart your agents.

### 4. Scale out

```bash
docker compose up -d --scale memory=3
```

Replicas auto-register with the shared Postgres/Redis/Qdrant — no per-instance
state. Prometheus discovers every replica individually.

### 5. Single process (no Docker)

For a small team or a laptop, run the server directly with the file backend:

```bash
MEMORY_PORT=4100 node packages/memory-core/dist/server/start.js
```

### 6. Kubernetes

Kustomize manifests live in `packages/memory-core/deploy/k8s/`
(`kustomize build … | kubectl apply -f -`) with an HPA scaling 2–10 pods at 70%
CPU. Swap `docker-compose.yml` Postgres/Redis/Qdrant for managed equivalents and
re-point the `POSTGRES_*`, `REDIS_URL`, `QDRANT_URL` env vars.

---

## After Deployment

Update your VS Code extension:
```json
{
  "timps.serverUrl": "https://your-timps-app.railway.app"
}
```

---

## Local Development

```bash
cd /path/to/timps

# Start with Docker (full stack)
docker compose up -d

# Or start individual services
docker compose up -d postgres qdrant

# Then run API locally
cd packages/server
npm install
npm run dev
```

Your API will be at `http://localhost:3000`
