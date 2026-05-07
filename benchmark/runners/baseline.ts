/**
 * TIMPS Memory Recall Benchmark — Baseline Runner
 * 
 * Tests recall WITHOUT memory: sends raw question to LLM (no context).
 * Uses Ollama locally by default, or OPENAI_API_KEY if set.
 * 
 * Usage:
 *   npx tsx benchmark/runners/baseline.ts
 *   OLLAMA_MODEL=llama3.2 npx tsx benchmark/runners/baseline.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

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
  recall_hit: boolean;    // at least 1 keyword found
  precision_score: number; // fraction of keywords found
  keyword_hits: string[];
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

  console.log(`\n📊 TIMPS Baseline Benchmark (no memory)`);
  console.log(`Model: ${OPENAI_KEY ? 'gpt-4o-mini' : OLLAMA_MODEL}`);
  console.log(`Questions: ${sample.length}\n`);

  const results: RunResult[] = [];
  let totalLatency = 0;

  for (const q of sample) {
    const truth = groundTruth[q.id];
    if (!truth) { console.warn(`No ground truth for ${q.id}`); continue; }

    const prompt = `You are a helpful AI assistant. Answer this question about a software project. 
If you don't know the specific project details, say "I don't have that information."

Question: ${q.question}
Context: ${q.context}

Answer concisely (1-3 sentences):`;

    try {
      const { answer, latency_ms } = OPENAI_KEY
        ? await queryOpenAI(prompt)
        : await queryOllama(prompt);

      const { recall_hit, precision_score, keyword_hits } = scoreAnswer(answer, truth.expected_keywords);
      totalLatency += latency_ms;

      results.push({ id: q.id, category: q.category, question: q.question, answer, latency_ms, recall_hit, precision_score, keyword_hits });

      const icon = recall_hit ? '✓' : '✗';
      console.log(`${icon} [${q.id}] ${q.question.slice(0, 60)}... (${latency_ms}ms, ${Math.round(precision_score * 100)}%)`);
    } catch (err: unknown) {
      console.error(`✗ [${q.id}] ERROR: ${(err as Error).message}`);
      results.push({ id: q.id, category: q.category, question: q.question, answer: 'ERROR', latency_ms: 0, recall_hit: false, precision_score: 0, keyword_hits: [] });
    }
  }

  const recall_accuracy = results.filter(r => r.recall_hit).length / results.length;
  const avg_precision = results.reduce((s, r) => s + r.precision_score, 0) / results.length;
  const avg_latency = results.length > 0 ? totalLatency / results.filter(r => r.latency_ms > 0).length : 0;

  const summary = {
    runner: 'baseline',
    model: OPENAI_KEY ? 'gpt-4o-mini' : OLLAMA_MODEL,
    questions_tested: results.length,
    recall_accuracy: Math.round(recall_accuracy * 100),
    avg_precision: Math.round(avg_precision * 100),
    avg_latency_ms: Math.round(avg_latency),
    run_at: new Date().toISOString(),
    results,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `baseline_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log(`\n── Baseline Results ─────────────────────`);
  console.log(`Recall accuracy:  ${summary.recall_accuracy}%`);
  console.log(`Avg precision:    ${summary.avg_precision}%`);
  console.log(`Avg latency:      ${summary.avg_latency_ms}ms`);
  console.log(`\nResults saved: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
