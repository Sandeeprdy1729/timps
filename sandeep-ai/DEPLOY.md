# Deploy TIMPs Backend to Render

## Quick Deploy (One Click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Manual Deploy Steps:

1. **Create Render Account**: https://dashboard.render.com

2. **Create PostgreSQL Database**:
   - New → PostgreSQL
   - Name: `timps-db`
   - Region: Choose closest
   - Copy the "Internal Database URL"

3. **Create Web Service**:
   - New → Web Service
   - Connect GitHub repo: `https://github.com/Sandeeprdy1729/timps`
   - Branch: `main`
   - Root Directory: `sandeep-ai`
   - Build Command: `npm install`
   - Start Command: `npm start`
   
4. **Add Environment Variables**:
   ```
   DATABASE_URL = <your-postgres-internal-url>
   NODE_ENV = production
   PORT = 3000
   ```

5. **Deploy!**

6. **Update VS Code Extension**:
   Set `timps.serverUrl` to your Render URL (e.g., `https://timps-api.onrender.com`)

---

## Alternative: Deploy to Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Init: `railway init`
4. Add PostgreSQL: `railway add postgresql`
5. Deploy: `railway up`

---

## Docker Deploy

```bash
cd /Users/sandeepreddy/Desktop/testbot

# Build and run
docker compose up -d
```

Your backend will be at `http://localhost:3000`
