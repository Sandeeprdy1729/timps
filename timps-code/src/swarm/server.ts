// TIMPS Swarm — HTTP Server for Distributed Execution
// Exposes REST endpoints that run tasks via the real swarm DAG (graph.ts)

import { createServer } from 'http';
import { URL } from 'url';
import { createSwarm, type AgentRole } from './agents.js';
import { runSwarmDAG, type SwarmResult } from './graph.js';

interface SwarmServerConfig {
  port: number;
  host: string;
}

let server: ReturnType<typeof createServer> | null = null;

export async function startSwarmServer(
  port: string | number = 8000,
  host: string = 'localhost'
): Promise<void> {
  const portNum = typeof port === 'string' ? parseInt(port) : port;

  return new Promise((resolve) => {
    server = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${host}:${portNum}`);

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        if (url.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', agents: 10 }));
          return;
        }

        if (url.pathname === '/swarm/run' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const result = await runSwarmTask(data.request, data.language, data.max_iterations);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Invalid request: ${(err as Error).message}` }));
            }
          });
          return;
        }

        if (url.pathname === '/swarm/status' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ active: true, agents: 10 }));
          return;
        }

        if (url.pathname === '/swarm/agents' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ agents: getAgentList() }));
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));

      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });

    server.listen(portNum, host, () => {
      console.log(`TIMPS Swarm Server running on http://${host}:${portNum}`);
      resolve();
    });
  });
}

export async function stopSwarmServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        console.log('Swarm server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Execute swarm task via the real DAG (graph.ts) — no self-referencing fetch
async function runSwarmTask(
  request: string,
  language?: string,
  maxIterations?: number
): Promise<Record<string, unknown>> {
  const result: SwarmResult = await runSwarmDAG({
    request,
    language,
    maxIterations: maxIterations || 10,
  });

  return {
    request,
    status: result.success ? 'completed' : 'failed',
    results: {
      summary: result.summary || (result.error ? `Error: ${result.error}` : 'No summary'),
    },
    artifacts: result.artifacts || [],
    duration: result.duration,
    error: result.error,
  };
}

function getAgentList() {
  return createSwarm().map(a => ({
    role: a.role,
    model: a.model,
    status: a.status,
    tasksCompleted: a.stats.tasksCompleted,
    tasksFailed: a.stats.tasksFailed,
  }));
}
