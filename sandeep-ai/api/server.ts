import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { config } from '../config/env';
import { initDatabase } from '../db/postgres';
import { initVectorStore } from '../db/vector';

export function createApp(): Express {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
  
  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '../public')));
  
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
    console.log('PostgreSQL initialized');
  } catch (error) {
    console.warn('PostgreSQL initialization failed, continuing without DB:', error);
  }
  
  try {
    await initVectorStore();
    console.log('Qdrant vector store initialized');
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
║     🌐 Web Interface:                                     ║
║     → Open http://localhost:${config.port} in your browser      ║
║                                                           ║
║     API Endpoints:                                        ║
║     - POST /api/chat          : Chat with AI             ║
║     - GET  /api/memory/:userId : Get user memories        ║
║     - GET  /api/goals/:userId  : Get user goals           ║
║     - GET  /api/health         : Health check             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

if (require.main === module) {
  startServer().catch(console.error);
}
