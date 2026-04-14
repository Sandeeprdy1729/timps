# Deploy TIMPs Backend

## Option 1: Railway (Recommended) 🚂

### Quick Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### Manual Setup:
1. **Create Railway Account**: https://railway.app
2. **New Project** → **Provision PostgreSQL**
3. **Add Service** → **Empty Service**
4. **Connect GitHub** repo: `https://github.com/Sandeeprdy1729/timps`
5. **Root Directory**: `sandeep-ai`
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
cd /Users/sandeepreddy/Desktop/testbot
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
4. **Root Directory**: `sandeep-ai`
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
cd /Users/sandeepreddy/Desktop/testbot
docker build -t timps-backend -f sandeep-ai/Dockerfile .

# Push to Docker Hub
docker tag timps-backend sandeeprdy1729/timps-backend
docker push sandeeprdy1729/timps-backend

# Deploy anywhere (AWS, GCP, Azure, etc.)
```

---

## Option 4: DigitalOcean App Platform 💧

1. Create DigitalOcean account
2. **Apps** → **Create App** → **GitHub**
3. Select `sandeep-ai` directory
4. Configure with Dockerfile or buildpack
5. Add PostgreSQL database

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
cd /Users/sandeepreddy/Desktop/testbot

# Start with Docker (full stack)
docker compose up -d

# Or start individual services
docker compose up -d postgres qdrant

# Then run API locally
cd sandeep-ai
npm install
npm run dev
```

Your API will be at `http://localhost:3000`
