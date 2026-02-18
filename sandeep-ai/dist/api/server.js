"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const env_1 = require("../config/env");
const postgres_1 = require("../db/postgres");
const vector_1 = require("../db/vector");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((req, _res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
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
        console.log('PostgreSQL initialized');
    }
    catch (error) {
        console.warn('PostgreSQL initialization failed, continuing without DB:', error);
    }
    try {
        await (0, vector_1.initVectorStore)();
        console.log('Qdrant vector store initialized');
    }
    catch (error) {
        console.warn('Qdrant initialization failed, continuing without vector store:', error);
    }
    app.listen(env_1.config.port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     TIMPs Server                                     ║
║     A persistent cognitive partner                        ║
║                                                           ║
║     Server running on http://localhost:${env_1.config.port}        ║
║     Environment: ${env_1.config.nodeEnv.padEnd(35)}║
║                                                           ║
║     Endpoints:                                            ║
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
//# sourceMappingURL=server.js.map