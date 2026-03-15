import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import routes from './routes';
import { config } from '../config/env';
import { initDatabase } from '../db/postgres';
import { initVectorStore } from '../db/vector';
import { positionStore } from '../tools/positionStore';
import { initToolsTables } from '../tools/toolsDb';

export function createApp(): Express {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
  
  // Serve static files — resolve correctly for both ts-node and compiled dist
  // ts-node: __dirname = sandeep-ai/api → public is at sandeep-ai/public
  // compiled: __dirname = sandeep-ai/dist/api → public is at sandeep-ai/dist/public (doesn't exist)
  // So we try ../public first (ts-node path), then fall back to checking further up
  const candidates = [
    path.join(__dirname, '../public'),          // ts-node: api/../public = sandeep-ai/public ✓
    path.join(__dirname, '../../public'),        // dist/api/../../public = sandeep-ai/public ✓
    path.join(process.cwd(), 'public'),          // cwd-relative fallback
  ];
  const publicPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
  console.log(`Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));

  // Explicit HTML fallbacks so direct URL access works
  app.get('/', (_req, res) => res.sendFile(path.join(publicPath, 'index.html')));
  app.get('/chat', (_req, res) => res.sendFile(path.join(publicPath, 'chat.html')));
  app.get('/chat.html', (_req, res) => res.sendFile(path.join(publicPath, 'chat.html')));
  
  app.use('/api', routes);
  
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
  
  return app;
}

export async function startServer(): Promise<void> {
  const app = createApp();
  
  try {
    await initDatabase();
    await initToolsTables();
    console.log('PostgreSQL initialized (core + all 17 tool tables)');
  } catch (error) {
    console.warn('PostgreSQL initialization failed, continuing without DB:', error);
  }
  
  try {
    await initVectorStore();
    await positionStore.initPositionsCollection();
    console.log('Qdrant vector store initialized (memories + positions)');
  } catch (error) {
    console.warn('Qdrant initialization failed, continuing without vector store:', error);
  }
  
  app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     TIMPs Server                                          ║
║     A persistent cognitive partner                        ║
║                                                           ║
║     Server running on http://localhost:${config.port}        ║
║     Environment: ${config.nodeEnv.padEnd(35)}║
║                                                           ║
║     Web Interface:                                        ║
║     → Open http://localhost:${config.port} in your browser      ║
║                                                           ║
║     API Endpoints:                                        ║
║     - POST /api/chat                : Chat with AI       ║
║     - GET  /api/memory/:userId      : Get user memories  ║
║     - GET  /api/goals/:userId       : Get user goals     ║
║     - POST /api/contradiction/check : Tool 5 DNA check   ║
║     - GET  /api/positions/:userId   : List positions     ║
║     - GET  /api/health              : Health check       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

if (require.main === module) {
  startServer().catch(console.error);
}