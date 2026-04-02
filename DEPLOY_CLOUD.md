# TIMPs Cloud Deployment Guide — Free Forever ($0/month, no expiry)

Deploy TIMPs backend to the cloud for **$0/month permanently** so anyone with the VS Code extension can use it.

Every service below has a genuinely free-forever tier — no trials, no 90-day expiry.

---

## Architecture

```
VS Code Extension (Marketplace, free)
        │
        ▼
  Render.com (Free Web Service)  ← TIMPs API  [free forever]
        │
        ├── Neon.tech PostgreSQL  [free forever, 0.5 GB]
        ├── Qdrant Cloud          [free forever, 1 GB]
        └── Google Gemini API     [free forever, chat + embeddings]
```

## Step 1: Neon.tech PostgreSQL (free forever, 0.5 GB)

1. Go to [neon.tech](https://neon.tech) → Sign up (free, no credit card)
2. Create a project (any region)
3. Copy the **connection string** — looks like:
   ```
   postgresql://user:pass@ep-xyz-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. That's your `DATABASE_URL`

**Why Neon**: Unlike Render PostgreSQL (90-day expiry), Neon's free tier never expires. 0.5 GB storage, auto-suspend on idle, wakes in ~1s.

## Step 2: Qdrant Cloud (free forever, 1 GB)

1. Go to [cloud.qdrant.io](https://cloud.qdrant.io) → Sign up (free, no credit card)
2. Create a free cluster (1 node, 1 GB)
3. Copy your **cluster URL** (e.g. `https://abc123.us-east4-0.gcp.cloud.qdrant.io:6333`)
4. Copy your **API key**

## Step 3: Google Gemini API Key (free forever)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click "Create API Key" (free, no credit card)
3. Copy the key

**Free limits** (permanent, not a trial):
- Chat (gemini-2.0-flash): 15 RPM, 1M tokens/min
- Embeddings (embedding-001): 1500 RPM, free forever

## Step 4: Deploy to Render.com (free forever)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates a free web service
5. In the Render dashboard, set these **secret** env vars:
   | Variable | Value |
   |----------|-------|
   | `GEMINI_API_KEY` | Your Google AI Studio key from Step 3 |
   | `DATABASE_URL` | Your Neon connection string from Step 1 |
   | `QDRANT_URL` | Your Qdrant Cloud URL from Step 2 |
   | `QDRANT_API_KEY` | Your Qdrant API key from Step 2 |
6. Deploy!

## Step 5: Update Extension Default URL

Your Render URL will be `https://timps-api.onrender.com`.

If your service name is different, update in `timps-vscode/package.json`:
```json
"timps.serverUrl": {
  "default": "https://YOUR-SERVICE-NAME.onrender.com"
}
```

## Step 6: Publish Extension to VS Code Marketplace

```bash
npm install -g @vscode/vsce
cd timps-vscode
npm install && npm run compile
vsce package           # Creates .vsix
vsce publish           # Publishes to Marketplace (free)
```

Requires a free [Marketplace publisher account](https://marketplace.visualstudio.com/manage) + [Azure DevOps PAT](https://dev.azure.com).

---

## Cost Breakdown — All Free Forever

| Service | Free Tier Limits | Expiry |
|---------|-----------------|--------|
| **Render Web Service** | Sleeps after 15 min idle, ~30s cold start | **Never** |
| **Neon PostgreSQL** | 0.5 GB storage, auto-suspend on idle | **Never** |
| **Qdrant Cloud** | 1 GB vectors, 1 node | **Never** |
| **Google Gemini API** | 15 RPM chat, 1500 RPM embeddings | **Never** |
| **VS Code Marketplace** | Unlimited installs | **Never** |
| **Total** | | **$0/month forever** |

## Notes

- **Cold starts**: Render free tier sleeps after 15 min idle. First request after sleep takes ~30s. The extension handles this gracefully.
- **No Ollama needed**: Cloud deployment uses Gemini for both chat AND embeddings. Ollama is only needed for local development.
- **Scaling**: If demand grows, Render Starter ($7/month) removes cold starts. Neon Pro ($19/month) adds 10 GB. But the free tier handles light-to-moderate usage indefinitely.
