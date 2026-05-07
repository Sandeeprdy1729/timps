/**
 * TIMPS Memory Recall Benchmark — TIMPS Runner
 *
 * Tests recall WITH 3-layer TIMPS memory: pre-seeds memory with facts,
 * then runs questions using MemoryEngine recall to inject context into LLM prompt.
 *
 * Usage:
 *   npx tsx benchmark/runners/timps.ts
 *   OLLAMA_MODEL=llama3.2 npx tsx benchmark/runners/timps.ts
 *
 * This is the money shot benchmark — TIMPS with memory should significantly
 * outperform baseline on architecture_decision and code_pattern questions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MemoryEngine } from '../../packages/memory-core/dist/index.js';

const QUESTIONS_FILE = path.join(process.cwd(), 'benchmark/dataset/questions.json');
const GROUND_TRUTH_FILE = path.join(process.cwd(), 'benchmark/dataset/ground_truth.json');
const RESULTS_DIR = path.join(process.cwd(), 'benchmark/results');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SAMPLE_SIZE = parseInt(process.env.BENCHMARK_SAMPLE || '20', 10);

interface Question {
  id: string;
  category: string;
  question: string;
  context: string;
}

interface GroundTruth {
  [id: string]: {
    expected_keywords: string[];
    expected_source: string;
    category: string;
  };
}

interface RunResult {
  id: string;
  category: string;
  question: string;
  answer: string;
  latency_ms: number;
  recall_hit: boolean;
  precision_score: number;
  keyword_hits: string[];
  memory_entries_used: number;
}

/** Seed a MemoryEngine with project-realistic facts so the benchmark has data to recall. */
function seedMemory(engine: MemoryEngine): void {
  const facts = [
    // Architecture decisions
    { content: 'We use JWT tokens for authentication. Access tokens expire in 15 minutes, refresh tokens in 7 days.', type: 'decision' as const },
    { content: 'We moved away from Redux because of excessive boilerplate and complexity. Now using Zustand for global state.', type: 'decision' as const },
    { content: 'We chose PostgreSQL over MongoDB because our data is highly relational and we need ACID transactions.', type: 'decision' as const },
    { content: 'Decided to use Redis with TTL-based caching. Default TTL is 5 minutes for API responses.', type: 'decision' as const },
    { content: 'We chose a monorepo structure with npm workspaces to share memory-core across timps-code and timps-mcp.', type: 'decision' as const },
    { content: 'We use ESM (type: module) in timps-code with NodeNext moduleResolution. CJS only in timps-mcp because the MCP SDK requires it.', type: 'decision' as const },
    { content: 'We use tsup instead of tsc for building timps-mcp because tsc runs out of memory on the @modelcontextprotocol/sdk types.', type: 'decision' as const },
    { content: 'Memory is stored per-project using SHA-256 hash of the project path to avoid collisions across machines.', type: 'decision' as const },
    { content: 'We decided not to use Qdrant. The MiniSearch BM25 + Jaccard similarity is sufficient for local-first use without a running vector DB.', type: 'decision' as const },
    { content: 'The 3-layer memory system: working memory (in-memory, per session), episodic (append-only JSONL), semantic (deduped JSON with BM25 index).', type: 'decision' as const },
    { content: 'Backward compatibility rule: memory schema changes must be additive. Never remove fields from semantic.json or episodes.jsonl.', type: 'decision' as const },
    { content: 'SHA-256 was chosen for project hashing for collision resistance. djb2 is legacy in timps-code for backward compatibility.', type: 'decision' as const },
    { content: 'MiniSearch was chosen over Lunr because it is actively maintained, has better TypeScript support, and smaller bundle size.', type: 'decision' as const },
    { content: 'Windows path support: we use path.join() everywhere and normalize separators. Tested on Windows via CI matrix.', type: 'decision' as const },

    // Code patterns
    { content: 'API error handling pattern: try/catch in every route handler, return { error: string, status: number } with appropriate HTTP status code.', type: 'pattern' as const },
    { content: 'Database migration convention: timestamp prefix (e.g. 20240501_add_users_table.sql), always write both up and down migrations.', type: 'pattern' as const },
    { content: 'TypeScript interface naming: PascalCase, no I-prefix. E.g. MemoryEntry not IMemoryEntry.', type: 'preference' as const },
    { content: 'Environment variables: always use a config/env.ts that validates with zod. Never use process.env directly in application code.', type: 'pattern' as const },
    { content: 'API testing strategy: integration tests with supertest for HTTP layer, unit tests with jest mocks for business logic.', type: 'pattern' as const },
    { content: 'Logging convention: console.error for errors (includes stack trace), console.warn for warnings, console.log only in debug mode.', type: 'pattern' as const },
    { content: 'MCP tool auth: bearer token in Authorization header, validated by timpsAPI() helper. Return 401 on invalid token.', type: 'pattern' as const },
    { content: 'JSON API responses use camelCase for TypeScript/JS consumers. snake_case only in database columns.', type: 'pattern' as const },
    { content: 'Tool error handling: all tool errors are caught and returned as observations to the agent, not thrown. Agent retries up to 3 times.', type: 'pattern' as const },
    { content: 'Episodic memory dedup: we append all events but use Jaccard similarity in recall to avoid surfacing near-duplicates.', type: 'pattern' as const },
    { content: 'Intelligence tool lazy init pattern: private field with ??= getter. e.g. get contradiction() { return this._contradiction ??= new ContradictionDetector(this.dir); }', type: 'pattern' as const },
    { content: 'MCP tool descriptions must contain the trigger condition (e.g. "Use before writing code under pressure") to help LLM routing.', type: 'pattern' as const },
    { content: 'Memory schema versioning: the MemoryPack format has version: "1.0". Increment minor for additive changes.', type: 'pattern' as const },
    { content: 'Ink TUI components are functional with hooks. We avoid class components for consistency with React idioms.', type: 'pattern' as const },
    { content: 'New tools in timps-code: implement Tool interface, add schema (JSON Schema), add to toolRouter.ts, add description for agent routing.', type: 'pattern' as const },
    { content: 'Optional TypeScript fields: prefer field?: Type over field: Type | undefined to match JSON serialization behavior.', type: 'pattern' as const },
    { content: 'index.ts pattern: re-export everything public from a barrel. Never export internal helpers from index.ts.', type: 'preference' as const },

    // Personal preferences
    { content: 'I prefer 2 spaces for indentation, enforced by Prettier. No tabs anywhere in TypeScript/JavaScript.', type: 'preference' as const },
    { content: 'I prefer Jest over Vitest for now. ts-jest with CJS for packages that use CJS, native ESM transform for ESM packages.', type: 'preference' as const },
    { content: 'I prefer Promise.all for parallel requests where order doesn\'t matter. Async iteration for sequential processing.', type: 'preference' as const },
    { content: 'MCP tool schemas use zod for validation. z.string(), z.number(), z.enum() — always add .describe() to every field.', type: 'pattern' as const },
    { content: 'I prefer trunk-based development: short-lived feature branches, merge to main via PR, no long-lived branches.', type: 'preference' as const },
    { content: 'I use Node.js --inspect with Chrome DevTools for debugging hard async issues. console.trace() for quick callstack inspection.', type: 'preference' as const },
    { content: 'Internal helper functions get minimal or no JSDoc. Public API functions always get a one-line JSDoc comment.', type: 'preference' as const },
    { content: 'Test files named *.test.ts, co-located with the source file. No separate __tests__ directories.', type: 'preference' as const },
    { content: 'Functional React/Ink components preferred. useCallback and useMemo only when profiling shows a need.', type: 'preference' as const },
    { content: 'Branching strategy: main is always deployable. Feature branches named feat/description or fix/description.', type: 'preference' as const },
  ];

  for (const fact of facts) {
    engine.store(fact);
  }
}

async function queryOllama(prompt: string): Promise<{ answer: string; latency_ms: number }> {
  const start = Date.now();
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json() as { response: string };
  return { answer: data.response, latency_ms: Date.now() - start };
}

async function queryOpenAI(prompt: string): Promise<{ answer: string; latency_ms: number }> {
  const start = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: [{ message: { content: string } }] };
  return { answer: data.choices[0].message.content, latency_ms: Date.now() - start };
}

function scoreAnswer(answer: string, keywords: string[]): { recall_hit: boolean; precision_score: number; keyword_hits: string[] } {
  const lower = answer.toLowerCase();
  const hits = keywords.filter(k => lower.includes(k.toLowerCase()));
  return {
    recall_hit: hits.length > 0,
    precision_score: keywords.length > 0 ? hits.length / keywords.length : 0,
    keyword_hits: hits,
  };
}

async function main() {
  const questions: Question[] = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
  const groundTruth: GroundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH_FILE, 'utf-8'));
  const sample = questions.slice(0, SAMPLE_SIZE);

  // Create a temp memory directory
  const memDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timps-bench-'));
  const engine = new MemoryEngine(memDir);

  // Seed memory with project facts
  seedMemory(engine);
  const stats = engine.getStats();
  console.log(`\n📊 TIMPS Memory Recall Benchmark`);
  console.log(`Model: ${OPENAI_KEY ? 'gpt-4o-mini' : OLLAMA_MODEL}`);
  console.log(`Memory seeded: ${stats.semanticCount} facts`);
  console.log(`Questions: ${sample.length}\n`);

  const results: RunResult[] = [];
  let totalLatency = 0;

  for (const q of sample) {
    const truth = groundTruth[q.id];
    if (!truth) { console.warn(`No ground truth for ${q.id}`); continue; }

    // Retrieve relevant memory context
    const memories = engine.recall(q.question, { limit: 5 });
    const memoryContext = memories.length > 0
      ? `\n\nRELEVANT PROJECT MEMORY:\n${memories.map(m => `- ${m.content}`).join('\n')}`
      : '';

    const prompt = `You are a helpful AI assistant with access to project memory.
Answer this question about the software project using the provided memory context.${memoryContext}

Question: ${q.question}
Context: ${q.context}

Answer concisely (1-3 sentences) based on the project memory above:`;

    try {
      const { answer, latency_ms } = OPENAI_KEY
        ? await queryOpenAI(prompt)
        : await queryOllama(prompt);

      const { recall_hit, precision_score, keyword_hits } = scoreAnswer(answer, truth.expected_keywords);
      totalLatency += latency_ms;

      results.push({
        id: q.id, category: q.category, question: q.question, answer, latency_ms,
        recall_hit, precision_score, keyword_hits, memory_entries_used: memories.length,
      });

      const icon = recall_hit ? '✓' : '✗';
      console.log(`${icon} [${q.id}] ${q.question.slice(0, 60)}... (${latency_ms}ms, ${Math.round(precision_score * 100)}%, mem:${memories.length})`);
    } catch (err: unknown) {
      console.error(`✗ [${q.id}] ERROR: ${(err as Error).message}`);
      results.push({ id: q.id, category: q.category, question: q.question, answer: 'ERROR', latency_ms: 0, recall_hit: false, precision_score: 0, keyword_hits: [], memory_entries_used: 0 });
    }
  }

  // Clean up temp dir
  fs.rmSync(memDir, { recursive: true, force: true });

  const recall_accuracy = results.filter(r => r.recall_hit).length / results.length;
  const avg_precision = results.reduce((s, r) => s + r.precision_score, 0) / results.length;
  const avg_latency = results.length > 0 ? totalLatency / results.filter(r => r.latency_ms > 0).length : 0;
  const avg_memory_used = results.reduce((s, r) => s + r.memory_entries_used, 0) / results.length;

  const summary = {
    runner: 'timps',
    model: OPENAI_KEY ? 'gpt-4o-mini' : OLLAMA_MODEL,
    questions_tested: results.length,
    recall_accuracy: Math.round(recall_accuracy * 100),
    avg_precision: Math.round(avg_precision * 100),
    avg_latency_ms: Math.round(avg_latency),
    avg_memory_entries_used: Math.round(avg_memory_used * 10) / 10,
    run_at: new Date().toISOString(),
    results,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `timps_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log(`\n── TIMPS Results ──────────────────────────`);
  console.log(`Recall accuracy:      ${summary.recall_accuracy}%`);
  console.log(`Avg precision:        ${summary.avg_precision}%`);
  console.log(`Avg latency:          ${summary.avg_latency_ms}ms`);
  console.log(`Avg memory entries:   ${summary.avg_memory_entries_used}`);
  console.log(`\nResults saved: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
