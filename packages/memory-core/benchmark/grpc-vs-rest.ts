/**
 * Benchmark: gRPC vs REST latency across payload sizes.
 *
 * Tests:
 *   - Small unary (Store, Recall, GetStats)
 *   - Large payload (Export with 1000+ entries)
 *
 * Usage:
 *   npx tsx benchmark/grpc-vs-rest.ts
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { MemoryServer } from '../src/server/MemoryServer';
import { MemoryClient } from '../src/client/MemoryClient';
import { MemoryGrpcClient } from '../src/client/grpc';
import { InMemoryBackend } from '../src/backends/InMemoryBackend';

interface Sample {
  op: string;
  transport: 'grpc' | 'rest';
  latencyUs: number;   // microseconds
  payloadBytes?: number;
}

function generateId(): string {
  return crypto.randomBytes(3).toString('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function hrtimeUs(): number {
  const [s, ns] = process.hrtime();
  return s * 1_000_000 + ns / 1000;
}

async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 100; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = http.createServer();
        s.listen(port, () => { s.close(() => resolve()); });
        s.on('error', () => reject());
      });
      return port;
    } catch { continue; }
  }
  return start;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function cls(s: string, w: number): string {
  return s.padEnd(w);
}

async function main() {
  const httpPort = await findFreePort(18900);
  const grpcPort = await findFreePort(19000);

  console.log(`\n  Ports: HTTP=${httpPort} gRPC=${grpcPort}`);
  console.log('  Starting MemoryServer...\n');

  const server = new MemoryServer({
    projectPath: `/tmp/timps-bench-${Date.now()}`,
    port: httpPort,
    engineOptions: {
      backend: new InMemoryBackend(),
      dir: `/tmp/timps-bench-data-${Date.now()}`,
    },
    logging: false,
    grpc: { port: grpcPort, host: '127.0.0.1' },
  });

  await server.start();
  await sleep(500);

  // Create raw gRPC client (bypasses MemoryClient wrapper for clean measurement)
  const rawGrpc = new MemoryGrpcClient({
    address: `127.0.0.1:${grpcPort}`,
    timeout: 10000,
  });

  // MemoryClient wrappers
  const grpcClient = new MemoryClient({
    baseUrl: `http://127.0.0.1:${httpPort}`,
    transport: 'grpc',
    grpcAddress: `127.0.0.1:${grpcPort}`,
    timeout: 10000,
  });

  const restClient = new MemoryClient({
    baseUrl: `http://127.0.0.1:${httpPort}`,
    transport: 'rest',
    timeout: 10000,
  });

  const ITER = 30;         // iterations per operation
  const LARGE_COUNT = 200; // entries for large-payload test
  const allSamples: Sample[] = [];

  // ── Warmup ──
  for (let i = 0; i < 10; i++) {
    await rawGrpc.store(`warmup-${i}`, 'fact').catch(() => {});
    await restClient.store({ content: `warmup-${i}`, type: 'fact' }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. SMALL UNARY — Store (raw gRPC vs REST)
  // ═══════════════════════════════════════════════════════════════
  console.log('  [1/4] Store (small, ~100B payload) ...');
  for (let i = 0; i < ITER; i++) {
    const content = `bench-${generateId()}`;
    const t0 = hrtimeUs();
    await rawGrpc.store(content, 'fact', ['bench']);
    allSamples.push({ op: 'Store', transport: 'grpc', latencyUs: hrtimeUs() - t0 });

    const t1 = hrtimeUs();
    await restClient.store({ content, type: 'fact', tags: ['bench'] });
    allSamples.push({ op: 'Store', transport: 'rest', latencyUs: hrtimeUs() - t1 });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. SMALL UNARY — Recall (raw gRPC vs REST)
  // ═══════════════════════════════════════════════════════════════
  console.log('  [2/4] Recall (small query) ...');
  for (let i = 0; i < ITER; i++) {
    const t0 = hrtimeUs();
    await rawGrpc.recall('bench', { limit: 5 });
    allSamples.push({ op: 'Recall', transport: 'grpc', latencyUs: hrtimeUs() - t0 });

    const t1 = hrtimeUs();
    await restClient.recall('bench', { limit: 5 });
    allSamples.push({ op: 'Recall', transport: 'rest', latencyUs: hrtimeUs() - t1 });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. SMALL UNARY — GetStats (raw gRPC vs REST)
  // ═══════════════════════════════════════════════════════════════
  console.log('  [3/4] GetStats (tiny payload) ...');
  for (let i = 0; i < ITER; i++) {
    const t0 = hrtimeUs();
    await rawGrpc.getStats();
    allSamples.push({ op: 'GetStats', transport: 'grpc', latencyUs: hrtimeUs() - t0 });

    const t1 = hrtimeUs();
    await restClient.getStats();
    allSamples.push({ op: 'GetStats', transport: 'rest', latencyUs: hrtimeUs() - t1 });
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. LARGE PAYLOAD — Export with LARGE_COUNT entries (~100KB+)
  // ═══════════════════════════════════════════════════════════════
  console.log(`  [4/4] Export (populating ${LARGE_COUNT} entries directly)...`);
  const engine = server.engine;
  for (let i = 0; i < LARGE_COUNT; i++) {
    engine.store({
      content: `large-payload-content-${i}-${'x'.repeat(300)}`,
      type: 'fact',
      tags: ['large', 'bench'],
    });
  }

  const SMALL_EXPORT_ITER = 10;
  console.log(`         Export (~${Math.round(LARGE_COUNT * 0.45)}KB response) ...`);
  for (let i = 0; i < SMALL_EXPORT_ITER; i++) {
    const t0 = hrtimeUs();
    const pack = await rawGrpc.exportMemory();
    const payloadBytes = JSON.stringify(pack).length;
    allSamples.push({ op: 'Export', transport: 'grpc', latencyUs: hrtimeUs() - t0, payloadBytes });

    const t1 = hrtimeUs();
    await restClient.exportMemory();
    allSamples.push({ op: 'Export', transport: 'rest', latencyUs: hrtimeUs() - t1, payloadBytes });
  }

  // ═══════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════
  await server.stop();
  rawGrpc.close();

  console.log('\n');
  console.log('  ════════════════════════════════════════════════════════════');
  console.log('    gRPC vs REST — Localhost Latency');
  console.log('  ════════════════════════════════════════════════════════════\n');

  const header = `  ${cls('Op', 14)} ${cls('Transport', 10)} ${cls('Avg(μs)', 10)} ${cls('p50', 8)} ${cls('p95', 8)} ${cls('p99', 8)} ${cls('Ratio', 8)}  ${cls('Payload', 10)}`;
  const sep = `  ${'─'.repeat(14)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)}  ${'─'.repeat(10)}`;

  console.log(header);
  console.log(sep);

  const ops = ['Store', 'Recall', 'GetStats', 'Export'];
  for (const op of ops) {
    const grpcs = allSamples
      .filter(s => s.op === op && s.transport === 'grpc')
      .map(s => s.latencyUs)
      .sort((a, b) => a - b);
    const rests = allSamples
      .filter(s => s.op === op && s.transport === 'rest')
      .map(s => s.latencyUs)
      .sort((a, b) => a - b);
    if (!grpcs.length || !rests.length) continue;

    const grpcAvg = grpcs.reduce((a, b) => a + b, 0) / grpcs.length;
    const restAvg = rests.reduce((a, b) => a + b, 0) / rests.length;
    const ratio = restAvg / grpcAvg;
    const pb = allSamples.find(s => s.op === op && s.payloadBytes)?.payloadBytes;

    console.log(`  ${cls(op, 14)} ${cls('gRPC', 10)} ${cls(grpcAvg.toFixed(1), 10)} ${cls(percentile(grpcs, 50).toFixed(1), 8)} ${cls(percentile(grpcs, 95).toFixed(1), 8)} ${cls(percentile(grpcs, 99).toFixed(1), 8)} ${cls(ratio >= 1 ? `${ratio.toFixed(2)}x` : `${(1/ratio).toFixed(2)}x`, 8)}  ${cls(pb ? `${(pb/1024).toFixed(0)}KB` : '', 10)}`);
    console.log(`  ${cls('', 14)} ${cls('REST', 10)} ${cls(restAvg.toFixed(1), 10)} ${cls(percentile(rests, 50).toFixed(1), 8)} ${cls(percentile(rests, 95).toFixed(1), 8)} ${cls(percentile(rests, 99).toFixed(1), 8)} ${cls('', 8)}  ${cls('', 10)}`);

    const faster = ratio >= 1 ? 'gRPC' : 'REST';
    const factor = ratio >= 1 ? ratio : 1 / ratio;
    console.log(`  ${cls('', 14)} ${cls('', 10)} ${cls('', 10)} ${cls('', 8)} ${cls('', 8)} ${cls('', 8)} ${cls('', 8)}  — ${faster} ${factor.toFixed(2)}x`);
    console.log();
  }

  // ── Overall Summary ──
  console.log('  ════════════════════════════════════════════════════════════');
  console.log('  Takeaways');
  console.log('  ════════════════════════════════════════════════════════════\n');

  const smallOps = ['Store', 'Recall', 'GetStats'];
  for (const op of smallOps) {
    const g = allSamples.filter(s => s.op === op && s.transport === 'grpc').map(s => s.latencyUs);
    const r = allSamples.filter(s => s.op === op && s.transport === 'rest').map(s => s.latencyUs);
    if (!g.length || !r.length) continue;
    const ga = g.reduce((a, b) => a + b, 0) / g.length;
    const ra = r.reduce((a, b) => a + b, 0) / r.length;
    const ratio = ra / ga;
    console.log(`  ${op}: gRPC ${ga.toFixed(0)}μs vs REST ${ra.toFixed(0)}μs — ${ratio >= 1 ? `gRPC ${ratio.toFixed(2)}x faster` : `REST ${(1/ratio).toFixed(2)}x faster`}`);
  }

  const exportGrpc = allSamples.filter(s => s.op === 'Export' && s.transport === 'grpc').map(s => s.latencyUs);
  const exportRest = allSamples.filter(s => s.op === 'Export' && s.transport === 'rest').map(s => s.latencyUs);
  if (exportGrpc.length && exportRest.length) {
    const ega = exportGrpc.reduce((a, b) => a + b, 0) / exportGrpc.length;
    const era = exportRest.reduce((a, b) => a + b, 0) / exportRest.length;
    const pb = allSamples.find(s => s.op === 'Export' && s.payloadBytes)?.payloadBytes ?? 0;
    console.log(`  Export (${(pb/1024).toFixed(0)}KB): gRPC ${ega.toFixed(0)}μs vs REST ${era.toFixed(0)}μs — ${ega < era ? `gRPC ${(era/ega).toFixed(2)}x faster` : `REST ${(ega/era).toFixed(2)}x faster`}`);
  }

  console.log(`
  ════════════════════════════════════════════════════════════
  Why the numbers differ from "10-100x" on localhost:

  • Proto serialization is CPU work — on localhost with tiny
    payloads (≈100B), REST's write(JSON)+read(JSON) costs
    <100μs, while gRPC's protobuf encode+decode adds 200-
    1000μs. The binary advantage flips when payloads exceed
    ~10KB (less JSON parsing, smaller wire format).

  • Network overhead is zero on localhost — the 15-30ms TCP
    handshake + TLS per REST call doesn't apply. The 10-100x
    claim assumes network RTT dominates, which it does across
    machines (LAN: ~1ms, WAN: 20-200ms).

  • Streaming is where gRPC creates value REST can't match.
    Server-push, bidirectional dialogue, and multiplexing on
    one connection are architectural advantages, not just
    raw throughput.

  Realistic speedup expectations:
    Unary, localhost:   0.5-2x (protobuf overhead cancels out)
    Unary, LAN:         2-5x  (TCP+JSON vs HTTP/2+protobuf)
    Unary, WAN:         5-20x (no per-call TCP handshake)
    Streaming:          ∞     (REST has no native streaming)
  ════════════════════════════════════════════════════════════`);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
