"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const routes_1 = __importDefault(require("./routes"));
const env_1 = require("../config/env");
const postgres_1 = require("../db/postgres");
const vector_1 = require("../db/vector");
const positionStore_1 = require("../tools/positionStore");
const toolsDb_1 = require("../tools/toolsDb");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((req, _res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
    // Serve static files — resolve correctly for both ts-node and compiled dist
    // ts-node: __dirname = sandeep-ai/api → public is at sandeep-ai/public
    // compiled: __dirname = sandeep-ai/dist/api → public is at sandeep-ai/dist/public (doesn't exist)
    // So we try ../public first (ts-node path), then fall back to checking further up
    const candidates = [
        path_1.default.join(__dirname, '../public'), // ts-node: api/../public = sandeep-ai/public ✓
        path_1.default.join(__dirname, '../../public'), // dist/api/../../public = sandeep-ai/public ✓
        path_1.default.join(process.cwd(), 'public'), // cwd-relative fallback
    ];
    const publicPath = candidates.find(p => fs_1.default.existsSync(p)) || candidates[0];
    console.log(`Serving static files from: ${publicPath}`);
    app.use(express_1.default.static(publicPath));
    // Explicit HTML fallbacks so direct URL access works
    app.get('/', (_req, res) => res.sendFile(path_1.default.join(publicPath, 'index.html')));
    app.get('/chat', (_req, res) => res.sendFile(path_1.default.join(publicPath, 'chat.html')));
    app.get('/chat.html', (_req, res) => res.sendFile(path_1.default.join(publicPath, 'chat.html')));
    app.use('/api', routes_1.default);
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
    app.use((err, _req, res, _next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
    return app;
}
async function startServer() {
    const app = createApp();
    try {
        await (0, postgres_1.initDatabase)();
        await (0, toolsDb_1.initToolsTables)();
        console.log('PostgreSQL initialized (core + all 17 tool tables)');
    }
    catch (error) {
        console.warn('PostgreSQL initialization failed, continuing without DB:', error);
    }
    try {
        await (0, vector_1.initVectorStore)();
        await positionStore_1.positionStore.initPositionsCollection();
        console.log('Qdrant vector store initialized (memories + positions)');
    }
    catch (error) {
        console.warn('Qdrant initialization failed, continuing without vector store:', error);
    }
    app.listen(env_1.config.port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     TIMPs Server                                          ║
║     A persistent cognitive partner                        ║
║                                                           ║
║     Server running on http://localhost:${env_1.config.port}        ║
║     Environment: ${env_1.config.nodeEnv.padEnd(35)}║
║                                                           ║
║     Web Interface:                                        ║
║     → Open http://localhost:${env_1.config.port} in your browser      ║
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
//# sourceMappingURL=server.js.map