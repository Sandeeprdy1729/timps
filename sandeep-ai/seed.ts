#!/usr/bin/env ts-node
/**
 * TIMPs Demo Seeder
 * Seeds realistic data across all 17 tools so the dashboard looks alive.
 *
 * Usage:
 *   cd sandeep-ai
 *   npx ts-node seed.ts [--user-id 1] [--reset]
 *
 * --reset  deletes existing seed data before seeding
 */

import { initDatabase, execute, query } from './db/postgres';
import { initToolsTables } from './tools/toolsDb';

const USER_ID = parseInt(process.argv.find(a => a.startsWith('--user-id='))?.split('=')[1] || '1');
const RESET = process.argv.includes('--reset');

async function ensureUser(): Promise<void> {
  const existing = await query('SELECT id FROM users WHERE id = $1', [USER_ID]);
  if (!existing.length) {
    await execute(
      `INSERT INTO users (id, uuid, username) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [USER_ID, `demo_user_${USER_ID}`, 'Demo User']
    );
    await execute(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
  }
}

async function reset(): Promise<void> {
  console.log('🗑  Resetting seed data...');
  const tables = [
    'curate_tier_decisions', 'curate_tier_summaries',
    'contradiction_history', 'positions',
    'behavioral_events', 'decisions',
    'value_observations', 'manifestos',
    'burnout_signals', 'burnout_baseline',
    'life_simulations', 'workflow_patterns',
    'learning_events', 'curricula',
    'code_incidents', 'bug_patterns',
    'api_knowledge', 'codebase_culture',
    'institutional_knowledge',
    'behavioral_profiles', 'compatibility_scores',
    'meeting_commitments',
    'wisdom_contributions',
    'relationship_signals', 'relationship_health',
    'memories',
  ];
  for (const t of tables) {
    await execute(`DELETE FROM ${t} WHERE user_id = $1 OR org_id = 'demo-org'`, [USER_ID]).catch(() => {});
  }
  console.log('✓  Reset complete');
}

// ── Tool 1: Temporal Mirror ───────────────────────────────────────────────────
async function seedTemporalMirror(): Promise<void> {
  const events = [
    { type: 'decision', context: 'Chose to ship MVP without full test coverage due to deadline', outcome: 'negative', days: 45 },
    { type: 'decision', context: 'Pushed back on feature request to keep scope small', outcome: 'positive', days: 38 },
    { type: 'reaction', context: 'Got frustrated when team ignored architecture suggestions', outcome: 'neutral', days: 30 },
    { type: 'action', context: 'Stayed up until 2am to fix production bug alone', outcome: 'negative', days: 22 },
    { type: 'decision', context: 'Delegated auth module to junior dev without sufficient review', outcome: 'negative', days: 18 },
    { type: 'action', context: 'Wrote comprehensive docs for the API before moving on', outcome: 'positive', days: 12 },
    { type: 'decision', context: 'Chose speed over quality again in sprint planning', outcome: 'negative', days: 7 },
    { type: 'reaction', context: 'Accepted critical feedback from code review gracefully', outcome: 'positive', days: 3 },
  ];
  for (const e of events) {
    await execute(
      `INSERT INTO behavioral_events (user_id, event_type, context, outcome, recorded_at)
       VALUES ($1,$2,$3,$4, NOW() - INTERVAL '${e.days} days')`,
      [USER_ID, e.type, e.context, e.outcome]
    );
  }
  console.log('✓  Tool 1: Temporal Mirror — 8 behavioral events');
}

// ── Tool 2: Regret Oracle ─────────────────────────────────────────────────────
async function seedRegretOracle(): Promise<void> {
  const decisions = [
    { desc: 'Shipped without testing — saved 2 days, caused 3-week debugging session', regret: 0.9, outcome: 'Race condition in prod, lost a client', days: 60 },
    { desc: 'Hired fast without culture fit check', regret: 0.8, outcome: 'Had to let them go 6 weeks later', days: 45 },
    { desc: 'Rewrote the auth system from scratch instead of using existing library', regret: 0.85, outcome: '3 security vulnerabilities discovered in audit', days: 90 },
    { desc: 'Ignored early warning signs from a key user about UX problems', regret: 0.7, outcome: 'User churned, left a 1-star review', days: 30 },
    { desc: 'Chose PostgreSQL over MongoDB — structured data needs', regret: 0.1, outcome: 'Great decision, scaling well', days: 120 },
    { desc: 'Said yes to every feature request in Q1', regret: 0.75, outcome: 'Burned out by March, quality dropped', days: 75 },
  ];
  for (const d of decisions) {
    await execute(
      `INSERT INTO decisions (user_id, description, outcome_noted, regret_score, decided_at)
       VALUES ($1,$2,$3,$4, NOW() - INTERVAL '${d.days} days')`,
      [USER_ID, d.desc, d.outcome, d.regret]
    );
  }
  console.log('✓  Tool 2: Regret Oracle — 6 decisions with regret scores');
}

// ── Tool 3: Living Manifesto ──────────────────────────────────────────────────
async function seedLivingManifesto(): Promise<void> {
  const observations = [
    { value: 'speed over quality', evidence: 'Shipped without tests 4 times this quarter', freq: 4 },
    { value: 'solo execution', evidence: 'Fixed 3 critical bugs alone at night instead of delegating', freq: 3 },
    { value: 'scope expansion', evidence: 'Added unrequested features in 5 of last 8 PRs', freq: 5 },
    { value: 'feedback avoidance', evidence: 'Delayed sharing work-in-progress with team 7 times', freq: 7 },
    { value: 'deep work', evidence: 'Best code written in 2-hour uninterrupted blocks, documented 6 times', freq: 6 },
    { value: 'technical elegance', evidence: 'Refactored working code 4 times citing readability', freq: 4 },
  ];
  for (const o of observations) {
    await execute(
      `INSERT INTO value_observations (user_id, inferred_value, evidence, frequency)
       VALUES ($1,$2,$3,$4)`,
      [USER_ID, o.value, o.evidence, o.freq]
    );
  }
  await execute(
    `INSERT INTO manifestos (user_id, content) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET content=$2, updated_at=NOW()`,
    [USER_ID, `You move fast and you know it. Speed is your highest actual value — not because you're reckless, but because shipping feels like progress and waiting feels like dying. You say you care about quality, and you do, but when forced to choose you pick momentum every single time.

You work best alone. Not because you're antisocial, but because coordination costs feel enormous to you. You've fixed more critical bugs at 2am solo than you've ever delegated successfully. You trust yourself more than systems.

Your real superpower is technical elegance — you see cleaner ways to do things and you can't leave them alone. This makes your code beautiful and your timelines unpredictable.

You avoid showing unfinished work. This is fear disguised as standards.`]
  );
  console.log('✓  Tool 3: Living Manifesto — 6 value observations + manifesto text');
}

// ── Tool 4: Burnout Seismograph ───────────────────────────────────────────────
async function seedBurnoutSeismograph(): Promise<void> {
  const baseline = { focus_hours: 5.5, response_time_mins: 12, enthusiasm_score: 7.5, commits_per_day: 6 };
  await execute(
    `INSERT INTO burnout_baseline (user_id, baseline_data) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET baseline_data=$2`,
    [USER_ID, JSON.stringify(baseline)]
  );
  const signalDays = [42, 35, 28, 21, 14, 10, 7, 5, 3, 1];
  const trend = (base: number, day: number, decay: number) => Math.max(0, base - (day / 42) * decay + (Math.random() - 0.5) * 0.5);
  for (const d of signalDays) {
    await execute(`INSERT INTO burnout_signals (user_id, signal_type, value, baseline_value, deviation_pct, recorded_at) VALUES ($1,'focus_hours',$2,$3,$4, NOW() - INTERVAL '${d} days')`, [USER_ID, trend(5.5, d, 2.5), 5.5, Math.round(((trend(5.5, d, 2.5) - 5.5) / 5.5) * 100)]);
    await execute(`INSERT INTO burnout_signals (user_id, signal_type, value, baseline_value, deviation_pct, recorded_at) VALUES ($1,'enthusiasm_score',$2,$3,$4, NOW() - INTERVAL '${d} days')`, [USER_ID, trend(7.5, d, 3.5), 7.5, Math.round(((trend(7.5, d, 3.5) - 7.5) / 7.5) * 100)]);
    await execute(`INSERT INTO burnout_signals (user_id, signal_type, value, baseline_value, deviation_pct, recorded_at) VALUES ($1,'commits_per_day',$2,$3,$4, NOW() - INTERVAL '${d} days')`, [USER_ID, trend(6, d, 2), 6, Math.round(((trend(6, d, 2) - 6) / 6) * 100)]);
  }
  console.log('✓  Tool 4: Burnout Seismograph — baseline + 30 signal readings showing downward trend');
}

// ── Tool 5: Argument DNA (Positions) ─────────────────────────────────────────
async function seedArgumentDNA(): Promise<void> {
  const positions = [
    { claim: 'Remote work significantly increases developer productivity and should be the default for all knowledge workers', topic: 'remote-work', type: 'normative', days: 45 },
    { claim: 'TypeScript is essential for any serious JavaScript project and the overhead is worth it', topic: 'typescript', type: 'normative', days: 38 },
    { claim: 'Startups should prioritize growth over revenue in early stages — unit economics can wait', topic: 'startup-strategy', type: 'empirical', days: 60 },
    { claim: 'AI coding assistants will replace junior developers within 3 years', topic: 'ai-future', type: 'predictive', days: 20 },
    { claim: 'Code reviews should be mandatory for every PR regardless of size', topic: 'engineering-process', type: 'normative', days: 15 },
    { claim: 'PostgreSQL is the right default database choice for 95% of applications', topic: 'databases', type: 'normative', days: 90 },
  ];
  for (const p of positions) {
    const result = await query<{ id: number }>(
      `INSERT INTO positions (user_id, project_id, content, extracted_claim, topic_cluster, claim_type, confidence_expressed, source_context, created_at)
       VALUES ($1,'default',$2,$3,$4,$5,$6,$7, NOW() - INTERVAL '${p.days} days') RETURNING id`,
      [USER_ID, p.claim, p.claim, p.topic, p.type, 0.8, `Stated in conversation`]
    );
    if (result[0] && p.topic === 'remote-work') {
      await execute(
        `INSERT INTO contradiction_history (position_id, contradicted_by_text, contradiction_score, semantic_similarity, explanation, acknowledged)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [result[0].id, 'Teams need to be co-located to maintain culture and collaboration', 0.82, 0.91, 'Directly opposes the stored position that remote work increases productivity', false]
      );
      await execute(`UPDATE positions SET contradiction_count = 1 WHERE id = $1`, [result[0].id]);
    }
  }
  console.log('✓  Tool 5: Argument DNA — 6 positions, 1 contradiction recorded');
}

// ── Tool 9: Tech Debt Seismograph ─────────────────────────────────────────────
async function seedTechDebt(): Promise<void> {
  const incidents = [
    { pattern: 'Callback pyramid with no error handling', type: 'race_condition', hours: 18, days: 90 },
    { pattern: 'Direct database calls inside React components', type: 'architecture_violation', hours: 6, days: 75 },
    { pattern: 'setTimeout used for async synchronization', type: 'race_condition', hours: 12, days: 60 },
    { pattern: 'Missing null checks on API response fields', type: 'null_pointer', hours: 3, days: 45 },
    { pattern: 'Shared mutable state across async functions', type: 'race_condition', hours: 22, days: 30 },
    { pattern: 'No retry logic on external API calls', type: 'reliability', hours: 8, days: 15 },
  ];
  for (const i of incidents) {
    await execute(
      `INSERT INTO code_incidents (user_id, project_id, pattern, incident_type, time_to_debug_hrs, occurred_at)
       VALUES ($1,'default',$2,$3,$4, NOW() - INTERVAL '${i.days} days')`,
      [USER_ID, i.pattern, i.type, i.hours]
    );
  }
  console.log('✓  Tool 9: Tech Debt Seismograph — 6 historical incidents');
}

// ── Tool 10: Bug Pattern Prophet ──────────────────────────────────────────────
async function seedBugPatterns(): Promise<void> {
  const bugs = [
    { type: 'race_condition', context: 'deadline pressure + async code', freq: 7 },
    { type: 'null_pointer', context: 'unfamiliar external API', freq: 5 },
    { type: 'off_by_one', context: 'late night sessions', freq: 4 },
    { type: 'memory_leak', context: 'event listeners not cleaned up', freq: 3 },
    { type: 'security_injection', context: 'string concatenation in queries', freq: 2 },
  ];
  for (const b of bugs) {
    await execute(
      `INSERT INTO bug_patterns (user_id, bug_type, trigger_context, frequency)
       VALUES ($1,$2,$3,$4)`,
      [USER_ID, b.type, b.context, b.freq]
    );
  }
  console.log('✓  Tool 10: Bug Pattern Prophet — 5 personal bug patterns');
}

// ── Tool 11: API Archaeologist ────────────────────────────────────────────────
async function seedAPIArchaeologist(): Promise<void> {
  const quirks = [
    { api: 'Stripe', endpoint: '/v1/webhooks', quirk: 'Actual timeout is 5s not 30s as documented. Must respond immediately and process async.', severity: 'critical' },
    { api: 'Stripe', endpoint: '/v1/events', quirk: 'Event delivery order is NOT guaranteed. Always use idempotency keys.', severity: 'warning' },
    { api: 'SendGrid', endpoint: '/v3/mail/send', quirk: 'Rate limit resets at random intervals, not hourly as docs state.', severity: 'warning' },
    { api: 'GitHub', endpoint: '/repos/{owner}/{repo}/actions/runs', quirk: 'Pagination token expires after 60s — must paginate quickly.', severity: 'info' },
    { api: 'OpenAI', endpoint: '/v1/chat/completions', quirk: 'Max retries with exponential backoff needed — 429s come in bursts.', severity: 'warning' },
  ];
  for (const q of quirks) {
    await execute(
      `INSERT INTO api_knowledge (user_id, api_name, endpoint, discovered_quirk, severity)
       VALUES ($1,$2,$3,$4,$5)`,
      [USER_ID, q.api, q.endpoint, q.quirk, q.severity]
    );
  }
  console.log('✓  Tool 11: API Archaeologist — 5 undocumented API quirks');
}

// ── Tool 15: Meeting Ghost ────────────────────────────────────────────────────
async function seedMeetingGhost(): Promise<void> {
  const commitments = [
    { person: 'Sandeep', text: 'Set up CI/CD pipeline before next sprint', status: 'pending', days: 5 },
    { person: 'Sandeep', text: 'Write API documentation for auth endpoints', status: 'pending', days: 3 },
    { person: 'Rahul', text: 'Review and merge the user dashboard PR', status: 'broken', days: 8 },
    { person: 'Priya', text: 'Share Q2 growth metrics by Friday', status: 'pending', days: 2 },
    { person: 'Sandeep', text: 'Update onboarding flow based on user feedback', status: 'in_progress', days: 6 },
    { person: 'Arjun', text: 'Fix the mobile responsiveness issues on landing page', status: 'completed', days: 10 },
    { person: 'Sandeep', text: 'Reach out to 5 potential design partners', status: 'pending', days: 4 },
  ];
  for (const c of commitments) {
    await execute(
      `INSERT INTO meeting_commitments (user_id, meeting_title, person_name, commitment, status, meeting_date)
       VALUES ($1,$2,$3,$4,$5, NOW() - INTERVAL '${c.days} days')`,
      [USER_ID, 'Weekly Team Sync', c.person, c.text, c.status]
    );
  }
  console.log('✓  Tool 15: Meeting Ghost — 7 commitments (4 pending, 1 broken, 1 in-progress, 1 done)');
}

// ── Tool 17: Relationship Intelligence ───────────────────────────────────────
async function seedRelationshipIntelligence(): Promise<void> {
  const relationships = [
    { name: 'Arjun (co-founder)', signals: [1,1,1,0.5,1,0.5,1,0.5,0,0], healthy: true },
    { name: 'Priya (early user)', signals: [1,0.5,1,0,0.5,0,0,-0.5,0,0], healthy: false },
    { name: 'Vikram (mentor)', signals: [1,1,0.5,1,0.5,0,0.5,0,0,0], healthy: true },
    { name: 'Maya (investor intro)', signals: [1,0.5,0,0,0,0,-0.5,0,0,0], healthy: false },
  ];
  for (const r of relationships) {
    for (let i = 0; i < r.signals.length; i++) {
      await execute(
        `INSERT INTO relationship_signals (user_id, contact_name, signal_type, value, recorded_at)
         VALUES ($1,$2,$3,$4, NOW() - INTERVAL '${i * 7} days')`,
        [USER_ID, r.name, i % 2 === 0 ? 'initiated_contact' : 'response_quality', r.signals[i]]
      );
    }
    const recentAvg = r.signals.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
    await execute(
      `INSERT INTO relationship_health (user_id, contact_name, health_score, drift_alert, last_interaction)
       VALUES ($1,$2,$3,$4, NOW() - INTERVAL '7 days')
       ON CONFLICT (user_id, contact_name) DO UPDATE SET health_score=$3, drift_alert=$4`,
      [USER_ID, r.name, Math.max(0, Math.min(1, recentAvg)), !r.healthy]
    );
  }
  console.log('✓  Tool 17: Relationship Intelligence — 4 contacts, 2 showing drift');
}

// ── Core Memories ─────────────────────────────────────────────────────────────
async function seedMemories(): Promise<void> {
  const memories = [
    { content: 'User is building TIMPs — an open-source AI memory infrastructure layer', type: 'explicit', importance: 5, tags: ['project', 'identity'] },
    { content: 'User prefers TypeScript over JavaScript for all new projects', type: 'explicit', importance: 3, tags: ['preference', 'tech'] },
    { content: 'User has a pattern of working late nights under deadline pressure — this is when most bugs occur', type: 'reflection', importance: 5, tags: ['behavior', 'pattern'] },
    { content: 'User goal: scale TIMPs to thousands of developers as fast as possible', type: 'explicit', importance: 5, tags: ['goal', 'growth'] },
    { content: 'User consistently values shipping speed over code quality, despite stating the opposite', type: 'reflection', importance: 4, tags: ['behavior', 'values'] },
    { content: 'User is running TIMPs on macOS with Ollama locally + OpenRouter for cloud models', type: 'explicit', importance: 3, tags: ['setup', 'tech'] },
    { content: 'User has llama3.1:8b, qwen2.5-coder, nomic-embed-text installed in Ollama', type: 'explicit', importance: 2, tags: ['setup'] },
    { content: 'User prefers concise, direct communication — pushback on verbose or elaborate responses', type: 'reflection', importance: 4, tags: ['preference', 'communication'] },
  ];
  const convId = `conv_seed_${Date.now()}`;
  for (const m of memories) {
    await execute(
      `INSERT INTO memories (user_id, project_id, content, memory_type, importance, retrieval_count, tags, source_conversation_id, source_message_id)
       VALUES ($1,'default',$2,$3,$4,$5,$6,$7,$8)`,
      [USER_ID, m.content, m.type, m.importance, 0, m.tags, convId, `msg_seed_${Date.now()}`]
    );
  }
  console.log('✓  Core memories — 8 memories seeded');
}

// ── Tool 18: CurateTier ──────────────────────────────────────────────────────
async function seedCurateTier(): Promise<void> {
  const decisions = [
    { tier: 'semantic', score: 0.92, relevance: 0.95, utility: 0.80, novelty: 0.85, recency: 1.0, gated: false, source: 'reflection', propagated: ['value_observations'] },
    { tier: 'episodic', score: 0.71, relevance: 0.70, utility: 0.65, novelty: 0.60, recency: 1.0, gated: false, source: 'coding', propagated: ['workflow_patterns', 'code_incidents'] },
    { tier: 'episodic', score: 0.68, relevance: 0.75, utility: 0.55, novelty: 0.50, recency: 1.0, gated: false, source: 'tool-output', propagated: ['bug_patterns'] },
    { tier: 'raw', score: 0.45, relevance: 0.40, utility: 0.30, novelty: 0.55, recency: 1.0, gated: false, source: 'reflection', propagated: [] },
    { tier: 'raw', score: 0.22, relevance: 0.20, utility: 0.15, novelty: 0.10, recency: 1.0, gated: true, source: 'reflection', propagated: [] },
    { tier: 'semantic', score: 0.88, relevance: 0.90, utility: 0.85, novelty: 0.70, recency: 1.0, gated: false, source: 'reflection', propagated: ['behavioral_events'] },
  ];
  for (const d of decisions) {
    await execute(
      `INSERT INTO curate_tier_decisions
       (user_id, tier, curation_score, relevance_score, utility_score, novelty_score, recency_score, gated, source_type, propagated_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [USER_ID, d.tier, d.score, d.relevance, d.utility, d.novelty, d.recency, d.gated, d.source, d.propagated]
    );
  }
  // Seed tier summaries
  await execute(
    `INSERT INTO curate_tier_summaries (user_id, tier, memory_count, avg_score)
     VALUES ($1,'raw', 2, 0.34), ($1,'episodic', 2, 0.70), ($1,'semantic', 2, 0.90)`,
    [USER_ID]
  );
  console.log('✓  Tool 18: CurateTier — 6 curation decisions + 3 tier summaries seeded');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║         TIMPs Demo Seeder v2.0                   ║');
  console.log(`║         Seeding data for userId: ${USER_ID.toString().padEnd(16)}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  await initDatabase();
  await initToolsTables();
  await ensureUser();

  if (RESET) await reset();

  console.log('\nSeeding all 18 tool data...\n');

  await seedMemories();
  await seedTemporalMirror();
  await seedRegretOracle();
  await seedLivingManifesto();
  await seedBurnoutSeismograph();
  await seedArgumentDNA();
  await seedTechDebt();
  await seedBugPatterns();
  await seedAPIArchaeologist();
  await seedMeetingGhost();
  await seedRelationshipIntelligence();
  await seedCurateTier();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  Seeding complete!                               ║');
  console.log('║                                                  ║');
  console.log('║  Open http://localhost:3000/dashboard            ║');
  console.log('║  to see all 18 tools with live data.             ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});